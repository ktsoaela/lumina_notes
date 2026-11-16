import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../data/models.dart';
import 'adaptive_home.dart';
import 'page_editor_screen.dart';
import 'repo_list.dart';

class PagesScreen extends StatelessWidget {
  const PagesScreen({super.key, required this.section});

  final Section section;

  static void _openEditor(BuildContext context, String pageId) {
    final selection = PageSelection.maybeOf(context);
    if (selection != null) {
      selection.value = pageId; // tablet: show in the editor pane
      return;
    }
    Navigator.push(
      context,
      MaterialPageRoute<void>(builder: (_) => PageEditorScreen(pageId: pageId)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final repo = AppScope.of(context).repo;
    return HierarchyListScreen<NotePage>(
      title: section.name,
      kind: EntityKind.page,
      newLabel: 'New page',
      icon: Icons.description_outlined,
      load: () => repo.pages(section.id),
      idOf: (p) => p.id,
      labelOf: (p) => p.title,
      onOpen: (ctx, p) => _openEditor(ctx, p.id),
      onCreate: (ctx, title) async {
        final p = await repo.createPage(section.id, title);
        if (ctx.mounted) _openEditor(ctx, p.id);
      },
    );
  }
}
