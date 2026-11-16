import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lumina_notes/version.dart';

void main() {
  test('appVersion matches pubspec.yaml', () {
    final pubspec = File('pubspec.yaml').readAsStringSync();
    final v = RegExp(r'^version:\s*([0-9.]+)', multiLine: true).firstMatch(pubspec)!.group(1);
    expect(appVersion, v);
  });

  test('compareVersions orders numerically', () {
    expect(compareVersions('1.10.0', '1.9.0'), greaterThan(0));
    expect(compareVersions('v1.2.0', '1.2.0'), 0);
    expect(compareVersions('1.2', '1.2.1'), lessThan(0));
  });

  test('fetchLatestRelease picks the APK asset', () async {
    final client = MockClient((req) async => http.Response(
          jsonEncode({
            'tag_name': 'v9.0.0',
            'html_url': 'https://github.com/x/y/releases/tag/v9.0.0',
            'assets': [
              {'name': 'Lumina-Notes.exe', 'browser_download_url': 'https://e/exe', 'size': 1},
              {'name': 'Lumina-Notes-android.apk', 'browser_download_url': 'https://e/apk', 'size': 42},
            ],
          }),
          200,
        ));
    final r = await fetchLatestRelease(client: client);
    expect(r.version, '9.0.0');
    expect(r.apkUrl, 'https://e/apk');
    expect(r.apkSize, 42);
    expect(r.isNewer, isTrue);
  });
}
