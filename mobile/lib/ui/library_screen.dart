import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../data/models.dart';
import 'book_screen.dart';
import 'connect_screen.dart';
import 'lumina_theme.dart';
import 'repo_list.dart';
import 'settings_screen.dart';
import 'sync_status_chip.dart';

/// Home: bookshelves as chips, books as cards — the desktop Library on a phone/tablet.
class LibraryScreen extends StatefulWidget {
  const LibraryScreen({super.key});

  static Future<void> signOut(BuildContext context) async {
    final services = AppScope.of(context);
    final n = await services.pendingCount();
    if (n > 0 && context.mounted) {
      final ok = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Sign out?'),
          content: Text(n == 1 ? '1 unsynced change will be lost' : '$n unsynced changes will be lost'),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Sign out')),
          ],
        ),
      );
      if (ok != true) return;
    }
    await services.signOut();
  }

  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> {
  String? _shelfId;
  bool _checkedUpdates = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_checkedUpdates) {
      _checkedUpdates = true;
      _maybeNotifyUpdate();
    }
  }

  /// Launch check for a newer release (skipped in tests: autoSync is off there).
  /// With auto-download on, the APK is fetched first and the notice offers Install.
  Future<void> _maybeNotifyUpdate() async {
    final services = AppScope.of(context);
    final settings = services.settings;
    if (!services.autoSync || !(settings.notifyUpdates || settings.autoDownloadUpdates)) return;
    final updates = services.updates;
    final r = await updates.check();
    if (!mounted || r == null || !r.isNewer) return;
    if (settings.autoDownloadUpdates && r.apkUrl != null && !updates.isDownloaded) {
      await updates.download();
      if (!mounted) return;
    }
    final ready = updates.isDownloaded;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      duration: const Duration(seconds: 10),
      content: Text(ready ? 'Lumina v${r.version} is downloaded' : 'Lumina v${r.version} is available'),
      action: ready
          ? SnackBarAction(label: 'Install', onPressed: updates.install)
          : SnackBarAction(
              label: 'View',
              onPressed: () => Navigator.push(
                context,
                MaterialPageRoute<void>(builder: (_) => const SettingsScreen(initialSection: SettingsSection.about)),
              ),
            ),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final services = AppScope.of(context);
    final repo = services.repo;
    return Scaffold(
      appBar: AppBar(
        title: Row(children: [
          Image.asset('assets/logo_mark.png', height: 28, semanticLabel: 'Lumina Notes'),
          const SizedBox(width: 10),
          const Flexible(child: Text('Library', overflow: TextOverflow.ellipsis)),
        ]),
        actions: [
          if (services.sync case final engine?)
            SyncStatusChip(
              engine: engine,
              onSignInAgain: () => Navigator.push(
                context,
                MaterialPageRoute<void>(builder: (_) => const ConnectScreen(reauth: true)),
              ),
            ),
          IconButton(
            tooltip: 'Settings',
            icon: const Icon(Icons.tune),
            onPressed: () => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => const SettingsScreen())),
          ),
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () => LibraryScreen.signOut(context),
          ),
        ],
      ),
      body: RepoBuilder<List<Bookshelf>>(
        load: repo.bookshelves,
        builder: (context, shelves) {
          if (shelves.isEmpty) {
            return _Empty(
              icon: Icons.shelves,
              title: 'Start a bookshelf',
              body: 'Bookshelves hold your books. Create one to begin.',
              action: 'New bookshelf',
              onAction: () => _newShelf(context),
            );
          }
          final shelf = shelves.firstWhere((s) => s.id == _shelfId, orElse: () => shelves.first);
          return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
              child: const Eyebrow('Bookshelves'),
            ),
            SizedBox(
              height: 52,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                children: [
                  for (final s in shelves)
                    Padding(
                      padding: const EdgeInsets.only(right: 8),
                      child: GestureDetector(
                        onLongPress: () => _shelfMenu(context, s),
                        child: ChoiceChip(
                          avatar: const Icon(Icons.shelves, size: 16),
                          label: Text(s.name),
                          selected: s.id == shelf.id,
                          onSelected: (_) => setState(() => _shelfId = s.id),
                        ),
                      ),
                    ),
                  ActionChip(
                    avatar: const Icon(Icons.add, size: 16),
                    label: const Text('Shelf'),
                    tooltip: 'New bookshelf',
                    onPressed: () => _newShelf(context),
                  ),
                ],
              ),
            ),
            Expanded(
              child: RepoBuilder<List<Notebook>>(
                key: ValueKey('books-${shelf.id}'),
                load: () => repo.notebooks(shelf.id),
                builder: (context, books) => _BookGrid(shelf: shelf, books: books),
              ),
            ),
          ]);
        },
      ),
      floatingActionButton: RepoBuilder<List<Bookshelf>>(
        load: repo.bookshelves,
        builder: (context, shelves) => shelves.isEmpty
            ? const SizedBox.shrink()
            : FloatingActionButton.extended(
                key: const Key('fab'),
                icon: const Icon(Icons.add),
                label: const Text('New book'),
                onPressed: () async {
                  final shelf = shelves.firstWhere((s) => s.id == _shelfId, orElse: () => shelves.first);
                  final name = await askName(context, title: 'New book', action: 'Create');
                  if (name == null || !context.mounted) return;
                  await guard(context, () => repo.createNotebook(shelf.id, name));
                },
              ),
      ),
    );
  }

  Future<void> _newShelf(BuildContext context) async {
    final name = await askName(context, title: 'New bookshelf', action: 'Create');
    if (name == null || !context.mounted) return;
    final repo = AppScope.of(context).repo;
    await guard(context, () async {
      final s = await repo.createBookshelf(name);
      if (mounted) setState(() => _shelfId = s.id);
    });
  }

  Future<void> _shelfMenu(BuildContext context, Bookshelf s) async {
    final action = await showItemMenu(context, label: s.name);
    if (action == null || !context.mounted) return;
    await runRenameOrDelete(context, action: action, kind: EntityKind.bookshelf, id: s.id, label: s.name);
  }
}

