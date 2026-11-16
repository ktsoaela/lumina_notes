import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumina_notes/app_scope.dart';
import 'package:lumina_notes/data/session_store.dart';
import 'package:lumina_notes/main.dart';

void main() {
  testWidgets('signed-out app shows Lumina Notes connect screen', (tester) async {
    final session = SessionStore(MemoryKeyValueStore());
    await session.load();
    await tester.pumpWidget(LuminaApp(services: AppServices(session: session)));
    expect(find.text('Lumina Notes'), findsWidgets);
    expect(find.byKey(const Key('serverUrl')), findsOneWidget);
  });
}
