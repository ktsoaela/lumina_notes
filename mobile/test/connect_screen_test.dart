import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumina_notes/app_scope.dart';
import 'package:lumina_notes/data/api_client.dart';
import 'package:lumina_notes/data/session_store.dart';
import 'package:lumina_notes/main.dart';
import 'package:lumina_notes/pair_links.dart';

import 'fakes.dart';

const _link = 'lumina://pair?u=http%3A%2F%2F192.168.0.225%3A58888&c=AB12CD34';

Future<(AppServices, MemoryKeyValueStore)> _pumpApp(WidgetTester tester, FakeApiClient fake,
    {String? scanResult, Map<String, String>? stored}) async {
  final kv = MemoryKeyValueStore();
  if (stored != null) kv.values.addAll(stored);
  final session = SessionStore(kv);
  await session.load();
  final services = AppServices(
      session: session, apiFactory: (url, token) => fake..token = token, local: memoryLocal(), autoSync: false);
  await tester.pumpWidget(LuminaApp(services: services, scan: (_) async => scanResult));
  await tester.pumpAndSettle();
  return (services, kv);
}

Future<void> _tap(WidgetTester tester, String key) async {
  await tester.tap(find.byKey(Key(key)));
  await tester.pumpAndSettle();
}

Future<void> _fillLogin(WidgetTester tester, {String? url = 'http://10.0.2.2:58888'}) async {
  if (url != null) {
    await _tap(tester, 'manualServer');
    await tester.enterText(find.byKey(const Key('serverUrl')), url);
  }
  await tester.enterText(find.byKey(const Key('identifier')), 'demo_user');
  await tester.enterText(find.byKey(const Key('password')), 'demo_user');
  await _tap(tester, 'submit');
}

void main() {
  testWidgets('fresh app is scan-first: no server URL field, no login form', (tester) async {
    await _pumpApp(tester, FakeApiClient());
    expect(find.byKey(const Key('scanQr')), findsOneWidget);
    expect(find.byKey(const Key('serverUrl')), findsNothing);
    expect(find.byKey(const Key('identifier')), findsNothing);
  });

  testWidgets('scanning a pairing QR signs in without typing anything', (tester) async {
    final fake = FakeApiClient()..seed();
    final (services, kv) = await _pumpApp(tester, fake, scanResult: _link);
    await _tap(tester, 'scanQr');
    expect(fake.pairedCodes, ['AB12CD34']);
    expect(kv.values['lumina.serverUrl'], 'http://192.168.0.225:58888');
    expect(services.session.isSignedIn, isTrue);
    expect(find.byKey(const Key('scanQr')), findsNothing);
  });

  testWidgets('expired code keeps the server and shows login with the error', (tester) async {
    final fake = FakeApiClient()
      ..seed()
      ..pairError = const ApiException(400, 'Pairing code is invalid or expired');
    final (services, kv) = await _pumpApp(tester, fake, scanResult: _link);
    await _tap(tester, 'scanQr');
    expect(kv.values['lumina.serverUrl'], 'http://192.168.0.225:58888');
    expect(services.session.isSignedIn, isFalse);
    expect(find.textContaining('Pairing code is invalid or expired'), findsOneWidget);
    expect(find.byKey(const Key('serverLabel')), findsOneWidget);
    expect(find.byKey(const Key('scanAgain')), findsOneWidget);
    expect(find.byKey(const Key('serverUrl')), findsNothing);
    // Log in against the paired server without typing its URL.
    await _fillLogin(tester, url: null);
    expect(services.session.isSignedIn, isTrue);
  });

  testWidgets('random QR shows "Not a Lumina pairing code" and saves nothing', (tester) async {
    final (_, kv) = await _pumpApp(tester, FakeApiClient(), scanResult: 'https://example.com/menu');
    await _tap(tester, 'scanQr');
    expect(find.text('Not a Lumina pairing code'), findsOneWidget);
    expect(kv.values.containsKey('lumina.serverUrl'), isFalse);
  });

  testWidgets('cancelled scan does nothing', (tester) async {
    await _pumpApp(tester, FakeApiClient());
    await _tap(tester, 'scanQr');
    expect(find.byKey(const Key('scanQr')), findsOneWidget);
    expect(find.byKey(const Key('connectError')), findsNothing);
  });

  testWidgets('change server returns to scan-first', (tester) async {
    final (_, kv) = await _pumpApp(tester, FakeApiClient(), stored: {'lumina.serverUrl': 'http://h:1'});
    expect(find.byKey(const Key('serverLabel')), findsOneWidget);
    await _tap(tester, 'changeServer');
    expect(find.byKey(const Key('scanQr')), findsOneWidget);
    expect(kv.values.containsKey('lumina.serverUrl'), isFalse);
  });

  testWidgets('deep link opened by the OS signs in', (tester) async {
    final fake = FakeApiClient()..seed();
    final (services, _) = await _pumpApp(tester, fake);
    expect(await handlePairLink(services, _link), 'Connected');
    await tester.pumpAndSettle();
    expect(services.session.isSignedIn, isTrue);
    expect(await handlePairLink(services, _link), 'Sign out first to switch servers');
  });

  // ---- advanced: manual server URL (previous flow) ----

  testWidgets('shows error text from ApiException on bad login', (tester) async {
    final fake = FakeApiClient()..authError = const ApiException(401, 'Invalid credentials');
    final (services, _) = await _pumpApp(tester, fake);
    await _fillLogin(tester);
    expect(find.text('Invalid credentials'), findsOneWidget);
    expect(services.session.isSignedIn, isFalse);
  });

  testWidgets('successful manual login saves session', (tester) async {
    final fake = FakeApiClient()..seed();
    final (services, kv) = await _pumpApp(tester, fake);
    await _fillLogin(tester);
    expect(kv.values['lumina.token'], 'fake-token');
    expect(kv.values['lumina.serverUrl'], 'http://10.0.2.2:58888');
    expect(services.session.isSignedIn, isTrue);
    expect(find.byKey(const Key('serverUrl')), findsNothing); // left the connect screen
  });

  testWidgets('invalid url shows "Enter a valid server URL"', (tester) async {
    await _pumpApp(tester, FakeApiClient());
    await _fillLogin(tester, url: 'ftp://nope');
    expect(find.text('Enter a valid server URL'), findsOneWidget);
  });

  testWidgets('test connection reports unreachable server', (tester) async {
    final fake = FakeApiClient()..healthy = false;
    await _pumpApp(tester, fake);
    await _tap(tester, 'manualServer');
    await tester.enterText(find.byKey(const Key('serverUrl')), 'http://10.0.2.2:58888');
    await _tap(tester, 'testConnection');
    expect(find.text('Cannot reach server'), findsOneWidget);
  });
}
