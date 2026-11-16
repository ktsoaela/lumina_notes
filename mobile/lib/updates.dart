import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

import 'version.dart';

typedef InstallApk = Future<bool> Function(String path);

/// Checks GitHub Releases and downloads the Android APK inside the app (ADR 0003).
/// Installing is always user-confirmed: Android shows its own install prompt.
class UpdateService extends ChangeNotifier {
  UpdateService({http.Client? client, Future<Directory> Function()? directory, InstallApk? install})
      : _client = client, // ignore: prefer_initializing_formals
        _directory = directory ?? _defaultDirectory,
        _install = install ?? _openInstaller;

  final http.Client? _client;
  final Future<Directory> Function() _directory;
  final InstallApk _install;

  ReleaseInfo? latest;
  String? error;
  bool checking = false;

  /// 0..1 while downloading (null otherwise).
  double? progress;
  String? downloadedPath;

  bool get downloading => progress != null;
  bool get hasUpdate => latest?.isNewer ?? false;
  bool get isDownloaded => downloadedPath != null && latest != null && downloadedPath!.contains(latest!.version);

  static Future<Directory> _defaultDirectory() async {
    final base = await getApplicationSupportDirectory();
    return Directory('${base.path}${Platform.pathSeparator}updates').create(recursive: true);
  }

  static Future<bool> _openInstaller(String path) async {
    final r = await OpenFilex.open(path, type: 'application/vnd.android.package-archive');
    return r.type == ResultType.done;
  }

  String _fileName(String version) => 'Lumina-Notes-$version.apk';

  Future<ReleaseInfo?> check() async {
    checking = true;
    error = null;
    notifyListeners();
    try {
      final r = await fetchLatestRelease(client: _client);
      latest = r;
      // Already fetched this version earlier? Offer Install straight away.
      final f = File('${(await _directory()).path}${Platform.pathSeparator}${_fileName(r.version)}');
      downloadedPath = r.isNewer && await f.exists() ? f.path : null;
      return r;
    } catch (_) {
      error = 'Could not check for updates';
      return null;
    } finally {
      checking = false;
      notifyListeners();
    }
  }

  /// Streams the APK to app storage. Returns the file path, or null on failure.
  Future<String?> download() async {
    final r = latest;
    final url = r?.apkUrl;
    if (r == null || url == null || downloading) return null;
    progress = 0;
    error = null;
    notifyListeners();
    final client = _client ?? http.Client();
    final dir = await _directory();
    final dest = File('${dir.path}${Platform.pathSeparator}${_fileName(r.version)}');
    final part = File('${dest.path}.part');
    try {
      final res = await client.send(http.Request('GET', Uri.parse(url)));
      if (res.statusCode != 200) throw HttpException('HTTP ${res.statusCode}');
      final total = res.contentLength ?? r.apkSize ?? 0;
      final sink = part.openWrite();
      var received = 0;
      await for (final chunk in res.stream) {
        sink.add(chunk);
        received += chunk.length;
        if (total > 0) {
          progress = (received / total).clamp(0, 1);
          notifyListeners();
        }
      }
      await sink.close();
      if (await dest.exists()) await dest.delete();
      await part.rename(dest.path);
      downloadedPath = dest.path;
      return dest.path;
    } catch (_) {
      if (await part.exists()) await part.delete();
      error = 'Download failed — try again or use the browser';
      return null;
    } finally {
      if (_client == null) client.close();
      progress = null;
      notifyListeners();
    }
  }

  /// Opens Android's installer for the downloaded APK (the user confirms there).
  Future<bool> install() async {
    final p = downloadedPath;
    if (p == null) return false;
    final ok = await _install(p);
    if (!ok) {
      error = 'Could not open the installer — allow “Install unknown apps” for Lumina';
      notifyListeners();
    }
    return ok;
  }
}
