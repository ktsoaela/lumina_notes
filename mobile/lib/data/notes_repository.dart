import 'models.dart';

/// What the UI uses to read/write notes. Phase 1: [RemoteRepository] (REST).
/// Phase 2: LocalRepository (Drift + outbox), same interface.
abstract class NotesRepository {
  /// Emits after any mutation (or, later, after sync applies remote changes).
  Stream<void> get changes;

  Future<List<Bookshelf>> bookshelves();
  Future<List<Notebook>> notebooks(String bookshelfId); // non-archived only
  Future<List<Section>> sections(String notebookId);
  Future<List<NotePage>> pages(String sectionId);
  Future<NotePage?> page(String id);

  Future<Bookshelf> createBookshelf(String name);
  Future<Notebook> createNotebook(String bookshelfId, String name);
  Future<Section> createSection(String notebookId, String name);
  Future<NotePage> createPage(String sectionId, String title);

  Future<void> savePage(NotePage page);
  Future<void> rename(EntityKind kind, String id, String name);
  Future<void> delete(EntityKind kind, String id);

  /// Moves a page into another chapter (any book).
  Future<void> movePage(String pageId, String toSectionId);

  /// Moves a chapter, with its pages, into another book.
  Future<void> moveSection(String sectionId, String toNotebookId);
}
