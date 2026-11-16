import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumina_notes/app_scope.dart';
import 'package:lumina_notes/data/local_repository.dart';
import 'package:lumina_notes/data/models.dart';
import 'package:lumina_notes/data/session_store.dart';
import 'package:lumina_notes/main.dart';

import 'fakes.dart';

Future<LocalRepository> _pump(WidgetTester tester, Size size) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final local = memoryLocal();
  await tester.runAsync(() async {
    await ensureOwner(local, 'http://fake', 1);
    await local.applyRemote(
      bookshelves: [const Bookshelf(id: 'bs-1', name: 'My bookshelf')],
      notebooks: [const Notebook(id: 'nb-1', name: 'Welcome', bookshelfId: 'bs-1')],
      sections: [const Section(id: 'sec-1', notebookId: 'nb-1', name: 'Notes')],
      pages: [
        const NotePage(id: 'page-1', sectionId: 'sec-1', title: 'Getting started', content: '# Hello\n\nSome *text*'),
        const NotePage(id: 'page-2', sectionId: 'sec-1', title: 'Second', content: 'two'),
      ],
    );
  });
  final kv = MemoryKeyValueStore()
    ..values['lumina.serverUrl'] = 'http://fake'
    ..values['lumina.token'] = 'tok'
    ..values['lumina.user'] = jsonEncode({'id': 1, 'email': 'a@b.co', 'name': 'A'});
  final session = SessionStore(kv);
  await session.load();
  await tester.pumpWidget(LuminaApp(
    services: AppServices(session: session, apiFactory: (_, _) => FakeApiClient(), local: local, autoSync: false),
  ));
  await _settle(tester);
  return local;
}

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

Future<void> _toPages(WidgetTester tester) async {
  await _tap(tester, find.text('My bookshelf'));
  await _tap(tester, find.text('Welcome'));
  await _tap(tester, find.byKey(const Key('chapterTab-sec-1')));
}

void main() {
  testWidgets('wide layout shows list and editor side by side', (tester) async {
    await _pump(tester, const Size(1280, 800));
    await _toPages(tester);
    expect(find.byKey(const Key('navPane')), findsOneWidget);
    expect(find.text('Select a page'), findsOneWidget);
    await _tap(tester, find.text('Getting started'));
    // Page list stays visible next to the editor.
    expect(find.text('Second'), findsOneWidget);
    expect(find.byKey(const Key('pageContent')), findsOneWidget);
    // Switching pages swaps the editor content.
    await _tap(tester, find.text('Second'));
    final content = tester.widget<TextField>(find.byKey(const Key('pageContent')));
    expect(content.controller!.text, 'two');
  });

  testWidgets('narrow layout pushes editor', (tester) async {
    await _pump(tester, const Size(400, 800));
    await _toPages(tester);
    expect(find.byKey(const Key('navPane')), findsNothing);
    await _tap(tester, find.text('Getting started'));
    expect(find.byKey(const Key('pageContent')), findsOneWidget);
    expect(find.text('Second'), findsNothing); // list is behind the pushed editor
  });

  testWidgets('preview renders markdown', (tester) async {
    await _pump(tester, const Size(400, 800));
    await _toPages(tester);
    await _tap(tester, find.text('Getting started'));
    await _tap(tester, find.text('Preview'));
    expect(find.byKey(const Key('pageContent')), findsNothing);
    expect(find.text('Hello'), findsOneWidget); // "# Hello" rendered as a heading
    await _tap(tester, find.text('Edit'));
    expect(find.byKey(const Key('pageContent')), findsOneWidget);
  });

  testWidgets('open editor picks up a synced change when there are no local edits', (tester) async {
    final local = await _pump(tester, const Size(400, 800));
    await _toPages(tester);
    await _tap(tester, find.text('Second'));
    await tester.runAsync(() => local.applyRemote(
          pages: [const NotePage(id: 'page-2', sectionId: 'sec-1', title: 'Second', content: 'from desktop')],
        ));
    await _settle(tester);
    final content = tester.widget<TextField>(find.byKey(const Key('pageContent')));
    expect(content.controller!.text, 'from desktop');
  });
}
