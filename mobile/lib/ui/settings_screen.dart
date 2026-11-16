import 'package:flutter/material.dart';
import 'package:flutter_markdown_plus/flutter_markdown_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../app_scope.dart';
import '../settings.dart';
import '../updates.dart';
import '../version.dart';
import 'library_screen.dart';
import 'lumina_theme.dart';
import 'page_editor_screen.dart' show readerStyleSheet;

enum SettingsSection { appearance, about }

const _sample = '''## A page heading

Notes read like a **Markdown preview** — calm spacing, `inline code` and lists:

- First thought
- Second thought

> A quiet quote.''';

/// Reading colours offered on mobile (no colour-picker dependency).
const _swatches = <int>[
  0xFF111111, // charcoal
  0xFF375348, // deep sage
  0xFF1F3A5F, // ink blue
  0xFF5B4636, // sepia
  0xFF4A2F4F, // plum
  0xFFF3F3F0, // warm white (dark theme)
  0xFFA3A69F, // soft grey
];

/// Profile-style settings: appearance, reading & writing, about & updates, account.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key, this.initialSection = SettingsSection.appearance});

  final SettingsSection initialSection;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _aboutKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    if (widget.initialSection == SettingsSection.about) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        final ctx = _aboutKey.currentContext;
        if (ctx != null) Scrollable.ensureVisible(ctx, duration: const Duration(milliseconds: 300));
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final services = AppScope.of(context);
    final settings = services.settings;
    final user = services.session.user;
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ListenableBuilder(
        listenable: settings,
        builder: (context, _) => ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 40),
          children: [
            Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 720),
                child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
                  _ProfileHeader(name: user?.name ?? '', handle: user?.username ?? user?.email ?? ''),
                  const SizedBox(height: 16),
                  _Panel(title: 'Appearance', children: [
                    const _Label('Theme'),
                    SegmentedButton<ThemeMode>(
                      segments: const [
                        ButtonSegment(value: ThemeMode.system, icon: Icon(Icons.brightness_auto_outlined), label: Text('System')),
                        ButtonSegment(value: ThemeMode.light, icon: Icon(Icons.light_mode_outlined), label: Text('Light')),
                        ButtonSegment(value: ThemeMode.dark, icon: Icon(Icons.dark_mode_outlined), label: Text('Dark')),
                      ],
                      selected: {settings.themeMode},
                      onSelectionChanged: (s) => settings.update(themeMode: s.first),
                    ),
                  ]),
                  const SizedBox(height: 16),
                  _ReadingPanel(settings: settings),
                  const SizedBox(height: 16),
                  _AboutPanel(key: _aboutKey, settings: settings, updates: services.updates),
                  const SizedBox(height: 16),
                  _Panel(title: 'Account', children: [
                    Text(user?.email ?? '', style: TextStyle(color: Theme.of(context).colorScheme.onSurfaceVariant)),
                    const SizedBox(height: 4),
                    Text(services.session.serverUrl ?? '',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: Theme.of(context).colorScheme.onSurfaceVariant,
                            )),
                    const SizedBox(height: 12),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: OutlinedButton.icon(
                        icon: const Icon(Icons.logout),
                        label: const Text('Sign out'),
                        onPressed: () async {
                          final nav = Navigator.of(context);
                          await LibraryScreen.signOut(context);
                          if (!services.isSignedIn) nav.popUntil((r) => r.isFirst);
                        },
                      ),
                    ),
                  ]),
                ]),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ProfileHeader extends StatelessWidget {
  const _ProfileHeader({required this.name, required this.handle});

  final String name;
  final String handle;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
        child: Column(children: [
          CircleAvatar(
            radius: 28,
            backgroundColor: theme.colorScheme.secondaryContainer,
            child: Text(
              name.isEmpty ? '·' : name.characters.first.toUpperCase(),
              style: theme.textTheme.titleLarge?.copyWith(color: theme.colorScheme.primary),
            ),
          ),
          const SizedBox(height: 10),
          Text(name, style: theme.textTheme.titleLarge),
          if (handle.isNotEmpty)
            Text(handle.contains('@') ? handle : '@$handle',
                style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
          const SizedBox(height: 10),
          Chip(
            key: const Key('appVersion'),
            avatar: const Icon(Icons.info_outline, size: 16),
            label: const Text('Lumina Notes $appVersionLabel'),
          ),
        ]),
      ),
    );
  }
}