class _BookGrid extends StatelessWidget {
  const _BookGrid({required this.shelf, required this.books});

  final Bookshelf shelf;
  final List<Notebook> books;

  @override
  Widget build(BuildContext context) {
    if (books.isEmpty) {
      return ListView(children: const [
        SizedBox(height: 80),
        Icon(Icons.menu_book_outlined, size: 40),
        SizedBox(height: 12),
        Center(child: Text('Nothing here yet')),
        SizedBox(height: 4),
        Center(child: Text('Add a book with “New book”.')),
      ]);
    }
    return RefreshIndicator(
      onRefresh: () async => AppScope.of(context).sync?.syncNow(),
      child: LayoutBuilder(builder: (context, c) {
        final cols = (c.maxWidth / 220).floor().clamp(2, 6);
        return GridView.builder(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
          gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: cols,
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 0.78,
          ),
          itemCount: books.length,
          itemBuilder: (_, i) => _BookCard(book: books[i], index: i),
        );
      }),
    );
  }
}

/// A book with a coloured spine, like the desktop shelf.
class _BookCard extends StatelessWidget {
  const _BookCard({required this.book, required this.index});

  final Notebook book;
  final int index;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tint = LuminaColors.chapterTint(index);
    Future<void> menu() async {
      final action = await showItemMenu(context, label: book.name);
      if (action == null || !context.mounted) return;
      await runRenameOrDelete(context, action: action, kind: EntityKind.notebook, id: book.id, label: book.name);
    }

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => Navigator.push(context, MaterialPageRoute<void>(builder: (_) => BookScreen(notebook: book))),
        onLongPress: menu,
        child: Row(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Container(width: 14, color: tint),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 14, 4, 12),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Icon(Icons.menu_book_outlined, color: tint),
                const Spacer(),
                Text(
                  book.name,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleMedium?.copyWith(fontFamily: displayFamily),
                ),
                const SizedBox(height: 4),
                Row(children: [
                  Expanded(
                    child: Text('BOOK',
                        style: theme.textTheme.labelSmall
                            ?.copyWith(letterSpacing: 1.6, color: theme.colorScheme.onSurfaceVariant)),
                  ),
                  IconButton(
                    tooltip: 'Book options',
                    visualDensity: VisualDensity.compact,
                    icon: const Icon(Icons.more_vert, size: 18),
                    onPressed: menu,
                  ),
                ]),
              ]),
            ),
          ),
        ]),
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.icon, required this.title, required this.body, required this.action, required this.onAction});

  final IconData icon;
  final String title;
  final String body;
  final String action;
  final VoidCallback onAction;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 40, color: theme.colorScheme.primary),
          const SizedBox(height: 12),
          Text(title, style: theme.textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(body, textAlign: TextAlign.center, style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
          const SizedBox(height: 16),
          FilledButton.icon(onPressed: onAction, icon: const Icon(Icons.add), label: Text(action)),
        ]),
      ),
    );
  }
}
