import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../data/models.dart';
import 'adaptive_home.dart';
import 'lumina_theme.dart';
import 'move_sheet.dart';
import 'page_editor_screen.dart';
import 'repo_list.dart';

/// Drag payload: a page being moved onto a chapter tab.
class _PageDrag {
  const _PageDrag(this.page);
  final NotePage page;
}

/// One book: chapters as tabs across the top, pages listed below.
/// Tablets (≥ [AdaptiveHome.breakpoint]) keep the page list beside the editor.
class BookScreen extends StatefulWidget {
  const BookScreen({super.key, required this.notebook, this.initialSectionId, this.initialPageId});

  final Notebook notebook;
  final String? initialSectionId;
  final String? initialPageId;

  @override
  State<BookScreen> createState() => _BookScreenState();
}

class _BookScreenState extends State<BookScreen> {
  final _scaffold = GlobalKey<ScaffoldState>();
  String? _sectionId;
  String? _pageId; // tablet editor pane

  @override
  void initState() {
    super.initState();
    _sectionId = widget.initialSectionId;
    _pageId = widget.initialPageId;
  }

  bool _wide(BuildContext context) => MediaQuery.sizeOf(context).width >= AdaptiveHome.breakpoint;

  void _openPage(BuildContext context, String sectionId, String pageId) {
    setState(() => _sectionId = sectionId);
    if (_wide(context)) {
      setState(() => _pageId = pageId);
    } else {
      Navigator.push(context, MaterialPageRoute<void>(builder: (_) => PageEditorScreen(pageId: pageId)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final repo = AppScope.of(context).repo;
    return RepoBuilder<List<Section>>(
      load: () => repo.sections(widget.notebook.id),
      builder: (context, sections) {
        final current = sections.where((s) => s.id == _sectionId).firstOrNull ?? sections.firstOrNull;
        final wide = _wide(context);
        return Scaffold(
          key: _scaffold,
          drawer: BookTreeDrawer(
            notebook: widget.notebook,
            onOpenPage: (nb, sectionId, pageId) {
              Navigator.pop(context); // close drawer
              if (nb.id == widget.notebook.id) {
                _openPage(context, sectionId, pageId);
              } else {
                Navigator.pushReplacement(
                  context,
                  MaterialPageRoute<void>(
                    builder: (_) => BookScreen(notebook: nb, initialSectionId: sectionId, initialPageId: pageId),
                  ),
                );
              }
            },
          ),
          appBar: AppBar(
            leading: const BackButton(),
            titleSpacing: 0,
            title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Eyebrow('Book'),
              Text(widget.notebook.name, overflow: TextOverflow.ellipsis),
            ]),
            actions: [
              IconButton(
                tooltip: 'Book tree',
                icon: const Icon(Icons.account_tree_outlined),
                onPressed: () => _scaffold.currentState?.openDrawer(),
              ),
            ],
            bottom: PreferredSize(
              preferredSize: const Size.fromHeight(50),
              child: _ChapterTabs(
                notebook: widget.notebook,
                sections: sections,
                selectedId: current?.id,
                onSelect: (s) => setState(() {
                  _sectionId = s.id;
                }),
              ),
            ),
          ),
          body: current == null
              ? _NoChapters(notebook: widget.notebook)
              : wide
                  ? Row(children: [
                      SizedBox(
                        key: const Key('navPane'),
                        width: 320,
                        child: _PageList(
                          key: ValueKey('pages-${current.id}'),
                          section: current,
                          selectedPageId: _pageId,
                          onOpen: (p) => _openPage(context, current.id, p.id),
                        ),
                      ),
                      const VerticalDivider(width: 1),
                      Expanded(
                        child: _pageId == null
                            ? const _SelectPage()
                            : PageEditorScreen(key: ValueKey(_pageId), pageId: _pageId!, embedded: true),
                      ),
                    ])
                  : _PageList(
                      key: ValueKey('pages-${current.id}'),
                      section: current,
                      selectedPageId: null,
                      onOpen: (p) => _openPage(context, current.id, p.id),
                    ),
          floatingActionButton: current == null
              ? null
              : FloatingActionButton.extended(
                  key: const Key('fab'),
                  icon: const Icon(Icons.add),
                  label: const Text('New page'),
                  onPressed: () async {
                    final title = await askName(context, title: 'New page', action: 'Create');
                    if (title == null || !context.mounted) return;
                    await guard(context, () async {
                      final p = await repo.createPage(current.id, title);
                      if (context.mounted) _openPage(context, current.id, p.id);
                    });
                  },
                ),
        );
      },
    );
  }
}

/// Chapter tabs. Pages can be dropped onto a tab to move them there.
class _ChapterTabs extends StatelessWidget {
  const _ChapterTabs({required this.notebook, required this.sections, required this.selectedId, required this.onSelect});

  final Notebook notebook;
  final List<Section> sections;
  final String? selectedId;
  final ValueChanged<Section> onSelect;

