import 'package:flutter/material.dart';

import 'page_editor_screen.dart';
import 'shelves_screen.dart';

/// Which page the wide (tablet) layout shows in its editor pane.
class PageSelection extends InheritedNotifier<ValueNotifier<String?>> {
  const PageSelection({super.key, required ValueNotifier<String?> selected, required super.child})
      : super(notifier: selected);

  /// Null on narrow layouts: callers push the editor instead.
  static ValueNotifier<String?>? maybeOf(BuildContext context) =>
      context.getInheritedWidgetOfExactType<PageSelection>()?.notifier;
}

/// Phones: push navigation (shelves → … → editor).
/// Tablets (≥ 840 dp): navigation on the left, editor on the right.
class AdaptiveHome extends StatefulWidget {
  const AdaptiveHome({super.key});

  static const breakpoint = 840.0;
  static const navWidth = 360.0;

  @override
  State<AdaptiveHome> createState() => _AdaptiveHomeState();
}

class _AdaptiveHomeState extends State<AdaptiveHome> {
  final _selected = ValueNotifier<String?>(null);
  final _navKey = GlobalKey<NavigatorState>();

  @override
  void dispose() {
    _selected.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      if (c.maxWidth < AdaptiveHome.breakpoint) return const ShelvesScreen();
      return PageSelection(
        selected: _selected,
        child: Row(children: [
          SizedBox(
            key: const Key('navPane'),
            width: AdaptiveHome.navWidth,
            child: NavigatorPopHandler(
              onPopWithResult: (_) => _navKey.currentState?.maybePop(),
              child: Navigator(
                key: _navKey,
                onGenerateRoute: (_) => MaterialPageRoute<void>(builder: (_) => const ShelvesScreen()),
              ),
            ),
          ),
          const VerticalDivider(width: 1),
          Expanded(
            child: ValueListenableBuilder<String?>(
              valueListenable: _selected,
              builder: (_, id, _) => id == null
                  ? const Scaffold(body: Center(child: Text('Select a page')))
                  : PageEditorScreen(key: ValueKey(id), pageId: id, embedded: true),
            ),
          ),
        ]),
      );
    });
  }
}
