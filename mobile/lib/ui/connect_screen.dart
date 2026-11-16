import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../data/pair_link.dart';
import '../data/session_store.dart';
import '../version.dart';
import 'repo_list.dart' show errorMessage;
import 'scan_screen.dart';

/// Returns raw QR text, or null if cancelled. Injected in widget tests (no camera).
typedef QrScanner = Future<String?> Function(BuildContext context);

/// Scan-to-connect first; login / sign up once a server is known.
///
/// The server URL normally comes from the pairing QR shown on desktop
/// (Profile → Devices & sync → Connect phone). Typing it is an advanced fallback.
class ConnectScreen extends StatefulWidget {
  const ConnectScreen({super.key, this.reauth = false, this.scan = ScanScreen.scan});

  /// Opened from "Sign in again": pop on success; local data is kept when the
  /// same user signs back in. Server can't be changed here.
  final bool reauth;

  final QrScanner scan;

  @override
  State<ConnectScreen> createState() => _ConnectScreenState();
}

class _ConnectScreenState extends State<ConnectScreen> {
  final _url = TextEditingController();
  final _identifier = TextEditingController();
  final _email = TextEditingController();
  final _name = TextEditingController();
  final _username = TextEditingController();
  final _password = TextEditingController();

  bool _signup = false;
  bool _busy = false;
  bool _manual = false; // "Enter server manually"
  String? _error;
  bool _prefilled = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_prefilled) {
      _prefilled = true;
      final session = AppScope.of(context).session;
      if (widget.reauth) _identifier.text = session.user?.username ?? session.user?.email ?? '';
    }
  }

  @override
  void dispose() {
    for (final c in [_url, _identifier, _email, _name, _username, _password]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _scan() async {
    final services = AppScope.of(context);
    final raw = await widget.scan(context);
    if (raw == null || !mounted) return;
    final link = parsePairLink(raw);
    if (link == null) {
      setState(() => _error = 'Not a Lumina pairing code');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await services.applyPairLink(link);
    } catch (e) {
      // Server is saved even when the code is rejected: the login form shows below.
      if (mounted) setState(() => _error = '${errorMessage(e)}. Log in, or scan a new code.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _changeServer() async {
    await AppScope.of(context).session.clearServerUrl();
    if (mounted) {
      setState(() {
        _manual = false;
        _error = null;
      });
    }
  }

  Future<void> _testConnection() async {
    final messenger = ScaffoldMessenger.of(context);
    final services = AppScope.of(context);
    String msg;
    try {
      final ok = await services.apiFor(normalizeServerUrl(_url.text)).health();
      msg = ok ? 'Connected' : 'Cannot reach server';
    } catch (e) {
      msg = errorMessage(e);
    }
    messenger.showSnackBar(SnackBar(content: Text(msg)));
  }

  Future<void> _submit(String? savedServer) async {
    final services = AppScope.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final url = savedServer ?? normalizeServerUrl(_url.text);
      final api = services.apiFor(url);
      final auth = _signup
          ? await api.signup(
              email: _email.text.trim(),
              password: _password.text,
              name: _name.text.trim(),
              username: _username.text,
            )
          : await api.login(_identifier.text.trim(), _password.text);
      await services.signIn(url, auth);
      if (widget.reauth && mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final session = AppScope.of(context).session;
    return ListenableBuilder(
      listenable: session,
      builder: (context, _) => _build(context, session.serverUrl),
    );
  }

  Widget _build(BuildContext context, String? server) {
    final theme = Theme.of(context);
    final scheme = theme.colorScheme;
    final showLogin = server != null || _manual;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 480),
            child: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                const SizedBox(height: 24),
                Image.asset(
                  'assets/logo.png',
                  height: 96,
                  filterQuality: FilterQuality.high,
                  semanticLabel: 'Lumina Notes',
                ),
                const SizedBox(height: 12),
                Text(
                  'Lumina Notes',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.headlineSmall?.copyWith(fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 4),
                Text(
                  'Same account. Same server. Phone and desktop.',
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodyMedium?.copyWith(color: scheme.onSurfaceVariant),
                ),
                const SizedBox(height: 28),
                if (!showLogin) ..._scanFirst(context),
                if (showLogin) ..._serverRow(context, server),
                if (showLogin) ..._loginForm(context, server),
                const SizedBox(height: 28),
                Text(
                  'Lumina Notes $appVersionLabel',
                  key: const Key('connectVersion'),
                  textAlign: TextAlign.center,
                  style: theme.textTheme.bodySmall?.copyWith(color: scheme.onSurfaceVariant),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// Shown next to the action that failed (above Log in, or under Scan).
  List<Widget> _errorText(BuildContext context) => [
        if (_error != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(_error!,
                key: const Key('connectError'),
                textAlign: TextAlign.center,
                style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ),
      ];

  List<Widget> _scanFirst(BuildContext context) => [
        FilledButton.icon(
          key: const Key('scanQr'),
          onPressed: _busy ? null : _scan,
          icon: _busy
              ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : const Icon(Icons.qr_code_scanner),
          label: const Text('Scan to connect'),
        ),
        ..._errorText(context),
        const SizedBox(height: 12),
        Text(
          'On your computer, open Profile → Devices & sync → Connect phone, then scan the QR code.',
          textAlign: TextAlign.center,
          style: Theme.of(context).textTheme.bodySmall,
        ),
        const SizedBox(height: 24),
        TextButton(
          key: const Key('manualServer'),
          onPressed: () => setState(() {
            _manual = true;
            _error = null;
          }),
          child: const Text('Enter server manually'),
        ),
      ];

  List<Widget> _serverRow(BuildContext context, String? server) {
    if (server == null) {
      // Advanced: typed server URL.
      return [
        TextField(
          key: const Key('serverUrl'),
          controller: _url,
          keyboardType: TextInputType.url,
          autocorrect: false,
          decoration: const InputDecoration(
            labelText: 'Server URL',
            hintText: 'http://192.168.0.225:58888',
            helperText: 'The same Lumina API your desktop app uses',
          ),
        ),
        Wrap(
          alignment: WrapAlignment.spaceBetween,
          children: [
            TextButton(
              key: const Key('backToScan'),
              onPressed: _busy ? null : () => setState(() => _manual = false),
              child: const Text('Scan instead'),
            ),
            TextButton(
              key: const Key('testConnection'),
              onPressed: _busy ? null : _testConnection,
              child: const Text('Test connection'),
            ),
          ],
        ),
        const SizedBox(height: 8),
      ];
    }
    final host = Uri.tryParse(server)?.authority ?? server;
    return [
      Row(
        children: [
          const Icon(Icons.dns_outlined, size: 18),
          const SizedBox(width: 8),
          Expanded(child: Text(host, key: const Key('serverLabel'), overflow: TextOverflow.ellipsis)),
          if (!widget.reauth) ...[
            TextButton(
              key: const Key('scanAgain'),
              onPressed: _busy ? null : _scan,
              child: const Text('Scan'),
            ),
            TextButton(
              key: const Key('changeServer'),
              onPressed: _busy ? null : _changeServer,
              child: const Text('Change server'),
            ),
          ],
        ],
      ),
      const SizedBox(height: 8),
    ];
  }

  List<Widget> _loginForm(BuildContext context, String? server) => [
        SegmentedButton<bool>(
          segments: const [
            ButtonSegment(value: false, label: Text('Log in')),
            ButtonSegment(value: true, label: Text('Sign up')),
          ],
          selected: {_signup},
          onSelectionChanged: (s) => setState(() {
            _signup = s.first;
            _error = null;
          }),
        ),
        const SizedBox(height: 8),
        if (_signup) ...[
          TextField(
            key: const Key('email'),
            controller: _email,
            keyboardType: TextInputType.emailAddress,
            autocorrect: false,
            decoration: const InputDecoration(labelText: 'Email'),
          ),
          TextField(
            key: const Key('name'),
            controller: _name,
            decoration: const InputDecoration(labelText: 'Name'),
          ),
          TextField(
            key: const Key('username'),
            controller: _username,
            autocorrect: false,
            decoration: const InputDecoration(labelText: 'Username (optional)'),
          ),
        ] else
          TextField(
            key: const Key('identifier'),
            controller: _identifier,
            autocorrect: false,
            decoration: const InputDecoration(labelText: 'Email or username'),
          ),
        TextField(
          key: const Key('password'),
          controller: _password,
          obscureText: true,
          decoration: const InputDecoration(labelText: 'Password'),
          onSubmitted: (_) => _busy ? null : _submit(server),
        ),
        const SizedBox(height: 8),
        ..._errorText(context),
        const SizedBox(height: 8),
        FilledButton(
          key: const Key('submit'),
          onPressed: _busy ? null : () => _submit(server),
          child: _busy
              ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
              : Text(_signup ? 'Create account' : 'Log in'),
        ),
      ];
}
