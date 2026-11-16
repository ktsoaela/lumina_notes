import 'package:drift/drift.dart' show driftRuntimeOptions;
import 'package:drift/native.dart';
import 'package:lumina_notes/data/api_client.dart';
import 'package:lumina_notes/data/local_db.dart';
import 'package:lumina_notes/data/local_repository.dart';
import 'package:lumina_notes/data/models.dart';

/// In-memory stand-in for the FastAPI server.
class FakeApiClient extends ApiClient {
  FakeApiClient({super.baseUrl = 'http://fake'});

  final Map<String, Bookshelf> shelves = {};
  final Map<String, Notebook> notebooksById = {};
  final Map<String, Section> sectionsById = {};
  final Map<String, NotePage> pagesById = {};

  /// When set, login/signup throws this.
  Object? authError;
  bool healthy = true;
  AuthResult authResult =
      const AuthResult(token: 'fake-token', user: User(id: 1, email: 'a@b.co', name: 'A'));

  /// Seeds shelf → notebook → section → page; returns the page.
  NotePage seed({String content = '# Hello'}) {
    final t0 = DateTime.utc(2026, 1, 1);
    shelves['bs-1'] = Bookshelf(id: 'bs-1', name: 'My bookshelf', updatedAt: t0);
    notebooksById['nb-1'] = Notebook(id: 'nb-1', name: 'Welcome', bookshelfId: 'bs-1', updatedAt: t0);
    sectionsById['sec-1'] = Section(id: 'sec-1', notebookId: 'nb-1', name: 'Notes', updatedAt: t0);
    final p = NotePage(
        id: 'page-1', sectionId: 'sec-1', title: 'Getting started', content: content, updatedAt: t0);
    pagesById[p.id] = p;
    return p;
  }

  @override
  Future<bool> health() async => healthy;

  @override
  Future<AuthResult> login(String identifier, String password) async {
    if (authError != null) throw authError!;
    return authResult;
  }

  @override
  Future<AuthResult> signup(
      {required String email, required String password, required String name, String? username}) async {
    if (authError != null) throw authError!;
    return authResult;
  }

  /// When set, pairComplete throws this.
  Object? pairError;
  final List<String> pairedCodes = [];

  @override
  Future<AuthResult> pairComplete(String code, {String? deviceName}) async {
    if (pairError != null) throw pairError!;
    pairedCodes.add(code);
    return authResult;
  }

  @override
  Future<User> me() async => authResult.user;

  @override
  Future<List<Bookshelf>> listBookshelves() async => shelves.values.toList();

  @override
  Future<List<Notebook>> listNotebooks(String bookshelfId) async =>
      notebooksById.values.where((n) => n.bookshelfId == bookshelfId && !n.archived).toList();

  @override
  Future<List<Section>> listSections(String notebookId) async =>
      sectionsById.values.where((s) => s.notebookId == notebookId).toList();

  @override
  Future<List<NotePage>> listPages(String sectionId) async =>
      pagesById.values.where((p) => p.sectionId == sectionId).toList();

  @override
  Future<void> createBookshelf(Bookshelf b) async => shelves[b.id] = b;

  @override
  Future<void> createNotebook(Notebook n) async => notebooksById[n.id] = n;

  @override
  Future<void> createSection(Section s) async => sectionsById[s.id] = s;

  @override
  Future<void> createPage(NotePage p) async => pagesById[p.id] = p;

  @override
  Future<void> renameBookshelf(String id, String name) async =>
      shelves[id] = shelves[id]!.copyWith(name: name);

  @override
  Future<void> renameNotebook(String id, String name) async =>
      notebooksById[id] = notebooksById[id]!.copyWith(name: name);

  @override
  Future<void> renameSection(String id, String name) async =>
      sectionsById[id] = sectionsById[id]!.copyWith(name: name);

  @override
  Future<void> updatePage(NotePage p) async => pagesById[p.id] = p;

  @override
  Future<void> delete(EntityKind kind, String id) async {
    switch (kind) {
      case EntityKind.bookshelf:
        shelves.remove(id);
      case EntityKind.notebook:
        notebooksById.remove(id);
      case EntityKind.section:
        sectionsById.remove(id);
      case EntityKind.page:
        pagesById.remove(id);
    }
  }

  // ---------------------------------------------------------------- sync

  /// Thrown by changes()/push() when set (simulates offline / expired token).
  Object? syncError;

  /// When true, push() "loses" the response: applies nothing, returns no results.
  bool dropPushResponses = false;

  final List<(EntityKind, String, DateTime)> tombstoneLog = [];
  int pushCalls = 0;

  /// Ids the server refuses with a validation error (e.g. content too long).
  final Set<String> invalidIds = {};

  /// Runs at the start of push() (simulates the user typing while a push is in flight).
  Future<void> Function()? beforePush;

  DateTime clock() => DateTime.now().toUtc();

  /// Server-side edit (like Electron) stamped [at] (default: now).
  void serverEditPage(String id, String content, {DateTime? at}) =>
      pagesById[id] = pagesById[id]!.copyWith(content: content, updatedAt: at ?? clock());

