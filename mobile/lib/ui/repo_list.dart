import 'dart:async';

import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../data/api_client.dart';
import '../data/local_repository.dart' show RuleException;
import '../data/models.dart';

/// Loads a list from the repository and reloads on every `repo.changes` event
/// and on pull-to-refresh.
class RepoList<T> extends StatefulWidget {
  const RepoList({super.key, required this.load, required this.item});

  final Future<List<T>> Function() load;
  final Widget Function(T item) item;

  @override
  State<RepoList<T>> createState() => _RepoListState<T>();
}

class _RepoListState<T> extends State<RepoList<T>> {
  StreamSubscription<void>? _sub;
  List<T>? _items;
  Object? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_sub == null) {
      _sub = AppScope.of(context).repo.changes.listen((_) => _reload());
      _reload();
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  Future<void> _reload() async {
    try {
      final items = await widget.load();
      if (mounted) {
        setState(() {
          _items = items;
          _error = null;
        });
      }
    } catch (e) {
      if (!mounted) return;
      if (e is ApiException && e.isAuthError) {
        // Token expired or revoked: back to the login screen.
        await AppScope.of(context).signOut();
        return;
      }
      setState(() => _error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = _items;
    if (_error != null && items == null) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(errorMessage(_error!)),
          const SizedBox(height: 8),
          OutlinedButton(onPressed: _reload, child: const Text('Retry')),
        ]),
      );
    }
    if (items == null) return const Center(child: CircularProgressIndicator());
    return RefreshIndicator(
      onRefresh: _reload,
      child: items.isEmpty
          ? ListView(children: const [
              SizedBox(height: 120),
              Center(child: Text('Nothing here yet')),
            ])
          : ListView.builder(
              itemCount: items.length,
              itemBuilder: (_, i) => widget.item(items[i]),
            ),
    );
  }
}

/// User-facing copy for an error from the API / repository.
String errorMessage(Object e) => switch (e) {
      ApiException(:final message) => message,
      NetworkException() => 'Cannot reach server',
      FormatException(:final message) => message,
      RuleException(:final message) => message,
      _ => 'Something went wrong',
    };

/// A screen listing one level of the hierarchy with create / rename / delete.
class HierarchyListScreen<T> extends StatelessWidget {
  const HierarchyListScreen({
    super.key,
    required this.title,
    required this.kind,
    required this.newLabel,
    required this.load,
    required this.idOf,
    required this.labelOf,
    required this.icon,
    required this.onOpen,
    required this.onCreate,
    this.actions,
  });

  final String title;
  final EntityKind kind;
  final String newLabel;
  final Future<List<T>> Function() load;
  final String Function(T) idOf;
  final String Function(T) labelOf;
  final IconData icon;
  final void Function(BuildContext context, T item) onOpen;
  final Future<void> Function(BuildContext context, String name) onCreate;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Row(
          children: [
            Image.asset('assets/logo_mark.png', height: 28, semanticLabel: 'Lumina Notes'),
            const SizedBox(width: 10),
            Flexible(child: Text(title, overflow: TextOverflow.ellipsis)),
          ],
        ),
        actions: actions,
      ),
      body: RepoList<T>(
        load: load,
        item: (item) => ListTile(
          leading: Icon(icon),
          title: Text(labelOf(item)),
          onTap: () => onOpen(context, item),
          onLongPress: () => _itemMenu(context, item),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        key: const Key('fab'),
        icon: const Icon(Icons.add),
        label: Text(newLabel),
        onPressed: () async {
          final name = await askName(context, title: newLabel, action: 'Create');
          if (name == null || !context.mounted) return;
          await _guard(context, () => onCreate(context, name));
        },
      ),
    );
  }

  Future<void> _itemMenu(BuildContext context, T item) async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(
            leading: const Icon(Icons.edit),
            title: const Text('Rename'),
            onTap: () => Navigator.pop(ctx, 'rename'),
          ),
          ListTile(
            leading: const Icon(Icons.delete_outline),
            title: const Text('Delete'),
            onTap: () => Navigator.pop(ctx, 'delete'),
          ),
        ]),
      ),
    );
    if (!context.mounted || choice == null) return;
    final repo = AppScope.of(context).repo;
    if (choice == 'rename') {
      final name = await askName(context, title: 'Rename', action: 'Rename', initial: labelOf(item));
      if (name == null || !context.mounted) return;
      await _guard(context, () => repo.rename(kind, idOf(item), name));
    } else {
      final ok = await confirmDelete(context, labelOf(item));
      if (!ok || !context.mounted) return;
      await _guard(context, () => repo.delete(kind, idOf(item)));
    }
  }
}

Future<void> _guard(BuildContext context, Future<void> Function() action) async {
  final messenger = ScaffoldMessenger.of(context);
  try {
    await action();
  } catch (e) {
    messenger.showSnackBar(SnackBar(content: Text(errorMessage(e))));
  }
}

Future<String?> askName(
  BuildContext context, {
  required String title,
  required String action,
  String initial = '',
}) =>
    showDialog<String>(
      context: context,
      builder: (_) => _NameDialog(title: title, action: action, initial: initial),
    );

/// Owns its controller so it outlives the dialog's exit animation.
class _NameDialog extends StatefulWidget {
  const _NameDialog({required this.title, required this.action, required this.initial});

  final String title;
  final String action;
  final String initial;

  @override
  State<_NameDialog> createState() => _NameDialogState();
}

class _NameDialogState extends State<_NameDialog> {
  late final _ctrl = TextEditingController(text: widget.initial);

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _submit() {
    final v = _ctrl.text.trim();
    if (v.isNotEmpty) Navigator.pop(context, v);
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
        title: Text(widget.title),
        content: TextField(
          key: const Key('nameField'),
          controller: _ctrl,
          autofocus: true,
          maxLength: 120,
          decoration: const InputDecoration(labelText: 'Name'),
          onSubmitted: (_) => _submit(),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(onPressed: _submit, child: Text(widget.action)),
        ],
      );
}

Future<bool> confirmDelete(BuildContext context, String label) async {
  final ok = await showDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text('Delete "$label"?'),
      content: const Text('This also deletes everything inside it.'),
      actions: [
        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
        FilledButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Delete')),
      ],
    ),
  );
  return ok ?? false;
}
