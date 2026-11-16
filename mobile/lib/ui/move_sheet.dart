import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../data/models.dart';
import 'repo_list.dart';

class MoveDestination {
  const MoveDestination({required this.id, required this.label, required this.sub, required this.shelf});

  /// Section id (moving a page) or notebook id (moving a chapter).
  final String id;
  final String label;
  final String sub;
  final String shelf;
}

/// Every chapter (for pages) or book (for chapters) across all bookshelves.
Future<List<MoveDestination>> loadMoveDestinations(BuildContext context, EntityKind kind) async {
  final repo = AppScope.of(context).repo;
  final out = <MoveDestination>[];
  for (final shelf in await repo.bookshelves()) {
    for (final nb in await repo.notebooks(shelf.id)) {
      if (kind == EntityKind.section) {
        out.add(MoveDestination(id: nb.id, label: nb.name, sub: 'Book', shelf: shelf.name));
      } else {
        for (final s in await repo.sections(nb.id)) {
          out.add(MoveDestination(id: s.id, label: s.name, sub: nb.name, shelf: shelf.name));
        }
      }
    }
  }
  return out;
}

/// Moves a page into another chapter, or a chapter into another book, via a
/// searchable picker. Returns true when something moved.
Future<bool> showMoveSheet(
  BuildContext context, {
  required EntityKind kind,
  required String id,
  required String label,
  required String currentParentId,
}) async {
  final dest = await showModalBottomSheet<MoveDestination>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _MovePicker(kind: kind, label: label, currentParentId: currentParentId),
  );
  if (dest == null || !context.mounted) return false;
  final repo = AppScope.of(context).repo;
  final messenger = ScaffoldMessenger.of(context);
  final ok = await guard(
    context,
    () => kind == EntityKind.page ? repo.movePage(id, dest.id) : repo.moveSection(id, dest.id),
  );
  if (ok) messenger.showSnackBar(SnackBar(content: Text('Moved to “${dest.label}”')));
  return ok;
}

class _MovePicker extends StatefulWidget {
  const _MovePicker({required this.kind, required this.label, required this.currentParentId});

  final EntityKind kind;
  final String label;
  final String currentParentId;

  @override
  State<_MovePicker> createState() => _MovePickerState();
}

class _MovePickerState extends State<_MovePicker> {
  Future<List<MoveDestination>>? _future;
  String _query = '';

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _future ??= loadMoveDestinations(context, widget.kind);
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isPage = widget.kind == EntityKind.page;
    return SafeArea(
      child: SizedBox(
        height: MediaQuery.sizeOf(context).height * 0.7,
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 4),
            child: Text(isPage ? 'Move page' : 'Move chapter', style: theme.textTheme.titleLarge),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Text(
              '“${widget.label}” → choose a ${isPage ? 'chapter' : 'book'}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: TextField(
              key: const Key('moveSearch'),
              decoration: InputDecoration(
                prefixIcon: const Icon(Icons.search),
                hintText: isPage ? 'Find a chapter or book…' : 'Find a book…',
                isDense: true,
              ),
              onChanged: (v) => setState(() => _query = v.trim().toLowerCase()),
            ),
          ),
          Expanded(
            child: FutureBuilder<List<MoveDestination>>(
              future: _future,
              builder: (context, snap) {
                if (snap.hasError) return Center(child: Text(errorMessage(snap.error!)));
                if (!snap.hasData) return const Center(child: CircularProgressIndicator());
                final items = snap.data!
                    .where((d) => _query.isEmpty || '${d.label} ${d.sub} ${d.shelf}'.toLowerCase().contains(_query))
                    .toList();
                if (items.isEmpty) {
                  return Center(child: Text(isPage ? 'No chapters found' : 'No books found'));
                }
                final rows = <Widget>[];
                String? lastShelf;
                for (final d in items) {
                  if (d.shelf != lastShelf) {
                    lastShelf = d.shelf;
                    rows.add(Padding(
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 4),
                      child: Text(
                        d.shelf.toUpperCase(),
                        style: theme.textTheme.labelSmall
                            ?.copyWith(letterSpacing: 2, color: theme.colorScheme.onSurfaceVariant),
                      ),
                    ));
                  }
                  rows.add(ListTile(
                        enabled: d.id != widget.currentParentId,
                        leading: Icon(isPage ? Icons.bookmark_outline : Icons.menu_book_outlined,
                            color: theme.colorScheme.primary),
                        title: Text(d.label),
                        subtitle: Text(d.sub),
                        trailing: d.id == widget.currentParentId ? const Text('Here') : null,
                        onTap: () => Navigator.pop(context, d),
                  ));
                }
                return ListView(padding: const EdgeInsets.symmetric(horizontal: 8), children: rows);
              },
            ),
          ),
        ]),
      ),
    );
  }
}
