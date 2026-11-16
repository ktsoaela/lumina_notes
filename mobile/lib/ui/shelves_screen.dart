import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../data/models.dart';
import 'notebooks_screen.dart';
import 'repo_list.dart';

class ShelvesScreen extends StatelessWidget {
  const ShelvesScreen({super.key});

  static Future<void> _signOut(BuildContext context, AppServices services) async {
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
  Widget build(BuildContext context) {
    final services = AppScope.of(context);
    final repo = services.repo;
    return HierarchyListScreen<Bookshelf>(
      title: 'Bookshelves',
      kind: EntityKind.bookshelf,
      newLabel: 'New bookshelf',
      icon: Icons.shelves,
      load: repo.bookshelves,
      idOf: (b) => b.id,
      labelOf: (b) => b.name,
      onOpen: (ctx, b) => Navigator.push(
        ctx,
        MaterialPageRoute<void>(builder: (_) => NotebooksScreen(shelf: b)),
      ),
      onCreate: (_, name) => repo.createBookshelf(name),
      actions: [
        IconButton(
          tooltip: 'Sign out',
          icon: const Icon(Icons.logout),
          onPressed: () => _signOut(context, services),
        ),
      ],
    );
  }
}
