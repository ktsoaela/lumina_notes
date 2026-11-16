import 'package:flutter/material.dart';

import 'app_scope.dart';
import 'data/session_store.dart';
import 'pair_links.dart';
import 'ui/connect_screen.dart';
import 'ui/adaptive_home.dart';
import 'ui/scan_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final session = SessionStore(FlutterSecureKeyValueStore());
  await session.load();
  final services = AppServices(session: session);
  final messenger = GlobalKey<ScaffoldMessengerState>();
  runApp(LuminaApp(services: services, messengerKey: messenger));
  listenForPairLinks(services, messenger); // lumina://pair?u=..&c=..
}

class LuminaApp extends StatelessWidget {
  const LuminaApp({super.key, required this.services, this.messengerKey, this.scan = ScanScreen.scan});

  final AppServices services;
  final GlobalKey<ScaffoldMessengerState>? messengerKey;

  /// QR scanner for the connect screen (tests inject a fake).
  final QrScanner scan;

  @override
  Widget build(BuildContext context) {
    return AppScope(
      services: services,
      child: MaterialApp(
        title: 'Lumina Notes',
        scaffoldMessengerKey: messengerKey,
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
              : ConnectScreen(scan: scan),
        ),
      ),
    );
  }
}
