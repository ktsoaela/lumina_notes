import 'package:flutter/material.dart';

import 'app_scope.dart';
import 'data/session_store.dart';
import 'pair_links.dart';
import 'settings.dart';
import 'ui/lumina_theme.dart';
import 'ui/connect_screen.dart';
import 'ui/adaptive_home.dart';
import 'ui/scan_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final session = SessionStore(FlutterSecureKeyValueStore());
  await session.load();
  final settings = AppSettings(FlutterSecureKeyValueStore());
  await settings.load();
  final services = AppServices(session: session, settings: settings);
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
      child: ListenableBuilder(
        listenable: services.settings,
        builder: (_, _) => MaterialApp(
          title: 'Lumina Notes',
          debugShowCheckedModeBanner: false,
          scaffoldMessengerKey: messengerKey,
          theme: luminaTheme(Brightness.light),
          darkTheme: luminaTheme(Brightness.dark),
          themeMode: services.settings.themeMode,
          home: ListenableBuilder(
            listenable: services,
            builder: (_, _) => services.isSignedIn
                ? AdaptiveHome(key: ValueKey(services.session.user?.id))
                : ConnectScreen(scan: scan),
          ),
        ),
      ),
    );
  }
}
