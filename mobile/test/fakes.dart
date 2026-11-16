import 'package:lumina_notes/data/api_client.dart';
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
    shelves['bs-1'] = const Bookshelf(id: 'bs-1', name: 'My bookshelf');
    notebooksById['nb-1'] = const Notebook(id: 'nb-1', name: 'Welcome', bookshelfId: 'bs-1');
    sectionsById['sec-1'] = const Section(id: 'sec-1', notebookId: 'nb-1', name: 'Notes');
    final p = NotePage(id: 'page-1', sectionId: 'sec-1', title: 'Getting started', content: content);
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
}
