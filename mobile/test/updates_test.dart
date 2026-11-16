import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:lumina_notes/settings.dart';
import 'package:lumina_notes/updates.dart';

MockClient _github({String tag = 'v9.0.0', List<int>? apk}) => MockClient.streaming((req, _) async {
      if (req.url.host == 'api.github.com') {
        final body = jsonEncode({
          'tag_name': tag,
          'html_url': 'https://github.com/x/y/releases/tag/$tag',
          'assets': [
            {'name': 'Lumina-Notes-android.apk', 'browser_download_url': 'https://dl.example/apk', 'size': apk?.length ?? 0},
          ],
        });
        return http.StreamedResponse(Stream.value(utf8.encode(body)), 200);
      }
      final bytes = apk ?? const <int>[];
      return http.StreamedResponse(Stream.fromIterable([bytes.sublist(0, bytes.length ~/ 2), bytes.sublist(bytes.length ~/ 2)]), 200,
          contentLength: bytes.length);
    });

void main() {
  late Directory tmp;
  setUp(() => tmp = Directory.systemTemp.createTempSync('lumina-updates-'));
  tearDown(() => tmp.deleteSync(recursive: true));

  test('downloads the APK in-app, then hands it to the installer', () async {
    final apk = List<int>.generate(1000, (i) => i % 256);
    String? installed;
    final progress = <double>[];
    final u = UpdateService(
      client: _github(apk: apk),
      directory: () async => tmp,
      install: (p) async {
        installed = p;
        return true;
      },
    );
    u.addListener(() {
      if (u.progress != null) progress.add(u.progress!);
    });
    final r = await u.check();
    expect(r!.isNewer, isTrue);
    expect(u.isDownloaded, isFalse);
    final path = await u.download();
    expect(File(path!).readAsBytesSync(), apk);
    expect(u.isDownloaded, isTrue);
    expect(progress.last, 1.0);
    expect(await u.install(), isTrue);
    expect(installed, path);
  });

  test('a previously downloaded APK is offered for install on the next check', () async {
    File('${tmp.path}${Platform.pathSeparator}Lumina-Notes-9.0.0.apk').writeAsBytesSync([1, 2, 3]);
    final u = UpdateService(client: _github(), directory: () async => tmp, install: (_) async => true);
    await u.check();
    expect(u.isDownloaded, isTrue);
  });

  test('no download offered when already on the latest version', () async {
    final u = UpdateService(client: _github(tag: 'v0.0.1'), directory: () async => tmp);
    final r = await u.check();
    expect(r!.isNewer, isFalse);
    expect(await u.download(), isNotNull); // explicit request still works…
    final again = UpdateService(client: _github(tag: 'v0.0.1'), directory: () async => tmp);
    await again.check();
    expect(again.isDownloaded, isFalse); // …but an old build is never offered as an update
  });

  test('reader colour falls back when it would vanish on the theme', () {
    final s = AppSettings.inMemory()..update(fontColor: 0xFFF3F3F0); // warm white
    expect(s.fontColorReadableOn(Colors.white), isFalse);
    final light = ColorScheme.fromSeed(seedColor: Colors.green).copyWith(surface: Colors.white, onSurface: Colors.black);
    expect(s.readerStyle(light).color, Colors.black);
    final dark = light.copyWith(surface: const Color(0xFF161916));
    expect(s.readerStyle(dark).color, const Color(0xFFF3F3F0));
  });
}
