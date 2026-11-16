import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../data/models.dart';
import 'notebooks_screen.dart';
import 'repo_list.dart';

class ShelvesScreen extends StatelessWidget {
  const ShelvesScreen({super.key});

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
          onPressed: services.signOut,
        ),
      ],
    );
  }
}
