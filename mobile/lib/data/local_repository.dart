import 'dart:async';
import 'dart:convert';

import 'package:drift/drift.dart';

import 'ids.dart';
import 'local_db.dart';
import 'models.dart';
import 'notes_repository.dart';

/// A local rule was broken (mirrors a server-side 4xx rule).
class RuleException implements Exception {
  const RuleException(this.message);

  final String message;

  @override
  String toString() => message;
}

/// Offline-first repository: reads/writes the local Drift DB and records every
/// mutation in the outbox for the sync engine to push.
class LocalRepository implements NotesRepository {
  LocalRepository(this.db);

  final LocalDb db;
  final _changes = StreamController<void>.broadcast();

  @override
  Stream<void> get changes => _changes.stream;

  void _changed() => _changes.add(null);

  DateTime _now() => DateTime.now().toUtc();

  // ---------------------------------------------------------------- reads

  @override
  Future<List<Bookshelf>> bookshelves() async {
    final rows = await (db.select(db.bookshelves)..orderBy([(t) => OrderingTerm(expression: t.name)])).get();
    return rows.map(_shelf).toList();
  }

  @override
  Future<List<Notebook>> notebooks(String bookshelfId) async {
    final rows = await (db.select(db.notebooks)
          ..where((t) => t.bookshelfId.equals(bookshelfId) & t.archived.equals(false))
          ..orderBy([(t) => OrderingTerm(expression: t.name)]))
        .get();
    return rows.map(_notebook).toList();
  }

  @override
  Future<List<Section>> sections(String notebookId) async {
    final rows = await (db.select(db.sections)
          ..where((t) => t.notebookId.equals(notebookId))
          ..orderBy([(t) => OrderingTerm(expression: t.name)]))
        .get();
    return rows.map(_section).toList();
  }

  @override
  Future<List<NotePage>> pages(String sectionId) async {
    final rows = await (db.select(db.pages)
          ..where((t) => t.sectionId.equals(sectionId))
          ..orderBy([(t) => OrderingTerm(expression: t.title)]))
        .get();
    return rows.map(_page).toList();
  }

  @override
  Future<NotePage?> page(String id) async {
    final row = await (db.select(db.pages)..where((t) => t.id.equals(id))).getSingleOrNull();
    return row == null ? null : _page(row);
  }

  // ---------------------------------------------------------------- writes

  @override
  Future<Bookshelf> createBookshelf(String name) async {
    final b = Bookshelf(id: newId(EntityKind.bookshelf), name: name, updatedAt: _now());
    await db.transaction(() async {
      await db.into(db.bookshelves).insert(_shelfRow(b));
      await enqueue(EntityKind.bookshelf, b.id, 'upsert', _payload(b), b.updatedAt!);
    });
    _changed();
    return b;
  }

  @override
  Future<Notebook> createNotebook(String bookshelfId, String name) async {
    final n = Notebook(
        id: newId(EntityKind.notebook), name: name, bookshelfId: bookshelfId, updatedAt: _now());
    await db.transaction(() async {
      await db.into(db.notebooks).insert(_notebookRow(n));
      await enqueue(EntityKind.notebook, n.id, 'upsert', _payload(n), n.updatedAt!);
    });
    _changed();
    return n;
  }

  @override
  Future<Section> createSection(String notebookId, String name) async {
    final s = Section(
        id: newId(EntityKind.section), notebookId: notebookId, name: name, updatedAt: _now());
    await db.transaction(() async {
      await db.into(db.sections).insert(_sectionRow(s));
      await enqueue(EntityKind.section, s.id, 'upsert', _payload(s), s.updatedAt!);
    });
    _changed();
    return s;
  }

  @override
  Future<NotePage> createPage(String sectionId, String title) async {
    final p = NotePage(
        id: newId(EntityKind.page), sectionId: sectionId, title: title, content: '', updatedAt: _now());
    await db.transaction(() async {
      await db.into(db.pages).insert(_pageRow(p));
      await enqueue(EntityKind.page, p.id, 'upsert', _payload(p), p.updatedAt!);
    });
    _changed();
    return p;
  }

  @override
  Future<void> savePage(NotePage page) async {
    final p = page.copyWith(updatedAt: _now());
    await db.transaction(() async {
      await db.into(db.pages).insertOnConflictUpdate(_pageRow(p));
      await enqueue(EntityKind.page, p.id, 'upsert', _payload(p), p.updatedAt!);
    });
    _changed();
  }