  @override
  Widget build(BuildContext context) {
    final repo = AppScope.of(context).repo;
    return SizedBox(
      height: 50,
      child: ListView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
        children: [
          for (final (i, s) in sections.indexed)
            _ChapterTab(
              key: Key('chapterTab-${s.id}'),
              section: s,
              tint: LuminaColors.chapterTint(i),
              selected: s.id == selectedId,
              onTap: () => onSelect(s),
              onMenu: () async {
                final action = await showItemMenu(context, label: s.name, moveLabel: 'Move to another book');
                if (action == null || !context.mounted) return;
                if (action == ItemAction.move) {
                  await showMoveSheet(context,
                      kind: EntityKind.section, id: s.id, label: s.name, currentParentId: notebook.id);
                } else {
                  await runRenameOrDelete(context, action: action, kind: EntityKind.section, id: s.id, label: s.name);
                }
              },
              onDropPage: (page) async {
                final messenger = ScaffoldMessenger.of(context);
                final ok = await guard(context, () => repo.movePage(page.id, s.id));
                if (ok) messenger.showSnackBar(SnackBar(content: Text('Moved “${page.title}” to “${s.name}”')));
              },
            ),
          Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: IconButton(
              tooltip: 'New chapter',
              icon: const Icon(Icons.add),
              onPressed: () async {
                final name = await askName(context, title: 'New chapter', action: 'Create');
                if (name == null || !context.mounted) return;
                await guard(context, () async {
                  final s = await repo.createSection(notebook.id, name);
                  onSelect(s);
                });
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _ChapterTab extends StatelessWidget {
  const _ChapterTab({
    super.key,
    required this.section,
    required this.tint,
    required this.selected,
    required this.onTap,
    required this.onMenu,
    required this.onDropPage,
  });

  final Section section;
  final Color tint;
  final bool selected;
  final VoidCallback onTap;
  final VoidCallback onMenu;
  final ValueChanged<NotePage> onDropPage;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DragTarget<_PageDrag>(
      onWillAcceptWithDetails: (d) => d.data.page.sectionId != section.id,
      onAcceptWithDetails: (d) => onDropPage(d.data.page),
      builder: (context, candidates, _) {
        final hovering = candidates.isNotEmpty;
        return Padding(
          padding: const EdgeInsets.only(right: 4),
          child: Material(
            color: selected
                ? theme.colorScheme.surface
                : Color.alphaBlend(tint.withValues(alpha: hovering ? 0.32 : 0.12), theme.scaffoldBackgroundColor),
            shape: RoundedRectangleBorder(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(10)),
              side: BorderSide(color: hovering ? tint : theme.colorScheme.outline),
            ),
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              onTap: onTap,
              onLongPress: onMenu,
              child: Container(
                constraints: const BoxConstraints(minWidth: 64, maxWidth: 200),
                padding: const EdgeInsets.symmetric(horizontal: 14),
                decoration: BoxDecoration(
                  border: Border(top: BorderSide(color: tint, width: selected ? 3 : 2)),
                ),
                alignment: Alignment.center,
                child: Text(
                  section.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.labelLarge?.copyWith(
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    color: selected ? tint : theme.colorScheme.onSurface,
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Pages of one chapter, styled like the desktop sidebar rows.
class _PageList extends StatelessWidget {
  const _PageList({super.key, required this.section, required this.selectedPageId, required this.onOpen});

  final Section section;
  final String? selectedPageId;
  final ValueChanged<NotePage> onOpen;

  @override
  Widget build(BuildContext context) {
    final repo = AppScope.of(context).repo;
    final theme = Theme.of(context);
    return RepoBuilder<List<NotePage>>(
      load: () => repo.pages(section.id),
      builder: (context, pages) => RefreshIndicator(
        onRefresh: () async => AppScope.of(context).sync?.syncNow(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(12, 14, 12, 96),
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 0, 8, 2),
              child: const Eyebrow('Chapter'),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 0, 8, 10),
              child: Text(section.name, style: theme.textTheme.titleLarge),
            ),
            if (pages.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 40),
                child: Center(child: Text('Nothing here yet')),
              ),
            for (final (i, p) in pages.indexed)
              _PageRow(
                page: p,
                index: i + 1,
                selected: p.id == selectedPageId,
                onOpen: () => onOpen(p),
                onMenu: () async {
                  final action =
                      await showItemMenu(context, label: p.title, moveLabel: 'Move to another chapter');
                  if (action == null || !context.mounted) return;
                  if (action == ItemAction.move) {
                    await showMoveSheet(context,
                        kind: EntityKind.page, id: p.id, label: p.title, currentParentId: section.id);
                  } else {
                    await runRenameOrDelete(context, action: action, kind: EntityKind.page, id: p.id, label: p.title);
                  }
                },
              ),
            if (pages.isNotEmpty)
              Padding(
                padding: const EdgeInsets.fromLTRB(8, 16, 8, 0),
                child: Text(
                  'Tip: long-press a page and drop it on a chapter tab to move it.',
                  style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _PageRow extends StatelessWidget {
  const _PageRow({
    required this.page,
    required this.index,
    required this.selected,
    required this.onOpen,
    required this.onMenu,
  });

  final NotePage page;
  final int index;
  final bool selected;
  final VoidCallback onOpen;
  final VoidCallback onMenu;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tile = ListTile(
      dense: true,
      selected: selected,
      leading: Icon(Icons.description_outlined, size: 18, color: selected ? null : theme.colorScheme.onSurfaceVariant),
      title: Row(children: [
        Text(
          '$index.',
          style: TextStyle(
            fontFeatures: const [FontFeature.tabularFigures()],
            color: selected ? null : theme.colorScheme.onSurfaceVariant,
          ),
        ),
        const SizedBox(width: 6),
        Expanded(child: Text(page.title, maxLines: 1, overflow: TextOverflow.ellipsis)),
      ]),
      trailing: IconButton(
        tooltip: 'Page options',
        icon: const Icon(Icons.more_vert, size: 18),
        onPressed: onMenu,
      ),
      onTap: onOpen,
    );
    return LongPressDraggable<_PageDrag>(
      data: _PageDrag(page),
      feedback: Material(
        elevation: 6,
        borderRadius: BorderRadius.circular(20),
        color: theme.colorScheme.primary,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(Icons.description_outlined, size: 16, color: theme.colorScheme.onPrimary),
            const SizedBox(width: 6),
            Text(page.title, style: TextStyle(color: theme.colorScheme.onPrimary)),
          ]),
        ),
      ),
      childWhenDragging: Opacity(opacity: 0.4, child: tile),
      child: Padding(padding: const EdgeInsets.only(bottom: 2), child: tile),
    );
  }
}

class _NoChapters extends StatelessWidget {
  const _NoChapters({required this.notebook});

  final Notebook notebook;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.bookmark_outline, size: 40, color: theme.colorScheme.primary),
        const SizedBox(height: 12),
        Text('No chapters yet', style: theme.textTheme.titleLarge),
        const SizedBox(height: 16),
        FilledButton.icon(
          icon: const Icon(Icons.add),
          label: const Text('First chapter'),
          onPressed: () async {
            final name = await askName(context, title: 'New chapter', action: 'Create');
            if (name == null || !context.mounted) return;
            await guard(context, () => AppScope.of(context).repo.createSection(notebook.id, name));
          },
        ),
      ]),
    );
  }
}

class _SelectPage extends StatelessWidget {
  const _SelectPage();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return ColoredBox(
      color: theme.colorScheme.surface,
      child: Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(Icons.auto_stories_outlined, size: 40, color: theme.colorScheme.onSurfaceVariant),
          const SizedBox(height: 12),
          const Text('Select a page'),
        ]),
      ),
    );
  }
}

/// Book · chapter · page tree for the whole shelf (opened from the book's app bar).
class BookTreeDrawer extends StatelessWidget {
  const BookTreeDrawer({super.key, required this.notebook, required this.onOpenPage});

  final Notebook notebook;
  final void Function(Notebook book, String sectionId, String pageId) onOpenPage;

  @override
  Widget build(BuildContext context) {
    final repo = AppScope.of(context).repo;
    final theme = Theme.of(context);
    return Drawer(
      key: const Key('bookTree'),
      child: SafeArea(
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 4),
            child: const Eyebrow('Quiet spine'),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 12),
            child: Text('Book · chapter · page', style: theme.textTheme.titleLarge),
          ),
          const Divider(),
          Expanded(
            child: RepoBuilder<List<Notebook>>(
              load: () => repo.notebooks(notebook.bookshelfId),
              builder: (context, books) => ListView(
                padding: const EdgeInsets.symmetric(vertical: 8),
                children: [
                  for (final b in books)
                    ExpansionTile(
                      key: PageStorageKey('tree-${b.id}'),
                      initiallyExpanded: b.id == notebook.id,
                      leading: Icon(Icons.menu_book_outlined,
                          color: b.id == notebook.id ? theme.colorScheme.primary : null),
                      title: Text(b.name, style: const TextStyle(fontFamily: displayFamily, fontWeight: FontWeight.w600)),
                      childrenPadding: const EdgeInsets.only(left: 16),
                      children: [
                        RepoBuilder<List<Section>>(
                          load: () => repo.sections(b.id),
                          builder: (context, sections) => Column(children: [
                            for (final s in sections)
                              ExpansionTile(
                                key: PageStorageKey('tree-${s.id}'),
                                leading: const Icon(Icons.bookmark_outline, size: 18),
                                title: Text(s.name),
                                childrenPadding: const EdgeInsets.only(left: 16),
                                children: [
                                  RepoBuilder<List<NotePage>>(
                                    load: () => repo.pages(s.id),
                                    builder: (context, pages) => Column(children: [
                                      for (final p in pages)
                                        ListTile(
                                          dense: true,
                                          leading: const Icon(Icons.description_outlined, size: 16),
                                          title: Text(p.title),
                                          onTap: () => onOpenPage(b, s.id, p.id),
                                        ),
                                      if (pages.isEmpty)
                                        const ListTile(dense: true, title: Text('No pages')),
                                    ]),
                                  ),
                                ],
                              ),
                            if (sections.isEmpty) const ListTile(dense: true, title: Text('No chapters')),
                          ]),
                        ),
                      ],
                    ),
                ],
              ),
            ),
          ),
        ]),
      ),
    );
  }
}