class _ReadingPanel extends StatelessWidget {
  const _ReadingPanel({required this.settings});

  final AppSettings settings;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return _Panel(
      title: 'Reading & writing',
      trailing: TextButton.icon(
        icon: const Icon(Icons.restart_alt, size: 18),
        label: const Text('Reset'),
        onPressed: settings.reset,
      ),
      children: [
        Text('Font style, size, and colour for your pages — editor and preview.',
            style: TextStyle(color: theme.colorScheme.onSurfaceVariant)),
        const SizedBox(height: 16),
        const _Label('Font style'),
        DropdownButtonFormField<ReaderFont>(
          key: const Key('readerFont'),
          initialValue: settings.font,
          isExpanded: true,
          items: [
            for (final f in ReaderFont.values)
              DropdownMenuItem(
                value: f,
                child: Text(f.label, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: f.family)),
              ),
          ],
          onChanged: (f) => settings.update(font: f),
        ),
        const SizedBox(height: 16),
        _Label('Font size · ${settings.fontSize.round()}px'),
        Slider(
          key: const Key('readerSize'),
          min: AppSettings.minSize,
          max: AppSettings.maxSize,
          divisions: (AppSettings.maxSize - AppSettings.minSize).round(),
          value: settings.fontSize,
          label: '${settings.fontSize.round()}px',
          onChanged: (v) => settings.update(fontSize: v),
        ),
        const SizedBox(height: 8),
        const _Label('Font colour'),
        Wrap(spacing: 8, runSpacing: 8, crossAxisAlignment: WrapCrossAlignment.center, children: [
          ChoiceChip(
            label: const Text('Match theme'),
            selected: settings.fontColor == null,
            onSelected: (_) => settings.update(clearFontColor: true),
          ),
          for (final c in _swatches)
            InkResponse(
              onTap: () => settings.update(fontColor: c),
              radius: 22,
              child: Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: Color(c),
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: settings.fontColor == c ? theme.colorScheme.primary : theme.colorScheme.outline,
                    width: settings.fontColor == c ? 3 : 1,
                  ),
                ),
              ),
            ),
        ]),
        if (!settings.fontColorReadableOn(theme.colorScheme.surface))
          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              'Too faint on this theme — using the theme colour instead.',
              key: const Key('contrastWarning'),
              style: TextStyle(color: theme.colorScheme.error),
            ),
          ),
        const SizedBox(height: 16),
        const _Label('Preview'),
        Container(
          decoration: BoxDecoration(
            color: theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: theme.colorScheme.outline),
          ),
          child: MarkdownBody(
            data: _sample,
            styleSheet: readerStyleSheet(context, settings).copyWith(
              blockquotePadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            ),
          ).paddedAll(16),
        ),
      ],
    );
  }
}

class _AboutPanel extends StatefulWidget {
  const _AboutPanel({super.key, required this.settings, required this.updates});

  final AppSettings settings;
  final UpdateService updates;

  @override
  State<_AboutPanel> createState() => _AboutPanelState();
}

