import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lumina_notes/data/api_client.dart';
import 'package:lumina_notes/data/models.dart';

http.Response _json(Object body, [int status = 200]) => http.Response(
      jsonEncode(body),
      status,
      headers: {'content-type': 'application/json'},
    );

const _authBody = {
  'token': 'tok123',
  'user': {'id': 7, 'email': 'a@b.co', 'name': 'A', 'username': 'a'},
};

void main() {
  test('login posts identifier+password and parses token', () async {
    late http.Request seen;
    final api = ApiClient(
      baseUrl: 'http://h:1',
      client: MockClient((req) async {
        seen = req;
        return _json(_authBody);
      }),
    );
    final res = await api.login('a', 'b');
    expect(seen.method, 'POST');
    expect(seen.url.path, '/api/auth/login');
    expect(jsonDecode(seen.body), {'identifier': 'a', 'password': 'b'});
    expect(res.token, 'tok123');
    expect(res.user.id, 7);
    expect(res.user.username, 'a');
  });

  test('base url trailing slash is not doubled', () async {
    late Uri seen;
    final api = ApiClient(
      baseUrl: 'http://h:1/',
      token: 't',
      client: MockClient((req) async {
        seen = req.url;
        return _json(_authBody['user']!);
      }),
    );
    await api.me();
    expect(seen.toString(), 'http://h:1/api/auth/me');
  });

  test('401 detail becomes ApiException(401, Invalid credentials)', () async {
    final api = ApiClient(
      baseUrl: 'http://h:1',
      client: MockClient(
          (_) async => _json({'detail': 'Invalid credentials'}, 401)),
    );
    await expectLater(
      api.login('a', 'b'),
      throwsA(isA<ApiException>()
          .having((e) => e.status, 'status', 401)
          .having((e) => e.message, 'message', 'Invalid credentials')),
    );
  });

  test('422 list detail uses first msg', () async {
    final api = ApiClient(
      baseUrl: 'http://h:1',
      client: MockClient((_) async => _json({
            'detail': [
              {'msg': 'Value error, Enter a valid email address'},
              {'msg': 'other'},
            ]
          }, 422)),
    );
    await expectLater(
      api.signup(email: 'x', password: 'secret12', name: 'X'),
      throwsA(isA<ApiException>().having((e) => e.message, 'message',
          'Value error, Enter a valid email address')),
    );
  });

  test('listNotebooks sends bookshelfId query', () async {
    late Uri seen;
    final api = ApiClient(
      baseUrl: 'http://h:1',
      token: 't',
      client: MockClient((req) async {
        seen = req.url;
        return _json([
          {'id': 'nb-1', 'name': 'N', 'bookshelfId': 'bs-1', 'archived': 0},
        ]);
      }),
    );
    final list = await api.listNotebooks('bs-1');
    expect(seen.path, '/api/notebooks');
    expect(seen.queryParameters['bookshelfId'], 'bs-1');
    expect(list.single.name, 'N');
  });

  test('bearer header sent', () async {
    late Map<String, String> headers;
    final api = ApiClient(
      baseUrl: 'http://h:1',
      token: 'abc',
      client: MockClient((req) async {
        headers = req.headers;
        return _json([]);
      }),
    );
    await api.listBookshelves();
    expect(headers['Authorization'], 'Bearer abc');
  });

  test('delete page hits DELETE /api/pages/{id}', () async {
    late http.Request seen;
    final api = ApiClient(
      baseUrl: 'http://h:1',
      token: 't',
      client: MockClient((req) async {
        seen = req;
        return http.Response('', 204);
      }),
    );
    await api.delete(EntityKind.page, 'page-1');
    expect(seen.method, 'DELETE');
    expect(seen.url.path, '/api/pages/page-1');
  });

  test('Notebook.fromJson accepts archived 1 and sqlite timestamp', () {
    final nb = Notebook.fromJson({
      'id': 'nb-1',
      'name': 'N',
      'bookshelfId': 'bs-1',
      'archived': 1,
      'createdAt': '2026-11-16 10:00:00',
      'updatedAt': '2026-11-16 10:00:00',
    });
    expect(nb.archived, isTrue);
    expect(nb.updatedAt, DateTime.utc(2026, 11, 16, 10));
    final page = NotePage.fromJson({
      'id': 'p',
      'sectionId': 's',
      'title': 'T',
      'content': null,
      'updatedAt': '2026-11-16T10:00:00.500Z',
    });
    expect(page.content, '');
    expect(page.updatedAt, DateTime.utc(2026, 11, 16, 10, 0, 0, 500));
  });
}
