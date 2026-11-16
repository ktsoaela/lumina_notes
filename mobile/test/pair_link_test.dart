import 'package:flutter_test/flutter_test.dart';
import 'package:lumina_notes/app_scope.dart';
import 'package:lumina_notes/data/api_client.dart';
import 'package:lumina_notes/data/local_repository.dart' show RuleException;
import 'package:lumina_notes/data/pair_link.dart';
import 'package:lumina_notes/data/session_store.dart';

import 'fakes.dart';

void main() {
  group('parsePairLink', () {
    test('reads server and code', () {
      final l = parsePairLink('lumina://pair?u=http%3A%2F%2F192.168.0.225%3A58888&c=AB12CD34')!;
      expect(l.serverUrl, 'http://192.168.0.225:58888');
      expect(l.code, 'AB12CD34');
    });
    test('code is optional, trimmed and upper-cased', () {
      expect(parsePairLink('lumina://pair?u=https%3A%2F%2Fnotes.example.com%2F')!.code, isNull);
      expect(parsePairLink('lumina://pair?u=https%3A%2F%2Fnotes.example.com&c=')!.code, isNull);
      expect(parsePairLink(' lumina://pair?u=https%3A%2F%2Fn.io&c=ab12cd34 ')!.code, 'AB12CD34');
    });
    test('normalizes the server url', () {
      expect(parsePairLink('lumina://pair?u=https%3A%2F%2Fnotes.example.com%2F')!.serverUrl,
          'https://notes.example.com');
    });
    test('rejects anything that is not a lumina pair link', () {
      for (final raw in [
        '',
        'hello world',
        'https://notes.example.com/pair?u=x&c=y',
        'lumina://other?u=http%3A%2F%2Fh%3A1&c=AB',
        'lumina://pair?c=AB12CD34',
        'lumina://pair?u=ftp%3A%2F%2Fx&c=AB12CD34',
        'lumina://pair?u=&c=AB12CD34',
      ]) {
        expect(parsePairLink(raw), isNull, reason: raw);
      }
    });
  });

  group('applyPairLink', () {
    Future<(AppServices, MemoryKeyValueStore, FakeApiClient)> setup() async {
      final kv = MemoryKeyValueStore();
      final session = SessionStore(kv);
      await session.load();
      final fake = FakeApiClient();
      final services = AppServices(
          session: session, apiFactory: (url, token) => fake..token = token, local: memoryLocal(), autoSync: false);
      return (services, kv, fake);
    }

    test('valid code signs in on the linked server', () async {
      final (services, kv, fake) = await setup();
      await services.applyPairLink(const PairLink('http://10.0.0.5:58888', 'AB12CD34'));
      expect(fake.pairedCodes, ['AB12CD34']);
      expect(kv.values['lumina.serverUrl'], 'http://10.0.0.5:58888');
      expect(services.isSignedIn, isTrue);
    });

    test('rejected code keeps the server url and rethrows', () async {
      final (services, kv, fake) = await setup();
      fake.pairError = const ApiException(400, 'Pairing code is invalid or expired');
      await expectLater(services.applyPairLink(const PairLink('http://10.0.0.5:58888', 'OLDCODE2')),
          throwsA(isA<ApiException>()));
      expect(kv.values['lumina.serverUrl'], 'http://10.0.0.5:58888');
      expect(services.isSignedIn, isFalse);
    });

    test('link without code only saves the server', () async {
      final (services, kv, fake) = await setup();
      await services.applyPairLink(const PairLink('http://10.0.0.5:58888', null));
      expect(fake.pairedCodes, isEmpty);
      expect(kv.values['lumina.serverUrl'], 'http://10.0.0.5:58888');
      expect(services.isSignedIn, isFalse);
    });

    test('ignored while signed in: no server or account switch', () async {
      final (services, kv, fake) = await setup();
      await services.applyPairLink(const PairLink('http://a:1', 'AB12CD34'));
      await expectLater(services.applyPairLink(const PairLink('http://b:2', 'CD34EF56')),
          throwsA(isA<RuleException>().having((e) => e.message, 'message', 'Sign out first to switch servers')));
      expect(kv.values['lumina.serverUrl'], 'http://a:1');
      expect(fake.pairedCodes, ['AB12CD34']);
    });
  });

  test('clearServerUrl forgets the saved server', () async {
    final kv = MemoryKeyValueStore();
    final s = SessionStore(kv);
    await s.load();
    await s.saveServerUrl('http://h:1');
    await s.clearServerUrl();
    expect(s.serverUrl, isNull);
    expect(kv.values.containsKey('lumina.serverUrl'), isFalse);
  });
}
