import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'models.dart';

abstract class KeyValueSecureStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class FlutterSecureKeyValueStore implements KeyValueSecureStore {
  FlutterSecureKeyValueStore([FlutterSecureStorage? storage])
      : _s = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _s;

  @override
  Future<String?> read(String key) => _s.read(key: key);

  @override
  Future<void> write(String key, String value) => _s.write(key: key, value: value);

  @override
  Future<void> delete(String key) => _s.delete(key: key);
}

class MemoryKeyValueStore implements KeyValueSecureStore {
  final Map<String, String> values = {};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async => values[key] = value;

  @override
  Future<void> delete(String key) async => values.remove(key);
}

/// Trim, default to http://, drop trailing slashes. Throws [FormatException] if unusable.
String normalizeServerUrl(String input) {
  var s = input.trim();
  if (s.isEmpty) throw const FormatException('Enter a valid server URL');
  if (!s.contains('://')) s = 'http://$s';
  s = s.replaceAll(RegExp(r'/+$'), '');
  final uri = Uri.tryParse(s);
  if (uri == null || !(uri.scheme == 'http' || uri.scheme == 'https') || uri.host.isEmpty) {
    throw const FormatException('Enter a valid server URL');
  }
  return s;
}

/// Server URL + JWT + signed-in user, persisted in secure storage.
class SessionStore extends ChangeNotifier {
  SessionStore(this._kv);

  final KeyValueSecureStore _kv;

  static const _kUrl = 'lumina.serverUrl';
  static const _kToken = 'lumina.token';
  static const _kUser = 'lumina.user';

  String? serverUrl;
  String? token;
  User? user;

  bool get isSignedIn => serverUrl != null && token != null && user != null;

  Future<void> load() async {
    serverUrl = await _kv.read(_kUrl);
    token = await _kv.read(_kToken);
    final raw = await _kv.read(_kUser);
    try {
      user = raw == null ? null : User.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      user = null;
    }
    notifyListeners();
  }

  Future<void> saveServerUrl(String url) async {
    serverUrl = normalizeServerUrl(url);
    await _kv.write(_kUrl, serverUrl!);
    notifyListeners();
  }

  /// "Change server": forget the server so the connect screen asks to scan again.
  Future<void> clearServerUrl() async {
    serverUrl = null;
    await _kv.delete(_kUrl);
    notifyListeners();
  }

  Future<void> saveSession(AuthResult auth) async {
    token = auth.token;
    user = auth.user;
    await _kv.write(_kToken, auth.token);
    await _kv.write(_kUser, jsonEncode(auth.user.toJson()));
    notifyListeners();
  }

  Future<void> clearSession() async {
    token = null;
    user = null;
    await _kv.delete(_kToken);
    await _kv.delete(_kUser);
    notifyListeners();
  }
}