  void serverDelete(EntityKind kind, String id) {
    switch (kind) {
      case EntityKind.bookshelf:
        shelves.remove(id);
      case EntityKind.notebook:
        notebooksById.remove(id);
        for (final s in sectionsById.values.where((s) => s.notebookId == id).toList()) {
          serverDelete(EntityKind.section, s.id);
        }
      case EntityKind.section:
        sectionsById.remove(id);
        for (final p in pagesById.values.where((p) => p.sectionId == id).toList()) {
          serverDelete(EntityKind.page, p.id);
        }
      case EntityKind.page:
        pagesById.remove(id);
    }
    tombstoneLog.add((kind, id, clock()));
  }

  @override
  Future<SyncChanges> changes(String? since) async {
    if (syncError != null) throw syncError!;
    final cut = since == null || since.isEmpty ? null : DateTime.parse(since);
    bool fresh(DateTime? t) => cut == null || t == null || !t.isBefore(cut);
    final now = clock();
    return SyncChanges(
      cursor: now.subtract(const Duration(seconds: 5)).toIso8601String(),
      bookshelves: shelves.values.where((x) => fresh(x.updatedAt)).toList(),
      notebooks: notebooksById.values.where((x) => fresh(x.updatedAt)).toList(),
      sections: sectionsById.values.where((x) => fresh(x.updatedAt)).toList(),
      pages: pagesById.values.where((x) => fresh(x.updatedAt)).toList(),
      tombstones: tombstoneLog.where((t) => fresh(t.$3)).map((t) => (t.$1, t.$2)).toList(),
    );
  }

  Map<String, dynamic>? _row(EntityKind k, String id) => switch (k) {
        EntityKind.bookshelf => shelves[id]?.toJson(),
        EntityKind.notebook => notebooksById[id]?.toJson(),
        EntityKind.section => sectionsById[id]?.toJson(),
        EntityKind.page => pagesById[id]?.toJson(),
      };

  bool _parentExists(EntityKind k, Map<String, dynamic> d) => switch (k) {
        EntityKind.bookshelf => true,
        EntityKind.notebook => shelves.containsKey(d['bookshelfId']),
        EntityKind.section => notebooksById.containsKey(d['notebookId']),
        EntityKind.page => sectionsById.containsKey(d['sectionId']),
      };

  @override
  Future<List<PushResult>> push(List<PushOp> ops) async {
    pushCalls++;
    if (syncError != null) throw syncError!;
    await beforePush?.call();
    if (dropPushResponses) return const [];
    final out = <PushResult>[];
    for (final op in ops) {
      final row = _row(op.entity, op.id);
      final serverAt = row == null ? null : parseServerTime(row['updatedAt']);
      Map<String, dynamic>? current() {
        final r = _row(op.entity, op.id);
        return r == null ? null : {'entity': op.entity.wire, ...r};
      }

      final changedSinceBase = op.baseUpdatedAt == null || serverAt == null || serverAt.isAfter(op.baseUpdatedAt!);
      if (serverAt != null && changedSinceBase && serverAt.isAfter(op.clientUpdatedAt)) {
        out.add(PushResult(opId: op.opId, status: 'stale', current: current()));
        continue;
      }
      if (op.op == 'delete') {
        if (row != null) serverDelete(op.entity, op.id);
        out.add(PushResult(opId: op.opId, status: 'applied'));
        continue;
      }
      final d = op.data ?? const {};
      if (invalidIds.contains(op.id)) {
        out.add(PushResult(opId: op.opId, status: 'rejected', detail: 'String should have at most 2000000 characters'));
        continue;
      }
      if (!_parentExists(op.entity, d)) {
        out.add(PushResult(opId: op.opId, status: 'rejected', detail: 'Parent not found', current: current()));
        continue;
      }
      final at = clock();
      switch (op.entity) {
        case EntityKind.bookshelf:
          shelves[op.id] = Bookshelf(id: op.id, name: d['name'] as String, updatedAt: at);
        case EntityKind.notebook:
          notebooksById[op.id] = Notebook(
              id: op.id,
              name: d['name'] as String,
              bookshelfId: d['bookshelfId'] as String,
              archived: d['archived'] == true,
              updatedAt: at);
        case EntityKind.section:
          sectionsById[op.id] =
              Section(id: op.id, notebookId: d['notebookId'] as String, name: d['name'] as String, updatedAt: at);
        case EntityKind.page:
          pagesById[op.id] = NotePage(
              id: op.id,
              sectionId: d['sectionId'] as String,
              title: d['title'] as String,
              content: d['content'] as String,
              updatedAt: at);
      }
      tombstoneLog.removeWhere((t) => t.$1 == op.entity && t.$2 == op.id);
      out.add(PushResult(opId: op.opId, status: 'applied', updatedAt: at));
    }
    return out;
  }
}

/// Fresh in-memory local store for widget tests.
LocalRepository memoryLocal() {
  driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;
  return LocalRepository(LocalDb.forTesting(NativeDatabase.memory()));
}