  @override
  Future<void> rename(EntityKind kind, String id, String name) async {
    final at = _now();
    await db.transaction(() async {
      switch (kind) {
        case EntityKind.bookshelf:
          final r = await (db.select(db.bookshelves)..where((t) => t.id.equals(id))).getSingle();
          final b = _shelf(r).copyWith(name: name, updatedAt: at);
          await db.into(db.bookshelves).insertOnConflictUpdate(_shelfRow(b));
          await enqueue(kind, id, 'upsert', _payload(b), at);
        case EntityKind.notebook:
          final r = await (db.select(db.notebooks)..where((t) => t.id.equals(id))).getSingle();
          final n = _notebook(r).copyWith(name: name, updatedAt: at);
          await db.into(db.notebooks).insertOnConflictUpdate(_notebookRow(n));
          await enqueue(kind, id, 'upsert', _payload(n), at);
        case EntityKind.section:
          final r = await (db.select(db.sections)..where((t) => t.id.equals(id))).getSingle();
          final s = _section(r).copyWith(name: name, updatedAt: at);
          await db.into(db.sections).insertOnConflictUpdate(_sectionRow(s));
          await enqueue(kind, id, 'upsert', _payload(s), at);
        case EntityKind.page:
          final r = await (db.select(db.pages)..where((t) => t.id.equals(id))).getSingle();
          final p = _page(r).copyWith(title: name, updatedAt: at);
          await db.into(db.pages).insertOnConflictUpdate(_pageRow(p));
          await enqueue(kind, id, 'upsert', _payload(p), at);
      }
    });
    _changed();
  }

  @override
  Future<void> delete(EntityKind kind, String id) async {
    if (kind == EntityKind.bookshelf) {
      final n = await (db.select(db.notebooks)..where((t) => t.bookshelfId.equals(id))).get();
      if (n.isNotEmpty) {
        throw const RuleException('Move or delete notebooks before deleting this bookshelf');
      }
    }
    await db.transaction(() async {
      await _deleteTree(kind, id, dropOutbox: true);
      await enqueue(kind, id, 'delete', const {}, _now());
    });
    _changed();
  }

  /// Deletes [id] and its descendants locally. With [dropOutbox], pending ops of
  /// the descendants are discarded too (the server cascades the parent delete).
  Future<void> _deleteTree(EntityKind kind, String id, {required bool dropOutbox}) async {
    Future<void> dropOps(EntityKind k, Iterable<String> ids) async {
      if (!dropOutbox || ids.isEmpty) return;
      await (db.delete(db.outbox)..where((t) => t.entity.equals(k.wire) & t.entityId.isIn(ids))).go();
    }

    switch (kind) {
      case EntityKind.bookshelf:
        final nbs = await (db.select(db.notebooks)..where((t) => t.bookshelfId.equals(id))).get();
        for (final n in nbs) {
          await _deleteTree(EntityKind.notebook, n.id, dropOutbox: dropOutbox);
          await dropOps(EntityKind.notebook, [n.id]);
        }
        await (db.delete(db.bookshelves)..where((t) => t.id.equals(id))).go();
      case EntityKind.notebook:
        final secs = await (db.select(db.sections)..where((t) => t.notebookId.equals(id))).get();
        for (final s in secs) {
          await _deleteTree(EntityKind.section, s.id, dropOutbox: dropOutbox);
        }
        await dropOps(EntityKind.section, secs.map((s) => s.id));
        await (db.delete(db.notebooks)..where((t) => t.id.equals(id))).go();
      case EntityKind.section:
        final pgs = await (db.select(db.pages)..where((t) => t.sectionId.equals(id))).get();
        await dropOps(EntityKind.page, pgs.map((p) => p.id));
        await (db.delete(db.pages)..where((t) => t.sectionId.equals(id))).go();
        await (db.delete(db.sections)..where((t) => t.id.equals(id))).go();
      case EntityKind.page:
        await (db.delete(db.pages)..where((t) => t.id.equals(id))).go();
    }
  }

  // ---------------------------------------------------------------- outbox

  /// Records a pending op. One row per entity: a newer mutation replaces the
  /// op/payload in place and keeps [OutboxEntry.seq], so parents stay ahead of children.
  Future<void> enqueue(
      EntityKind kind, String id, String op, Map<String, dynamic> payload, DateTime at) async {
    final existing = await (db.select(db.outbox)
          ..where((t) => t.entity.equals(kind.wire) & t.entityId.equals(id)))
        .getSingleOrNull();
    final companion = OutboxCompanion(
      entity: Value(kind.wire),
      entityId: Value(id),
      op: Value(op),
      payload: Value(jsonEncode(payload)),
      clientUpdatedAt: Value(at),
      attempts: const Value(0),
    );
    if (existing == null) {
      await db.into(db.outbox).insert(companion);
    } else {
      await (db.update(db.outbox)..where((t) => t.seq.equals(existing.seq))).write(companion);
    }
  }

  Future<List<OutboxEntry>> pendingOps({int limit = 200}) =>
      (db.select(db.outbox)
            ..orderBy([(t) => OrderingTerm(expression: t.seq)])
            ..limit(limit))
          .get();

  Future<int> pendingCount() async {
    final c = db.outbox.seq.count();
    final row = await (db.selectOnly(db.outbox)..addColumns([c])).getSingle();
    return row.read(c) ?? 0;
  }

  Future<void> removeOp(int seq) => (db.delete(db.outbox)..where((t) => t.seq.equals(seq))).go();

  /// Removes [seq] only if it was not re-queued (edited again) since [snapshot] was read.
  Future<void> removeOpIfUnchanged(OutboxEntry snapshot) => (db.delete(db.outbox)
        ..where((t) =>
            t.seq.equals(snapshot.seq) &
            t.clientUpdatedAt.equals(snapshot.clientUpdatedAt) &
            t.op.equals(snapshot.op)))
      .go();

