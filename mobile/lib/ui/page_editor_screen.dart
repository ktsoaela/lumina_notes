import 'dart:async';

import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../data/models.dart';
import '../data/notes_repository.dart';
import 'repo_list.dart' show errorMessage;

enum _SaveState { saved, dirty, saving, failed }

/// Markdown page editor. Autosaves 800 ms after the last keystroke and on close.
class PageEditorScreen extends StatefulWidget {
  const PageEditorScreen({super.key, required this.pageId});

  final String pageId;

  static const debounce = Duration(milliseconds: 800);

  @override
  State<PageEditorScreen> createState() => _PageEditorScreenState();
}

class _PageEditorScreenState extends State<PageEditorScreen> {
  final _title = TextEditingController();
  final _content = TextEditingController();
  late NotesRepository _repo;
  NotePage? _page;
  Object? _loadError;
  Timer? _timer;
  _SaveState _state = _SaveState.saved;
  String? _saveError;
  Future<void>? _inFlight;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_page == null && _loadError == null) {
      _repo = AppScope.of(context).repo;
      _load();
    }
  }

  Future<void> _load() async {
    try {
      final p = await _repo.page(widget.pageId);
      if (!mounted) return;
      if (p == null) {
        setState(() => _loadError = 'Page not found');
        return;
      }
      _title.text = p.title;
      _content.text = p.content;
      _title.addListener(_onEdit);
      _content.addListener(_onEdit);
      setState(() => _page = p);
    } catch (e) {
      if (mounted) setState(() => _loadError = errorMessage(e));
    }
  }

  bool get _hasChanges =>
      _page != null && (_title.text != _page!.title || _content.text != _page!.content);

  void _onEdit() {
    if (!_hasChanges) return;
    _timer?.cancel();
    _timer = Timer(PageEditorScreen.debounce, _save);
    if (_state != _SaveState.dirty) setState(() => _state = _SaveState.dirty);
  }

  Future<void> _save() async {
    _timer?.cancel();
    if (!_hasChanges) return;
    await _inFlight; // keep saves ordered
    if (!_hasChanges) return;
    final next = _page!.copyWith(
      title: _title.text.trim().isEmpty ? 'Untitled' : _title.text.trim(),
      content: _content.text,
    );
    if (mounted) setState(() => _state = _SaveState.saving);
    final run = _repo.savePage(next);
    _inFlight = run;
    try {
      await run;
      // Compare against raw text so a trimmed title doesn't look dirty forever.
      _page = next.copyWith(title: _title.text);
      if (mounted) {
        setState(() => _state = _hasChanges ? _SaveState.dirty : _SaveState.saved);
      }
    } catch (e) {
      _saveError = errorMessage(e);
      if (mounted) setState(() => _state = _SaveState.failed);
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    if (_hasChanges) {
      // Fire-and-forget final save when leaving the editor.
      final p = _page!;
      _repo
          .savePage(p.copyWith(
            title: _title.text.trim().isEmpty ? 'Untitled' : _title.text.trim(),
            content: _content.text,
          ))
          .ignore();
    }
    _title.dispose();
    _content.dispose();
    super.dispose();
  }

  String get _statusLabel => switch (_state) {
        _SaveState.saved => 'Saved',
        _SaveState.dirty => 'Unsaved',
        _SaveState.saving => 'Saving…',
        _SaveState.failed => 'Save failed',
      };

  @override
  Widget build(BuildContext context) {
    if (_loadError != null) {
      return Scaffold(appBar: AppBar(), body: Center(child: Text(_loadError.toString())));
    }
    if (_page == null) {
      return Scaffold(appBar: AppBar(), body: const Center(child: CircularProgressIndicator()));
    }
    return Scaffold(
      appBar: AppBar(
        title: TextField(
          key: const Key('pageTitle'),
          controller: _title,
          maxLength: 120,
          style: Theme.of(context).textTheme.titleLarge,
          decoration: const InputDecoration(
            border: InputBorder.none,
            counterText: '',
            hintText: 'Title',
          ),
        ),
        actions: [
          Center(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12),
              child: Tooltip(
                message: _saveError ?? '',
                child: _state == _SaveState.failed
                    ? TextButton(onPressed: _save, child: const Text('Save failed — retry'))
                    : Text(_statusLabel),
              ),
            ),
          ),
        ],
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: TextField(
          key: const Key('pageContent'),
          controller: _content,
          expands: true,
          maxLines: null,
          minLines: null,
          textAlignVertical: TextAlignVertical.top,
          keyboardType: TextInputType.multiline,
          style: const TextStyle(fontFamily: 'monospace', height: 1.4),
          decoration: const InputDecoration(
            border: InputBorder.none,
            hintText: 'Write in Markdown…',
          ),
        ),
      ),
    );
  }
}
