import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumina_notes/app_scope.dart';
import 'package:lumina_notes/data/session_store.dart';
import 'package:lumina_notes/main.dart';

import 'fakes.dart';

Future<FakeApiClient> _pumpSignedIn(WidgetTester tester) async {
  final fake = FakeApiClient()..seed();
  final kv = MemoryKeyValueStore()
    ..values['lumina.serverUrl'] = 'http://fake'
    ..values['lumina.token'] = 'tok'
    ..values['lumina.user'] = jsonEncode({'id': 1, 'email': 'a@b.co', 'name': 'A'});
  final session = SessionStore(kv);
  await session.load();
  final services = AppServices(session: session, apiFactory: (url, token) => fake..token = token);
  await tester.pumpWidget(LuminaApp(services: services));
  await tester.pumpAndSettle();
  return fake;
}

Future<void> _openNotebook(WidgetTester tester) async {
  await tester.tap(find.text('My bookshelf'));
  await tester.pumpAndSettle();
}

Future<void> _openEditor(WidgetTester tester) async {
  await _openNotebook(tester);
  await tester.tap(find.text('Welcome'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Notes'));
  await tester.pumpAndSettle();
  await tester.tap(find.text('Getting started'));
  await tester.pumpAndSettle();
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

  testWidgets('typing in editor saves after debounce', (tester) async {
    final fake = await _pumpSignedIn(tester);
    await _openEditor(tester);
    await tester.enterText(find.byKey(const Key('pageContent')), 'New text');
    await tester.pump(const Duration(milliseconds: 300));
    expect(fake.pagesById['page-1']!.content, '# Hello'); // not yet
    await tester.pump(const Duration(milliseconds: 900));
    await tester.pumpAndSettle();
    expect(fake.pagesById['page-1']!.content, 'New text');
    expect(find.text('Saved'), findsOneWidget);
  });

  testWidgets('create notebook via FAB appears in list', (tester) async {
    final fake = await _pumpSignedIn(tester);
    await _openNotebook(tester);
    await tester.tap(find.byKey(const Key('fab')));
    await tester.pumpAndSettle();
    await tester.enterText(find.byKey(const Key('nameField')), 'Ideas');
    await tester.tap(find.text('Create'));
    await tester.pumpAndSettle();
    expect(find.text('Ideas'), findsOneWidget);
    expect(fake.notebooksById.values.map((n) => n.name), contains('Ideas'));
  });

  testWidgets('delete asks for confirmation', (tester) async {
    final fake = await _pumpSignedIn(tester);
    await _openNotebook(tester);

    await tester.longPress(find.text('Welcome'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Delete'));
    await tester.pumpAndSettle();
    expect(find.text('Delete "Welcome"?'), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(fake.notebooksById, contains('nb-1'));

    await tester.longPress(find.text('Welcome'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Delete'));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(FilledButton, 'Delete'));
    await tester.pumpAndSettle();
    expect(fake.notebooksById, isNot(contains('nb-1')));
    expect(find.text('Welcome'), findsNothing);
  });

  testWidgets('sign out returns to connect screen', (tester) async {
    await _pumpSignedIn(tester);
    await tester.tap(find.byTooltip('Sign out'));
    await tester.pumpAndSettle();
    expect(find.byKey(const Key('serverUrl')), findsOneWidget);
  });
}