  Future<void> bumpAttempts(int seq) => db.customUpdate(
        'UPDATE outbox SET attempts = attempts + 1 WHERE seq = ?',
        variables: [Variable.withInt(seq)],
        updates: {db.outbox},
      );

  Future<bool> hasPending(EntityKind kind, String id) async =>
      await (db.select(db.outbox)..where((t) => t.entity.equals(kind.wire) & t.entityId.equals(id)))
          .getSingleOrNull() !=
      null;

  /// Applies server state. Entities with a pending local op are skipped: the
  /// push decides them (LWW on the server). Never writes to the outbox.
  Future<void> applyRemote({
    List<Bookshelf> bookshelves = const [],
    List<Notebook> notebooks = const [],
    List<Section> sections = const [],
    List<NotePage> pages = const [],
    List<(EntityKind, String)> tombstones = const [],
  }) async {
    await db.transaction(() async {
      for (final b in bookshelves) {
        if (!await hasPending(EntityKind.bookshelf, b.id)) {
          await db.into(db.bookshelves).insertOnConflictUpdate(_shelfRow(b));
        }
      }
      for (final n in notebooks) {
        if (!await hasPending(EntityKind.notebook, n.id)) {
          await db.into(db.notebooks).insertOnConflictUpdate(_notebookRow(n));
        }
      }
      for (final s in sections) {
        if (!await hasPending(EntityKind.section, s.id)) {
          await db.into(db.sections).insertOnConflictUpdate(_sectionRow(s));
        }
      }
      for (final p in pages) {
        if (!await hasPending(EntityKind.page, p.id)) {
          await db.into(db.pages).insertOnConflictUpdate(_pageRow(p));
        }
      }
      for (final (kind, id) in tombstones) {
        if (!await hasPending(kind, id)) {
          await _deleteTree(kind, id, dropOutbox: true);
        }
      }
    });
    _changed();
  }

  /// Removes a row (and its subtree) the server says no longer exists, plus its pending op.
  Future<void> forgetLocal(EntityKind kind, String id) async {
    await db.transaction(() async {
      await _deleteTree(kind, id, dropOutbox: true);
      await (db.delete(db.outbox)..where((t) => t.entity.equals(kind.wire) & t.entityId.equals(id))).go();
    });
    _changed();
  }

  Future<String?> meta(String key) async =>
      (await (db.select(db.syncMeta)..where((t) => t.key.equals(key))).getSingleOrNull())?.value;

  Future<void> setMeta(String key, String value) =>
      db.into(db.syncMeta).insertOnConflictUpdate(SyncMetaRow(key: key, value: value));

  Future<void> wipe() async {
    await db.transaction(() async {
      for (final t in db.allTables) {
        await db.delete(t).go();
      }
    });
    _changed();
  }

  // ---------------------------------------------------------------- mapping

  static Map<String, dynamic> _payload(Object e) => switch (e) {
        Bookshelf b => {'name': b.name},
        Notebook n => {'bookshelfId': n.bookshelfId, 'name': n.name, 'archived': n.archived},
        Section s => {'notebookId': s.notebookId, 'name': s.name},
        NotePage p => {'sectionId': p.sectionId, 'title': p.title, 'content': p.content},
        _ => throw ArgumentError(e),
      };

  static Bookshelf _shelf(BookshelfRow r) => Bookshelf(id: r.id, name: r.name, updatedAt: r.updatedAt);
  static Notebook _notebook(NotebookRow r) => Notebook(
      id: r.id, name: r.name, bookshelfId: r.bookshelfId, archived: r.archived, updatedAt: r.updatedAt);
  static Section _section(SectionRow r) =>
      Section(id: r.id, notebookId: r.notebookId, name: r.name, updatedAt: r.updatedAt);
  static NotePage _page(PageRow r) => NotePage(
      id: r.id, sectionId: r.sectionId, title: r.title, content: r.content, updatedAt: r.updatedAt);

  static BookshelfRow _shelfRow(Bookshelf b) => BookshelfRow(id: b.id, name: b.name, updatedAt: b.updatedAt);
  static NotebookRow _notebookRow(Notebook n) => NotebookRow(
      id: n.id, bookshelfId: n.bookshelfId, name: n.name, archived: n.archived, updatedAt: n.updatedAt);
  static SectionRow _sectionRow(Section s) =>
      SectionRow(id: s.id, notebookId: s.notebookId, name: s.name, updatedAt: s.updatedAt);
  static PageRow _pageRow(NotePage p) => PageRow(
      id: p.id, sectionId: p.sectionId, title: p.title, content: p.content, updatedAt: p.updatedAt);
}

/// The local DB belongs to one (server, user). Signing in as someone else, or
/// against another server, wipes it first so data never mixes.
Future<void> ensureOwner(LocalRepository repo, String serverUrl, int userId) async {
  final owner = '$serverUrl|$userId';
  if (await repo.meta('owner') == owner) return;
  await repo.wipe();
  await repo.setMeta('owner', owner);
}
