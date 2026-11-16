import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumina_notes/app_scope.dart';
import 'package:lumina_notes/data/session_store.dart';
import 'package:lumina_notes/main.dart';
import 'package:lumina_notes/version.dart';

import 'fakes.dart';

void main() {
  testWidgets('signed-out app shows Lumina Notes connect screen', (tester) async {
    final session = SessionStore(MemoryKeyValueStore());
    await session.load();
    await tester.pumpWidget(LuminaApp(services: AppServices(session: session, local: memoryLocal(), autoSync: false)));
    expect(find.text('Lumina Notes'), findsWidgets);
    expect(find.byKey(const Key('scanQr')), findsOneWidget);
    expect(find.byKey(const Key('serverUrl')), findsNothing);
    expect(find.text('Lumina Notes $appVersionLabel'), findsOneWidget); // version before sign-in
  });
}
