import 'package:flutter/material.dart';

import 'app_scope.dart';
import 'data/session_store.dart';
import 'ui/connect_screen.dart';
import 'ui/adaptive_home.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final session = SessionStore(FlutterSecureKeyValueStore());
  await session.load();
  runApp(LuminaApp(services: AppServices(session: session)));
}

class LuminaApp extends StatelessWidget {
  const LuminaApp({super.key, required this.services});

  final AppServices services;

  @override
  Widget build(BuildContext context) {
    return AppScope(
      services: services,
      child: MaterialApp(
        title: 'Lumina Notes',
        theme: ThemeData(colorSchemeSeed: Colors.indigo, useMaterial3: true),
        darkTheme: ThemeData(
          colorSchemeSeed: Colors.indigo,
          brightness: Brightness.dark,
          useMaterial3: true,
        ),
        home: ListenableBuilder(
          listenable: services,
          builder: (_, _) => services.isSignedIn
              ? AdaptiveHome(key: ValueKey(services.session.user?.id))
              : const ConnectScreen(),
        ),
      ),
    );
  }
}
