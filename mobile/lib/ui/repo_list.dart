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
      onRefresh: () async {
        await AppScope.of(context).sync?.syncNow();
        await _reload();
      },
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

enum ItemAction { rename, move, delete }

/// Bottom sheet with Rename / Move to… / Delete for a book, chapter or page.
Future<ItemAction?> showItemMenu(BuildContext context, {required String label, String? moveLabel}) =>
    showModalBottomSheet<ItemAction>(
      context: context,
      builder: (ctx) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 0, 24, 8),
            child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(ctx).textTheme.titleMedium),
          ),
          ListTile(
            leading: const Icon(Icons.edit_outlined),
            title: const Text('Rename'),
            onTap: () => Navigator.pop(ctx, ItemAction.rename),
          ),
          if (moveLabel != null)
            ListTile(
              leading: const Icon(Icons.drive_file_move_outline),
              title: Text(moveLabel),
              onTap: () => Navigator.pop(ctx, ItemAction.move),
            ),
          ListTile(
            leading: const Icon(Icons.delete_outline),
            title: const Text('Delete'),
            onTap: () => Navigator.pop(ctx, ItemAction.delete),
          ),
        ]),
      ),
    );

/// Runs [action]; shows its error as a snack bar instead of throwing.
Future<bool> guard(BuildContext context, Future<void> Function() action) async {
  final messenger = ScaffoldMessenger.of(context);
  try {
    await action();
    return true;
  } catch (e) {
    messenger.showSnackBar(SnackBar(content: Text(errorMessage(e))));
    return false;
  }
}

/// Rename or delete flow shared by books, chapters and pages.
Future<void> runRenameOrDelete(
  BuildContext context, {
  required ItemAction action,
  required EntityKind kind,
  required String id,
  required String label,
}) async {
  final repo = AppScope.of(context).repo;
  if (action == ItemAction.rename) {
    final name = await askName(context, title: 'Rename', action: 'Rename', initial: label);
    if (name == null || !context.mounted) return;
    await guard(context, () => repo.rename(kind, id, name));
  } else if (action == ItemAction.delete) {
    final ok = await confirmDelete(context, label);
    if (!ok || !context.mounted) return;
    await guard(context, () => repo.delete(kind, id));
  }
}

/// Loads with [load] and rebuilds after every repository change.
/// Give it a new `key` when what [load] fetches changes (e.g. another chapter).
class RepoBuilder<T> extends StatefulWidget {
  const RepoBuilder({super.key, required this.load, required this.builder});

  final Future<T> Function() load;
  final Widget Function(BuildContext context, T data) builder;

  @override
  State<RepoBuilder<T>> createState() => _RepoBuilderState<T>();
}

class _RepoBuilderState<T> extends State<RepoBuilder<T>> {
  StreamSubscription<void>? _sub;
  T? _data;
  bool _loaded = false;
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
      final d = await widget.load();
      if (mounted) {
        setState(() {
          _data = d;
          _loaded = true;
          _error = null;
        });
      }
    } catch (e) {
      if (!mounted) return;
      if (e is ApiException && e.isAuthError) {
        await AppScope.of(context).signOut();
        return;
      }
      setState(() => _error = e);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_error != null && !_loaded) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Text(errorMessage(_error!)),
          const SizedBox(height: 8),
          OutlinedButton(onPressed: _reload, child: const Text('Retry')),
        ]),
      );
    }
    if (!_loaded) return const Center(child: CircularProgressIndicator());
    return widget.builder(context, _data as T);
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
