import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumina_notes/app_scope.dart';
import 'package:lumina_notes/data/local_repository.dart';
import 'package:lumina_notes/data/models.dart';
import 'package:lumina_notes/data/session_store.dart';
import 'package:lumina_notes/main.dart';
import 'package:lumina_notes/sync/sync_engine.dart';

import 'fakes.dart';

/// Signed-in app backed by an in-memory local DB that already holds one
/// synced shelf → notebook → section → page.
late AppServices _services;

Future<LocalRepository> _pumpSignedIn(WidgetTester tester) async {
  final local = memoryLocal();
  await tester.runAsync(() async {
    await ensureOwner(local, 'http://fake', 1);
    await local.applyRemote(
      bookshelves: [const Bookshelf(id: 'bs-1', name: 'My bookshelf')],
      notebooks: [const Notebook(id: 'nb-1', name: 'Welcome', bookshelfId: 'bs-1')],
      sections: [const Section(id: 'sec-1', notebookId: 'nb-1', name: 'Notes')],
      pages: [const NotePage(id: 'page-1', sectionId: 'sec-1', title: 'Getting started', content: '# Hello')],
    );
  });
  final kv = MemoryKeyValueStore()
    ..values['lumina.serverUrl'] = 'http://fake'
    ..values['lumina.token'] = 'tok'
    ..values['lumina.user'] = jsonEncode({'id': 1, 'email': 'a@b.co', 'name': 'A', 'username': 'alice'});
  final session = SessionStore(kv);
  await session.load();
  final services = AppServices(session: session, apiFactory: (_, _) => FakeApiClient(), local: local, autoSync: false);
  _services = services;
  await tester.pumpWidget(LuminaApp(services: services));
  await _settle(tester);
  return local;
}

/// Drift does real async I/O; let it run, then settle the frame.
Future<void> _settle(WidgetTester tester) async {
  for (var i = 0; i < 3; i++) {
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 20)));
    await tester.pumpAndSettle();
  }
}

Future<void> _tap(WidgetTester tester, Finder f) async {
  await tester.tap(f);
  await _settle(tester);
}

Future<void> _openNotebook(WidgetTester tester) => _tap(tester, find.text('My bookshelf'));

Future<void> _openEditor(WidgetTester tester) async {
  await _openNotebook(tester);
  await _tap(tester, find.text('Welcome'));
  await _tap(tester, find.text('Notes'));
  await _tap(tester, find.text('Getting started'));
}

void main() {
  testWidgets('tap through hierarchy opens editor with page content', (tester) async {
    await _pumpSignedIn(tester);
    await _openEditor(tester);
    final content = tester.widget<TextField>(find.byKey(const Key('pageContent')));
    expect(content.controller!.text, '# Hello');
    final title = tester.widget<TextField>(find.byKey(const Key('pageTitle')));
    expect(title.controller!.text, 'Getting started');
  });

  testWidgets('typing in editor saves locally after debounce and queues a push', (tester) async {
    final local = await _pumpSignedIn(tester);
    await _openEditor(tester);
    await tester.enterText(find.byKey(const Key('pageContent')), 'New text');
    await tester.pump(const Duration(milliseconds: 300));
    expect(await tester.runAsync(() => local.page('page-1')).then((p) => p!.content), '# Hello');
    await tester.pump(const Duration(milliseconds: 900));
    await _settle(tester);
    expect(await tester.runAsync(() => local.page('page-1')).then((p) => p!.content), 'New text');
    expect(await tester.runAsync(() => local.hasPending(EntityKind.page, 'page-1')), isTrue);
    expect(find.text('Saved'), findsOneWidget);
  });

  testWidgets('create notebook via FAB appears in list', (tester) async {
    final local = await _pumpSignedIn(tester);
    await _openNotebook(tester);
    await _tap(tester, find.byKey(const Key('fab')));
    await tester.enterText(find.byKey(const Key('nameField')), 'Ideas');
    await _tap(tester, find.text('Create'));
    expect(find.text('Ideas'), findsOneWidget);
    final names = await tester.runAsync(() => local.notebooks('bs-1'));
    expect(names!.map((n) => n.name), contains('Ideas'));
  });

  testWidgets('delete asks for confirmation', (tester) async {
    final local = await _pumpSignedIn(tester);
    await _openNotebook(tester);

    await tester.longPress(find.text('Welcome'));
    await _settle(tester);
    await _tap(tester, find.text('Delete'));
    expect(find.text('Delete "Welcome"?'), findsOneWidget);
    await _tap(tester, find.text('Cancel'));
    expect(find.text('Welcome'), findsOneWidget);

    await tester.longPress(find.text('Welcome'));
    await _settle(tester);
    await _tap(tester, find.text('Delete'));
    await _tap(tester, find.widgetWithText(FilledButton, 'Delete'));
    expect(find.text('Welcome'), findsNothing);
    expect(await tester.runAsync(() => local.notebooks('bs-1')), isEmpty);
  });

  testWidgets('sign out returns to connect screen', (tester) async {
    await _pumpSignedIn(tester);
    await _tap(tester, find.byTooltip('Sign out'));
    // Server is kept: straight to login, no URL to retype.
    expect(find.byKey(const Key('serverLabel')), findsOneWidget);
    expect(find.byKey(const Key('identifier')), findsOneWidget);
  });

  testWidgets('sign out with unsynced changes asks first', (tester) async {
    final local = await _pumpSignedIn(tester);
    await tester.runAsync(() => local.createBookshelf('Offline'));
    await _settle(tester);
    await _tap(tester, find.byTooltip('Sign out'));
    expect(find.text('1 unsynced change will be lost'), findsOneWidget);
    await _tap(tester, find.text('Cancel'));
    expect(find.byKey(const Key('serverUrl')), findsNothing);
  });

  testWidgets('Sign in again opens connect screen prefilled and keeps local data', (tester) async {
    final local = await _pumpSignedIn(tester);
    _services.sync!.debugSetState(SyncState.authExpired, pendingCount: 1);
    await _settle(tester);
    await _tap(tester, find.text('Sign in again · 1'));
    expect(find.byKey(const Key('serverLabel')), findsOneWidget);
    expect(find.byKey(const Key('changeServer')), findsNothing); // re-auth can't switch servers
    final id = tester.widget<TextField>(find.byKey(const Key('identifier')));
    expect(id.controller!.text, 'alice');
    expect(await tester.runAsync(() => local.bookshelves()).then((b) => b!.length), 1);
  });
}