class _AboutPanelState extends State<_AboutPanel> {
  Future<void> _open(String url) async {
    final ok = await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    if (!ok && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not open the browser')));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final muted = TextStyle(color: theme.colorScheme.onSurfaceVariant);
    final u = widget.updates;
    return ListenableBuilder(
      listenable: u,
      builder: (context, _) {
        final latest = u.latest;
        return _Panel(
          title: 'About & updates',
          children: [
            Row(children: [
              Expanded(child: _Stat(label: 'Installed', value: 'v$appVersion', sub: 'build $appBuild')),
              const SizedBox(width: 12),
              Expanded(
                child: _Stat(
                  label: 'Latest release',
                  value: u.checking ? '…' : latest != null ? 'v${latest.version}' : '—',
                ),
              ),
            ]),
            const SizedBox(height: 12),
            if (u.error != null) Text(u.error!, style: TextStyle(color: theme.colorScheme.error)),
            if (latest != null && !u.checking)
              if (latest.isNewer)
                Container(
                  key: const Key('updateAvailable'),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.secondaryContainer,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Lumina Notes v${latest.version} is available.', style: theme.textTheme.titleSmall),
                    const SizedBox(height: 4),
                    Text(
                      latest.apkUrl == null
                          ? 'No Android build in this release — see the release notes.'
                          : u.isDownloaded
                              ? 'Downloaded. Install now — Android will ask you to confirm.'
                              : 'Download inside Lumina, then install. Android asks you to confirm.',
                      style: muted,
                    ),
                    if (u.downloading) ...[
                      const SizedBox(height: 10),
                      LinearProgressIndicator(value: u.progress == 0 ? null : u.progress),
                      const SizedBox(height: 4),
                      Text('Downloading… ${((u.progress ?? 0) * 100).round()}%', style: muted),
                    ],
                    const SizedBox(height: 10),
                    Wrap(spacing: 8, runSpacing: 8, children: [
                      if (latest.apkUrl != null && u.isDownloaded)
                        FilledButton.icon(
                          key: const Key('installUpdate'),
                          icon: const Icon(Icons.system_update),
                          label: const Text('Install now'),
                          onPressed: u.install,
                        )
                      else if (latest.apkUrl != null)
                        FilledButton.icon(
                          key: const Key('downloadUpdate'),
                          icon: const Icon(Icons.download),
                          label: const Text('Download update'),
                          onPressed: u.downloading ? null : u.download,
                        ),
                      OutlinedButton.icon(
                        icon: const Icon(Icons.open_in_new),
                        label: const Text('Release notes'),
                        onPressed: () => _open(latest.pageUrl),
                      ),
                      if (latest.apkUrl != null && !u.isDownloaded)
                        TextButton(
                          onPressed: () => _open(latest.apkUrl!),
                          child: const Text('Use browser instead'),
                        ),
                    ]),
                  ]),
                )
              else
                Row(children: [
                  Icon(Icons.check_circle_outline, color: theme.colorScheme.primary, size: 18),
                  const SizedBox(width: 6),
                  const Text("You're on the latest version."),
                ]),
            const SizedBox(height: 12),
            Wrap(spacing: 8, runSpacing: 8, children: [
              OutlinedButton.icon(
                key: const Key('checkUpdates'),
                icon: const Icon(Icons.refresh),
                label: const Text('Check for updates'),
                onPressed: u.checking ? null : u.check,
              ),
              OutlinedButton.icon(
                icon: const Icon(Icons.open_in_new),
                label: const Text('All releases'),
                onPressed: () => _open(releasesPage),
              ),
            ]),
            const SizedBox(height: 8),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Tell me about new versions'),
              subtitle: const Text('Check for a newer release when Lumina opens.'),
              value: widget.settings.notifyUpdates,
              onChanged: (v) => widget.settings.update(notifyUpdates: v),
            ),
            SwitchListTile(
              key: const Key('autoDownloadSwitch'),
              contentPadding: EdgeInsets.zero,
              title: const Text('Download updates automatically'),
              subtitle: const Text('Fetch the new APK in the background. Installing always asks first.'),
              value: widget.settings.autoDownloadUpdates,
              onChanged: (v) => widget.settings.update(autoDownloadUpdates: v),
            ),
          ],
        );
      },
    );
  }
}

class _Panel extends StatelessWidget {
  const _Panel({required this.title, required this.children, this.trailing});

  final String title;
  final List<Widget> children;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              Expanded(child: Text(title, style: Theme.of(context).textTheme.titleLarge)),
              ?trailing,
            ]),
            const SizedBox(height: 12),
            ...children,
          ]),
        ),
      );
}

class _Label extends StatelessWidget {
  const _Label(this.text);

  final String text;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(text,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                )),
      );
}

class _Stat extends StatelessWidget {
  const _Stat({required this.label, required this.value, this.sub});

  final String label;
  final String value;
  final String? sub;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: theme.colorScheme.secondaryContainer.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: theme.colorScheme.outline),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Eyebrow(label),
        const SizedBox(height: 4),
        Text(value, style: theme.textTheme.titleLarge),
        if (sub != null)
          Text(sub!, style: theme.textTheme.bodySmall?.copyWith(color: theme.colorScheme.onSurfaceVariant)),
      ]),
    );
  }
}

extension on Widget {
  Widget paddedAll(double v) => Padding(padding: EdgeInsets.all(v), child: this);
}
