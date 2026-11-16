import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../data/session_store.dart';
import 'repo_list.dart' show errorMessage;

/// Server URL + login / sign up.
class ConnectScreen extends StatefulWidget {
  const ConnectScreen({super.key});

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
  String? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_url.text.isEmpty) {
      _url.text = AppScope.of(context).session.serverUrl ?? '';
    }
  }

  @override
  void dispose() {
    for (final c in [_url, _identifier, _email, _name, _username, _password]) {
      c.dispose();
    }
    super.dispose();
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

  Future<void> _submit() async {
    final services = AppScope.of(context);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final url = normalizeServerUrl(_url.text);
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
    } catch (e) {
      if (mounted) setState(() => _error = errorMessage(e));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Lumina Notes')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              TextField(
                key: const Key('serverUrl'),
                controller: _url,
                keyboardType: TextInputType.url,
                autocorrect: false,
                decoration: const InputDecoration(
                  labelText: 'Server URL',
                  hintText: 'http://192.168.1.10:58888',
                  helperText: 'The same Lumina API your desktop app uses',
                ),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  key: const Key('testConnection'),
                  onPressed: _busy ? null : _testConnection,
                  child: const Text('Test connection'),
                ),
              ),
              const SizedBox(height: 8),
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
                onSubmitted: (_) => _busy ? null : _submit(),
              ),
              const SizedBox(height: 16),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
                ),
              FilledButton(
                key: const Key('submit'),
                onPressed: _busy ? null : _submit,
                child: _busy
                    ? const SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : Text(_signup ? 'Create account' : 'Log in'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
