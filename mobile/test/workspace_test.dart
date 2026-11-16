import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumina_notes/app_scope.dart';
import 'package:lumina_notes/data/local_repository.dart';
import 'package:lumina_notes/data/models.dart';
import 'package:lumina_notes/data/session_store.dart';
import 'package:lumina_notes/main.dart';
import 'package:lumina_notes/settings.dart';
import 'package:lumina_notes/version.dart';

import 'fakes.dart';

late AppServices _services;

/// Shelf → two books; "Welcome" has chapters Notes (2 pages) and Ideas (empty).
Future<LocalRepository> _pump(WidgetTester tester, Size size) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final local = memoryLocal();
  await tester.runAsync(() async {
    await ensureOwner(local, 'http://fake', 1);
    await local.applyRemote(
      bookshelves: [const Bookshelf(id: 'bs-1', name: 'My bookshelf')],
      notebooks: [
        const Notebook(id: 'nb-1', name: 'Welcome', bookshelfId: 'bs-1'),
        const Notebook(id: 'nb-2', name: 'Journal', bookshelfId: 'bs-1'),
      ],
      sections: [
        const Section(id: 'sec-1', notebookId: 'nb-1', name: 'Notes'),
        const Section(id: 'sec-2', notebookId: 'nb-1', name: 'Ideas'),
      ],
      pages: [
        const NotePage(id: 'page-1', sectionId: 'sec-1', title: 'Getting started', content: '# Hello'),
        const NotePage(id: 'page-2', sectionId: 'sec-1', title: 'Second', content: 'two'),
      ],
    );
  });
  final kv = MemoryKeyValueStore()
    ..values['lumina.serverUrl'] = 'http://fake'
    ..values['lumina.token'] = 'tok'
    ..values['lumina.user'] = jsonEncode({'id': 1, 'email': 'a@b.co', 'name': 'Ada', 'username': 'ada'});
  final session = SessionStore(kv);
  await session.load();
  _services = AppServices(
    session: session,
    apiFactory: (_, _) => FakeApiClient(),
    local: local,
    settings: AppSettings.inMemory(),
    autoSync: false,
  );
  await tester.pumpWidget(LuminaApp(services: _services));
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

/// Opens "Welcome" on its "Notes" chapter (chapters list alphabetically, so Ideas is first).
Future<void> _openBook(WidgetTester tester) async {
  await _tap(tester, find.text('Welcome'));
  await _tap(tester, find.byKey(const Key('chapterTab-sec-1')));
}

void main() {
  testWidgets('library shows shelves as chips and books as cards', (tester) async {
    await _pump(tester, const Size(400, 800));
    expect(find.widgetWithText(ChoiceChip, 'My bookshelf'), findsOneWidget);
    expect(find.text('Welcome'), findsOneWidget);
    expect(find.text('Journal'), findsOneWidget);
  });

  testWidgets('book shows chapter tabs; switching tabs swaps the page list', (tester) async {
    await _pump(tester, const Size(400, 800));
    await _openBook(tester);
    expect(find.byKey(const Key('chapterTab-sec-1')), findsOneWidget);
    expect(find.byKey(const Key('chapterTab-sec-2')), findsOneWidget);
    expect(find.text('Getting started'), findsOneWidget);
    await _tap(tester, find.byKey(const Key('chapterTab-sec-2')));
    expect(find.text('Getting started'), findsNothing);
    expect(find.text('Nothing here yet'), findsOneWidget);
  });

  testWidgets('Move to another chapter moves the page', (tester) async {
    final local = await _pump(tester, const Size(400, 800));
    await _openBook(tester);
    await _tap(tester, find.byTooltip('Page options').first);
    await _tap(tester, find.text('Move to another chapter'));
    expect(find.text('Move page'), findsOneWidget);
    await _tap(tester, find.widgetWithText(ListTile, 'Ideas'));
    expect(find.text('Moved to “Ideas”'), findsOneWidget);
    final moved = await tester.runAsync(() => local.page('page-1'));
    expect(moved!.sectionId, 'sec-2');
    expect(find.text('Getting started'), findsNothing); // left the Notes list
  });

  testWidgets('dragging a page onto a chapter tab moves it (tablet)', (tester) async {
    final local = await _pump(tester, const Size(1280, 800));
    await _openBook(tester);
    final gesture = await tester.startGesture(tester.getCenter(find.text('Second')));
    await tester.pump(const Duration(milliseconds: 700)); // long-press to pick up
    await gesture.moveTo(tester.getCenter(find.byKey(const Key('chapterTab-sec-2'))));
    await tester.pump();
    await gesture.up();
    await _settle(tester);
    final moved = await tester.runAsync(() => local.page('page-2'));
    expect(moved!.sectionId, 'sec-2');
  });

  testWidgets('chapter can move to another book', (tester) async {
    final local = await _pump(tester, const Size(400, 800));
    await _openBook(tester);
    await tester.longPress(find.byKey(const Key('chapterTab-sec-2')));
    await _settle(tester);
    await _tap(tester, find.text('Move to another book'));
    await _tap(tester, find.widgetWithText(ListTile, 'Journal'));
    expect(await tester.runAsync(() => local.sections('nb-2')).then((s) => s!.single.id), 'sec-2');
    expect(find.byKey(const Key('chapterTab-sec-2')), findsNothing);
  });

  testWidgets('settings shows the version and changes reading font size', (tester) async {
    await _pump(tester, const Size(400, 900));
    await _tap(tester, find.byTooltip('Settings'));
    expect(find.text('Lumina Notes $appVersionLabel'), findsOneWidget);
    final slider = find.byKey(const Key('readerSize'));
    await tester.ensureVisible(slider);
    await tester.pumpAndSettle();
    await tester.drag(slider, const Offset(400, 0));
    await _settle(tester);
    expect(_services.settings.fontSize, AppSettings.maxSize);
    final reset = find.widgetWithText(TextButton, 'Reset');
    await tester.ensureVisible(reset);
    await tester.pumpAndSettle();
    await _tap(tester, reset);
    expect(_services.settings.fontSize, 16);
  });

  testWidgets('editor uses the reading font settings', (tester) async {
    await _pump(tester, const Size(400, 800));
    _services.settings.update(font: ReaderFont.mono, fontSize: 20);
    await _openBook(tester);
    await _tap(tester, find.text('Getting started'));
    final field = tester.widget<TextField>(find.byKey(const Key('pageContent')));
    expect(field.style?.fontFamily, 'monospace');
    expect(field.style?.fontSize, 20);
  });
}
