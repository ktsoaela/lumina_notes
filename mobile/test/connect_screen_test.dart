import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumina_notes/app_scope.dart';
import 'package:lumina_notes/data/api_client.dart';
import 'package:lumina_notes/data/session_store.dart';
import 'package:lumina_notes/main.dart';

import 'fakes.dart';

Future<(AppServices, MemoryKeyValueStore)> _pumpApp(WidgetTester tester, FakeApiClient fake) async {
  final kv = MemoryKeyValueStore();
  final session = SessionStore(kv);
  await session.load();
  final services = AppServices(session: session, apiFactory: (url, token) => fake..token = token);
  await tester.pumpWidget(LuminaApp(services: services));
  await tester.pumpAndSettle();
  return (services, kv);
}

Future<void> _fillLogin(WidgetTester tester, {String url = 'http://10.0.2.2:58888'}) async {
  await tester.enterText(find.byKey(const Key('serverUrl')), url);
  await tester.enterText(find.byKey(const Key('identifier')), 'demo_user');
  await tester.enterText(find.byKey(const Key('password')), 'demo_user');
  await tester.tap(find.byKey(const Key('submit')));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('shows error text from ApiException on bad login', (tester) async {
    final fake = FakeApiClient()..authError = const ApiException(401, 'Invalid credentials');
    final (services, _) = await _pumpApp(tester, fake);
    await _fillLogin(tester);
    expect(find.text('Invalid credentials'), findsOneWidget);
    expect(services.session.isSignedIn, isFalse);
  });

  testWidgets('successful login saves session', (tester) async {
    final fake = FakeApiClient()..seed();
    final (services, kv) = await _pumpApp(tester, fake);
    await _fillLogin(tester);
    expect(kv.values['lumina.token'], 'fake-token');
    expect(kv.values['lumina.serverUrl'], 'http://10.0.2.2:58888');
    expect(services.session.isSignedIn, isTrue);
    expect(find.byKey(const Key('serverUrl')), findsNothing); // left the connect screen
  });

  testWidgets('invalid url shows "Enter a valid server URL"', (tester) async {
    final fake = FakeApiClient();
    await _pumpApp(tester, fake);
    await _fillLogin(tester, url: 'ftp://nope');
    expect(find.text('Enter a valid server URL'), findsOneWidget);
  });

  testWidgets('test connection reports unreachable server', (tester) async {
    final fake = FakeApiClient()..healthy = false;
    await _pumpApp(tester, fake);
    await tester.enterText(find.byKey(const Key('serverUrl')), 'http://10.0.2.2:58888');
    await tester.tap(find.byKey(const Key('testConnection')));
    await tester.pumpAndSettle();
    expect(find.text('Cannot reach server'), findsOneWidget);
  });
}
