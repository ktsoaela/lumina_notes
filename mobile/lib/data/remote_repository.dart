import 'dart:async';

import 'api_client.dart';
import 'ids.dart';
import 'models.dart';
import 'notes_repository.dart';

/// Online-only repository: every call goes straight to the API.
class RemoteRepository implements NotesRepository {
  RemoteRepository(this.api);

  final ApiClient api;
  final _changes = StreamController<void>.broadcast();

  /// The server has no "get page by id"; remember pages we've listed.
  final Map<String, NotePage> _pageCache = {};

  @override
  Stream<void> get changes => _changes.stream;

  void _changed() => _changes.add(null);

  @override
  Future<List<Bookshelf>> bookshelves() => api.listBookshelves();

  @override
  Future<List<Notebook>> notebooks(String bookshelfId) async =>
      (await api.listNotebooks(bookshelfId)).where((n) => !n.archived).toList();

  @override
  Future<List<Section>> sections(String notebookId) => api.listSections(notebookId);

  @override
  Future<List<NotePage>> pages(String sectionId) async {
    final list = await api.listPages(sectionId);
    for (final p in list) {
      _pageCache[p.id] = p;
    }
    return list;
  }

  @override
  Future<NotePage?> page(String id) async {
    final cached = _pageCache[id];
    if (cached == null) return null;
    // Refresh from the server so the editor opens the latest content.
    final fresh = await pages(cached.sectionId);
    return fresh.where((p) => p.id == id).firstOrNull;
  }

  @override
  Future<Bookshelf> createBookshelf(String name) async {
    final b = Bookshelf(id: newId(EntityKind.bookshelf), name: name);
    await api.createBookshelf(b);
    _changed();
    return b;
  }

  @override
  Future<Notebook> createNotebook(String bookshelfId, String name) async {
    final n = Notebook(id: newId(EntityKind.notebook), name: name, bookshelfId: bookshelfId);
    await api.createNotebook(n);
    _changed();
    return n;
  }

  @override
  Future<Section> createSection(String notebookId, String name) async {
    final s = Section(id: newId(EntityKind.section), notebookId: notebookId, name: name);
    await api.createSection(s);
    _changed();
    return s;
  }

  @override
  Future<NotePage> createPage(String sectionId, String title) async {
    final p = NotePage(id: newId(EntityKind.page), sectionId: sectionId, title: title, content: '');
    await api.createPage(p);
    _pageCache[p.id] = p;
    _changed();
    return p;
  }

  @override
  Future<void> savePage(NotePage page) async {
    await api.updatePage(page);
    _pageCache[page.id] = page;
    _changed();
  }

  @override
  Future<void> rename(EntityKind kind, String id, String name) async {
    switch (kind) {
      case EntityKind.bookshelf:
        await api.renameBookshelf(id, name);
      case EntityKind.notebook:
        await api.renameNotebook(id, name);
      case EntityKind.section:
        await api.renameSection(id, name);
      case EntityKind.page:
        final p = _pageCache[id];
        if (p == null) throw StateError('Unknown page $id');
        await api.updatePage(p.copyWith(title: name));
        _pageCache[id] = p.copyWith(title: name);
    }
    _changed();
  }

  @override
  Future<void> delete(EntityKind kind, String id) async {
    await api.delete(kind, id);
    _pageCache.remove(id);
    _changed();
  }
}
