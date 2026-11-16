import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';

import '../app_scope.dart';
import '../data/models.dart';
import '../data/notes_repository.dart';
import '../settings.dart';
import 'lumina_theme.dart';
import 'repo_list.dart' show errorMessage;

enum _SaveState { saved, dirty, saving, failed }

/// Markdown page editor with an Edit / Preview toggle.
///
/// Autosaves 800 ms after the last keystroke and on close. When sync brings a
/// newer version of this page and there are no unsaved local edits, the
/// editor shows it.
class PageEditorScreen extends StatefulWidget {
  const PageEditorScreen({super.key, required this.pageId, this.embedded = false});

  final String pageId;

  /// Shown in the tablet editor pane (no back button).
  final bool embedded;

  static const debounce = Duration(milliseconds: 800);

  @override
  State<PageEditorScreen> createState() => _PageEditorScreenState();
}

class _PageEditorScreenState extends State<PageEditorScreen> {
  final _title = TextEditingController();
  final _content = TextEditingController();
  late NotesRepository _repo;
  StreamSubscription<void>? _changesSub;
  NotePage? _page;
  Object? _loadError;
  Timer? _timer;
  _SaveState _state = _SaveState.saved;
  String? _saveError;
  Future<void>? _inFlight;
  bool _preview = false;
  bool _deleted = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_changesSub == null) {
      _repo = AppScope.of(context).repo;
      _changesSub = _repo.changes.listen((_) => _refreshFromStore());
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

  /// Sync (or another screen) changed the store: adopt a newer stored version
  /// unless the user has unsaved edits.
  Future<void> _refreshFromStore() async {
    final current = _page;
    if (current == null || _hasChanges || _state == _SaveState.saving) return;
    final p = await _repo.page(widget.pageId);
    if (!mounted) return;
    if (p == null) {
      setState(() => _deleted = true);
      return;
    }
    if (p.title == current.title && p.content == current.content) return;
    _page = p; // set first so the controller listeners don't see "changes"
    _title.text = p.title;
    _content.text = p.content;
    setState(() {});
  }

  bool get _hasChanges =>
      _page != null && (_title.text != _page!.title || _content.text != _page!.content);

  void _onEdit() {
    if (!_hasChanges) return;
    _timer?.cancel();
    _timer = Timer(PageEditorScreen.debounce, _save);
    if (_state != _SaveState.dirty) setState(() => _state = _SaveState.dirty);
  }

  NotePage _draft() => _page!.copyWith(
        title: _title.text.trim().isEmpty ? 'Untitled' : _title.text.trim(),
        content: _content.text,
      );

  Future<void> _save() async {
    _timer?.cancel();
    if (!_hasChanges || _deleted) return;
    await _inFlight; // keep saves ordered
    if (!_hasChanges) return;
    final next = _draft();
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
    _changesSub?.cancel();
    if (_hasChanges && !_deleted) {
      // Fire-and-forget final save when leaving the editor.
      _repo.savePage(_draft()).ignore();
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
    final leading = widget.embedded ? const SizedBox.shrink() : null;
    if (_loadError != null) {
      return Scaffold(
        appBar: AppBar(automaticallyImplyLeading: !widget.embedded),
        body: Center(child: Text(_loadError.toString())),
      );
    }
    if (_page == null) {
      return Scaffold(
        appBar: AppBar(automaticallyImplyLeading: !widget.embedded),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: !widget.embedded,
        leading: leading,
        leadingWidth: widget.embedded ? 0 : null,
        title: TextField(
          key: const Key('pageTitle'),
          controller: _title,
          maxLength: 120,
          readOnly: _deleted,
          style: Theme.of(context).textTheme.titleLarge,
          decoration: const InputDecoration(
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            filled: false,
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
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(48),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: SegmentedButton<bool>(
              segments: const [
                ButtonSegment(value: false, icon: Icon(Icons.edit_outlined), label: Text('Edit')),
                ButtonSegment(value: true, icon: Icon(Icons.visibility_outlined), label: Text('Preview')),
              ],
              selected: {_preview},
              onSelectionChanged: (s) => setState(() => _preview = s.first),
            ),
          ),
        ),
      ),
      body: Column(children: [
        if (_deleted)
          MaterialBanner(
            content: const Text('This page was deleted on another device.'),
            actions: [
              if (!widget.embedded)
                TextButton(onPressed: () => Navigator.maybePop(context), child: const Text('Close')),
              if (widget.embedded) const SizedBox.shrink(),
            ],
          ),
        Expanded(child: _preview ? _buildPreview() : _buildEditor()),
      ]),
    );
  }

  AppSettings get _settings => AppScope.of(context).settings;

  /// Centred reading column, like the desktop / VS Code preview.
  Widget _paper(Widget child) => ColoredBox(
        color: Theme.of(context).colorScheme.surface,
        child: Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(constraints: const BoxConstraints(maxWidth: 760), child: child),
        ),
      );

  Widget _buildEditor() => _paper(Padding(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
        child: TextField(
          key: const Key('pageContent'),
          controller: _content,
          readOnly: _deleted,
          expands: true,
          maxLines: null,
          minLines: null,
          textAlignVertical: TextAlignVertical.top,
          keyboardType: TextInputType.multiline,
          style: _settings.readerStyle(Theme.of(context).colorScheme),
          decoration: const InputDecoration(
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            filled: false,
            hintText: 'Write in Markdown…',
          ),
        ),
      ));

  // Mermaid/Plotly fences render as plain code blocks on mobile (v1).
  Widget _buildPreview() => _content.text.trim().isEmpty
      ? const Center(child: Text('Nothing to preview'))
      : _paper(Markdown(
          key: const Key('pagePreview'),
          data: _content.text,
          selectable: true,
          padding: const EdgeInsets.fromLTRB(24, 20, 24, 48),
          styleSheet: readerStyleSheet(context, _settings),
        ));
}

