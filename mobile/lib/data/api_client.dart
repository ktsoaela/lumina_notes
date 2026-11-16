import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;

import 'models.dart';

/// Non-2xx response from the API. [message] is FastAPI's `detail`.
class ApiException implements Exception {
  const ApiException(this.status, this.message);

  final int status;
  final String message;

  bool get isAuthError => status == 401 || status == 403;

  @override
  String toString() => message;
}

/// The server could not be reached (DNS, refused, timeout, TLS...).
class NetworkException implements Exception {
  const NetworkException(this.cause);

  final Object cause;

  @override
  String toString() => 'Cannot reach server';
}

/// Thin REST client for the Lumina FastAPI backend (`app.py`).
class ApiClient {
  ApiClient({required String baseUrl, this.token, http.Client? client})
      : baseUrl = baseUrl.replaceAll(RegExp(r'/+$'), ''),
        _http = client ?? http.Client();

  final String baseUrl;
  String? token;
  final http.Client _http;

  static const timeout = Duration(seconds: 15);

  static const _paths = {
    EntityKind.bookshelf: '/api/bookshelves',
    EntityKind.notebook: '/api/notebooks',
    EntityKind.section: '/api/sections',
    EntityKind.page: '/api/pages',
  };

  Uri _uri(String path, [Map<String, String>? query]) =>
      Uri.parse('$baseUrl$path').replace(queryParameters: query);

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  Future<dynamic> _send(String method, String path,
      {Object? body, Map<String, String>? query}) async {
    final req = http.Request(method, _uri(path, query))..headers.addAll(_headers);
    if (body != null) req.body = jsonEncode(body);
    final http.Response res;
    try {
      res = await http.Response.fromStream(await _http.send(req).timeout(timeout));
    } on SocketException catch (e) {
      throw NetworkException(e);
    } on TimeoutException catch (e) {
      throw NetworkException(e);
    } on http.ClientException catch (e) {
      throw NetworkException(e);
    } on HandshakeException catch (e) {
      throw NetworkException(e);
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      throw ApiException(res.statusCode, _detail(res));
    }
    if (res.body.isEmpty) return null;
    return jsonDecode(utf8.decode(res.bodyBytes));
  }

  static String _detail(http.Response res) {
    try {
      final j = jsonDecode(utf8.decode(res.bodyBytes));
      final d = j is Map ? j['detail'] : null;
      if (d is String && d.isNotEmpty) return d;
      if (d is List && d.isNotEmpty && d.first is Map && d.first['msg'] != null) {
        return d.first['msg'].toString();
      }
    } catch (_) {}
    return 'Request failed (${res.statusCode})';
  }

  List<Map<String, dynamic>> _list(dynamic j) =>
      (j as List).cast<Map<String, dynamic>>();

  // ---- health / auth ----

  Future<bool> health() async {
    try {
      final j = await _send('GET', '/health');
      return j is Map && j['status'] == 'ok';
    } on ApiException {
      return false;
    } on NetworkException {
      return false;
    }
  }

  Future<AuthResult> login(String identifier, String password) async => AuthResult.fromJson(
      await _send('POST', '/api/auth/login',
          body: {'identifier': identifier, 'password': password}));

  Future<AuthResult> signup({
    required String email,
    required String password,
    required String name,
    String? username,
  }) async =>
      AuthResult.fromJson(await _send('POST', '/api/auth/signup', body: {
        'email': email,
        'password': password,
        'name': name,
        if (username != null && username.trim().isNotEmpty) 'username': username.trim(),
      }));

  Future<User> me() async => User.fromJson(await _send('GET', '/api/auth/me'));

  // ---- hierarchy reads ----

  Future<List<Bookshelf>> listBookshelves() async =>
      _list(await _send('GET', '/api/bookshelves')).map(Bookshelf.fromJson).toList();

  Future<List<Notebook>> listNotebooks(String bookshelfId) async =>
      _list(await _send('GET', '/api/notebooks', query: {'bookshelfId': bookshelfId}))
          .map(Notebook.fromJson)
          .toList();

  Future<List<Section>> listSections(String notebookId) async =>
      _list(await _send('GET', '/api/sections/${Uri.encodeComponent(notebookId)}'))
          .map(Section.fromJson)
          .toList();

  Future<List<NotePage>> listPages(String sectionId) async =>
      _list(await _send('GET', '/api/pages/${Uri.encodeComponent(sectionId)}'))
          .map(NotePage.fromJson)
          .toList();

  // ---- hierarchy writes ----

  Future<void> createBookshelf(Bookshelf b) =>
      _send('POST', '/api/bookshelves', body: {'id': b.id, 'name': b.name});

  Future<void> createNotebook(Notebook n) => _send('POST', '/api/notebooks',
      body: {'id': n.id, 'name': n.name, 'bookshelfId': n.bookshelfId});

  Future<void> createSection(Section s) => _send('POST', '/api/sections',
      body: {'id': s.id, 'notebookId': s.notebookId, 'name': s.name});

  Future<void> createPage(NotePage p) => _send('POST', '/api/pages',
      body: {'id': p.id, 'sectionId': p.sectionId, 'title': p.title, 'content': p.content});

  Future<void> renameBookshelf(String id, String name) =>
      _send('PUT', '/api/bookshelves/${Uri.encodeComponent(id)}', body: {'name': name});

  Future<void> renameNotebook(String id, String name) =>
      _send('PUT', '/api/notebooks/${Uri.encodeComponent(id)}', body: {'name': name});

  Future<void> renameSection(String id, String name) =>
      _send('PUT', '/api/sections/${Uri.encodeComponent(id)}', body: {'name': name});

  Future<void> updatePage(NotePage p) => _send('PUT', '/api/pages/${Uri.encodeComponent(p.id)}',
      body: {'title': p.title, 'content': p.content});

  Future<void> delete(EntityKind kind, String id) =>
      _send('DELETE', '${_paths[kind]}/${Uri.encodeComponent(id)}');
}
