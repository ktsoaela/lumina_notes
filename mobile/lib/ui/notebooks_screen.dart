import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../data/models.dart';
import 'repo_list.dart';
import 'sections_screen.dart';

class NotebooksScreen extends StatelessWidget {
  const NotebooksScreen({super.key, required this.shelf});

  final Bookshelf shelf;

  @override
  Widget build(BuildContext context) {
    final repo = AppScope.of(context).repo;
    return HierarchyListScreen<Notebook>(
      title: shelf.name,
      kind: EntityKind.notebook,
      newLabel: 'New notebook',
      icon: Icons.menu_book_outlined,
      load: () => repo.notebooks(shelf.id),
      idOf: (n) => n.id,
      labelOf: (n) => n.name,
      onOpen: (ctx, n) => Navigator.push(
        ctx,
        MaterialPageRoute<void>(builder: (_) => SectionsScreen(notebook: n)),
      ),
      onCreate: (_, name) => repo.createNotebook(shelf.id, name),
    );
  }
}
