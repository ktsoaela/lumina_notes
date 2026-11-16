import 'package:flutter_test/flutter_test.dart';
import 'package:lumina_notes/data/models.dart';
import 'package:lumina_notes/data/session_store.dart';

void main() {
  group('normalizeServerUrl', () {
    test('adds http and strips slash/whitespace', () {
      expect(normalizeServerUrl('  10.0.2.2:58888/ '), 'http://10.0.2.2:58888');
    });
    test('keeps https', () {
      expect(normalizeServerUrl('https://notes.example.com/'), 'https://notes.example.com');
    });
    test('rejects empty and non-http schemes', () {
      expect(() => normalizeServerUrl(''), throwsFormatException);
      expect(() => normalizeServerUrl('ftp://x'), throwsFormatException);
      expect(() => normalizeServerUrl('http://'), throwsFormatException);
    });
  });

  test('saveSession then a new SessionStore restores token and user', () async {
    final kv = MemoryKeyValueStore();
    final a = SessionStore(kv);
    await a.load();
    await a.saveServerUrl('http://h:1');
    await a.saveSession(const AuthResult(
      token: 'tok',
      user: User(id: 3, email: 'a@b.co', name: 'A'),
    ));
    expect(a.isSignedIn, isTrue);

    final b = SessionStore(kv);
    await b.load();
    expect(b.serverUrl, 'http://h:1');
    expect(b.token, 'tok');
    expect(b.user?.id, 3);
    expect(b.isSignedIn, isTrue);
  });

  test('clearSession keeps serverUrl, drops token', () async {
    final kv = MemoryKeyValueStore();
    final s = SessionStore(kv);
    await s.load();
    await s.saveServerUrl('http://h:1');
    await s.saveSession(const AuthResult(token: 't', user: User(id: 1, email: '', name: '')));
    var notified = 0;
    s.addListener(() => notified++);
    await s.clearSession();
    expect(s.token, isNull);
    expect(s.isSignedIn, isFalse);
    expect(s.serverUrl, 'http://h:1');
    expect(notified, greaterThan(0));
    expect(await kv.read('lumina.token'), isNull);
  });
}
