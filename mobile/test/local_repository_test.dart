import 'dart:convert';

import 'package:drift/drift.dart' show driftRuntimeOptions;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumina_notes/data/local_db.dart';
import 'package:lumina_notes/data/local_repository.dart';
import 'package:lumina_notes/data/models.dart';

void main() {
  driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;

  late LocalDb db;
  late LocalRepository repo;

  setUp(() {
    db = LocalDb.forTesting(NativeDatabase.memory());
    repo = LocalRepository(db);
  });
  tearDown(() => db.close());

  Future<(Bookshelf, Notebook, Section)> tree() async {
    final b = await repo.createBookshelf('Shelf');
    final n = await repo.createNotebook(b.id, 'Book');
    final s = await repo.createSection(n.id, 'Chapter');
    return (b, n, s);
  }

  test('create page writes row and one upsert outbox entry', () async {
    final (_, _, s) = await tree();
    final p = await repo.createPage(s.id, 'Hello');
    expect((await repo.pages(s.id)).single.title, 'Hello');
    expect((await repo.page(p.id))!.content, '');
    final ops = (await repo.pendingOps()).where((o) => o.entityId == p.id).toList();
    expect(ops, hasLength(1));
    expect(ops.single.op, 'upsert');
    expect(ops.single.entity, 'page');
    expect(jsonDecode(ops.single.payload),
        {'sectionId': s.id, 'title': 'Hello', 'content': ''});
  });

  test('three edits of same page leave one outbox row with latest content and original seq', () async {
    final (_, _, s) = await tree();
    final p = await repo.createPage(s.id, 'Hello');
    final seq = (await repo.pendingOps()).firstWhere((o) => o.entityId == p.id).seq;
    for (final c in ['a', 'ab', 'abc']) {
      await repo.savePage(p.copyWith(content: c));
    }
    final ops = (await repo.pendingOps()).where((o) => o.entityId == p.id).toList();
    expect(ops, hasLength(1));
    expect(ops.single.seq, seq);
    expect(jsonDecode(ops.single.payload)['content'], 'abc');
    expect((await repo.page(p.id))!.content, 'abc');
  });

  test('create notebook then section: notebook seq < section seq', () async {
    final (b, n, s) = await tree();
    final ops = await repo.pendingOps();
    int seqOf(String id) => ops.firstWhere((o) => o.entityId == id).seq;
    expect(seqOf(b.id), lessThan(seqOf(n.id)));
    expect(seqOf(n.id), lessThan(seqOf(s.id)));
    // A later rename of the notebook keeps it ahead of its section.
    await repo.rename(EntityKind.notebook, n.id, 'Renamed');
    final ops2 = await repo.pendingOps();
    expect(ops2.map((o) => o.entityId).toList(), [b.id, n.id, s.id]);
  });

  test('delete notebook removes its sections/pages and their outbox rows, enqueues one delete', () async {
    final (b, n, s) = await tree();
    final p = await repo.createPage(s.id, 'Hello');
    await repo.delete(EntityKind.notebook, n.id);

    expect(await repo.notebooks(b.id), isEmpty);
    expect(await repo.sections(n.id), isEmpty);
    expect(await repo.page(p.id), isNull);

    final ops = await repo.pendingOps();
    expect(ops.where((o) => o.entityId == s.id || o.entityId == p.id), isEmpty);
    final nbOps = ops.where((o) => o.entityId == n.id).toList();
    expect(nbOps.single.op, 'delete');
  });

  test('changes stream emits after savePage', () async {
    final (_, _, s) = await tree();
    final p = await repo.createPage(s.id, 'Hello');
    final next = repo.changes.first;
    await repo.savePage(p.copyWith(content: 'x'));
    await expectLater(next, completes);
  });

  test('archived notebooks hidden from notebooks()', () async {
    final b = await repo.createBookshelf('Shelf');
    await repo.applyRemote(notebooks: [
      Notebook(id: 'nb-a', name: 'Old', bookshelfId: b.id, archived: true),
      Notebook(id: 'nb-b', name: 'Live', bookshelfId: b.id),
    ]);
    expect((await repo.notebooks(b.id)).map((n) => n.name), ['Live']);
  });

  test('applyRemote skips entities with pending ops and applies tombstones', () async {
    final (_, _, s) = await tree();
    final p = await repo.createPage(s.id, 'Mine');
    await repo.applyRemote(pages: [
      NotePage(id: p.id, sectionId: s.id, title: 'Theirs', content: 'server'),
      NotePage(id: 'page-remote', sectionId: s.id, title: 'Remote', content: 'r'),
    ]);
    expect((await repo.page(p.id))!.title, 'Mine');
    expect((await repo.page('page-remote'))!.title, 'Remote');

    await repo.applyRemote(tombstones: [(EntityKind.page, 'page-remote')]);
    expect(await repo.page('page-remote'), isNull);
    // Remote applies never create outbox entries.
    expect((await repo.pendingOps()).where((o) => o.entityId == 'page-remote'), isEmpty);
  });

  test('meta round-trips and wipe clears everything', () async {
    await tree();
    await repo.setMeta('cursor', 'c1');
    expect(await repo.meta('cursor'), 'c1');
    await repo.wipe();
    expect(await repo.bookshelves(), isEmpty);
    expect(await repo.pendingOps(), isEmpty);
    expect(await repo.meta('cursor'), isNull);
  });

  test('timestamps keep millisecond precision', () async {
    final b = await repo.createBookshelf('Shelf');
    await repo.applyRemote(bookshelves: [
      Bookshelf(id: 'bs-x', name: 'X', updatedAt: DateTime.utc(2026, 11, 16, 10, 0, 0, 123)),
    ]);
    final all = await repo.bookshelves();
    expect(all.firstWhere((x) => x.id == 'bs-x').updatedAt, DateTime.utc(2026, 11, 16, 10, 0, 0, 123));
    final op = (await repo.pendingOps()).firstWhere((o) => o.entityId == b.id);
    expect(op.clientUpdatedAt.toUtc().millisecondsSinceEpoch, b.updatedAt!.millisecondsSinceEpoch);
  });

  test('deleting a bookshelf with notebooks is refused', () async {
    final (b, _, _) = await tree();
    await expectLater(repo.delete(EntityKind.bookshelf, b.id), throwsA(isA<RuleException>()));
  });

  test('movePage reparents the page and queues an upsert with the new chapter', () async {
    final (b, n, s1) = await tree();
    final s2 = await repo.createSection(n.id, 'Other chapter');
    final p = await repo.createPage(s1.id, 'Wanderer');
    await repo.movePage(p.id, s2.id);
    expect(await repo.pages(s1.id), isEmpty);
    expect((await repo.pages(s2.id)).single.id, p.id);
    final op = (await repo.pendingOps()).singleWhere((o) => o.entityId == p.id);
    expect(jsonDecode(op.payload)['sectionId'], s2.id);
    expect(b.id, isNotEmpty);
  });

  test('moveSection carries its pages into another book', () async {
    final (b, n1, s) = await tree();
    final n2 = await repo.createNotebook(b.id, 'Second book');
    final p = await repo.createPage(s.id, 'Along for the ride');
    await repo.moveSection(s.id, n2.id);
    expect(await repo.sections(n1.id), isEmpty);
    expect((await repo.sections(n2.id)).single.id, s.id);
    expect((await repo.pages(s.id)).single.id, p.id);
    final op = (await repo.pendingOps()).singleWhere((o) => o.entityId == s.id);
    expect(jsonDecode(op.payload)['notebookId'], n2.id);
  });
}
