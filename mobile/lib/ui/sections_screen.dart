import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../data/models.dart';
import 'pages_screen.dart';
import 'repo_list.dart';

class SectionsScreen extends StatelessWidget {
  const SectionsScreen({super.key, required this.notebook});

  final Notebook notebook;

  @override
  Widget build(BuildContext context) {
    final repo = AppScope.of(context).repo;
    return HierarchyListScreen<Section>(
      title: notebook.name,
      kind: EntityKind.section,
      newLabel: 'New section',
      icon: Icons.folder_outlined,
      load: () => repo.sections(notebook.id),
      idOf: (s) => s.id,
      labelOf: (s) => s.name,
      onOpen: (ctx, s) => Navigator.push(
        ctx,
        MaterialPageRoute<void>(builder: (_) => PagesScreen(section: s)),
      ),
      onCreate: (_, name) => repo.createSection(notebook.id, name),
    );
  }
}