/// Markdown styles modelled on VS Code's preview, using the reader settings.
MarkdownStyleSheet readerStyleSheet(BuildContext context, AppSettings settings) {
  final theme = Theme.of(context);
  final scheme = theme.colorScheme;
  final body = settings.readerStyle(scheme);
  final size = settings.fontSize;
  final heading = body.copyWith(
    fontFamily: settings.font == ReaderFont.lumina ? displayFamily : body.fontFamily,
    fontWeight: FontWeight.w600,
    height: 1.25,
  );
  final codeBg = scheme.onSurface.withValues(alpha: 0.06);
  return MarkdownStyleSheet.fromTheme(theme).copyWith(
    p: body,
    pPadding: EdgeInsets.only(bottom: size * 0.5),
    h1: heading.copyWith(fontSize: size * 2),
    h1Padding: EdgeInsets.only(top: size * 0.8, bottom: size * 0.3),
    h2: heading.copyWith(fontSize: size * 1.5),
    h2Padding: EdgeInsets.only(top: size * 0.8, bottom: size * 0.3),
    h3: heading.copyWith(fontSize: size * 1.25),
    h4: heading.copyWith(fontSize: size),
    h5: heading.copyWith(fontSize: size * 0.875),
    h6: heading.copyWith(fontSize: size * 0.85, color: scheme.onSurfaceVariant),
    blockSpacing: size * 0.9,
    listIndent: size * 1.6,
    listBullet: body,
    a: body.copyWith(color: scheme.primary, decoration: TextDecoration.none),
    strong: body.copyWith(fontWeight: FontWeight.w600),
    em: body.copyWith(fontStyle: FontStyle.italic),
    code: body.copyWith(fontFamily: 'monospace', fontSize: size * 0.875, backgroundColor: codeBg),
    codeblockPadding: EdgeInsets.all(size),
    codeblockDecoration: BoxDecoration(
      color: codeBg,
      borderRadius: BorderRadius.circular(6),
      border: Border.all(color: scheme.outline.withValues(alpha: 0.6)),
    ),
    blockquote: body.copyWith(color: scheme.onSurfaceVariant),
    blockquotePadding: EdgeInsets.symmetric(horizontal: size, vertical: size * 0.25),
    blockquoteDecoration: BoxDecoration(border: Border(left: BorderSide(color: scheme.outline, width: 4))),
    horizontalRuleDecoration: BoxDecoration(border: Border(top: BorderSide(color: scheme.outline, width: 2))),
    tableHead: body.copyWith(fontWeight: FontWeight.w600),
    tableBody: body,
    tableBorder: TableBorder.all(color: scheme.outline),
    tableCellsPadding: EdgeInsets.symmetric(horizontal: size * 0.85, vertical: size * 0.4),
  );
}
