import 'dart:convert';

import 'package:http/http.dart' as http;

/// Keep in sync with `version:` in pubspec.yaml (`appVersion+appBuild`; a test checks this).
const appVersion = '1.3.0';
const appBuild = 3;

/// Shown in Settings, the book tree and the sign-in screen.
const appVersionLabel = 'v$appVersion (build $appBuild)';

const releasesRepo = 'ktsoaela/lumina_notes';
const releasesPage = 'https://github.com/$releasesRepo/releases';

class ReleaseInfo {
  const ReleaseInfo({
    required this.version,
    required this.pageUrl,
    this.apkUrl,
    this.apkSize,
    this.publishedAt,
  });

  final String version;
  final String pageUrl;
  final String? apkUrl;
  final int? apkSize;
  final DateTime? publishedAt;

  bool get isNewer => compareVersions(version, appVersion) > 0;

  factory ReleaseInfo.fromGitHub(Map<String, dynamic> j) {
    final tag = (j['tag_name'] ?? '').toString().replaceFirst(RegExp('^v', caseSensitive: false), '');
    final assets = (j['assets'] as List? ?? const []).cast<Map<String, dynamic>>();
    final apk = assets.where((a) => (a['name'] ?? '').toString().toLowerCase().endsWith('.apk')).firstOrNull;
    return ReleaseInfo(
      version: tag,
      pageUrl: (j['html_url'] ?? releasesPage).toString(),
      apkUrl: apk?['browser_download_url']?.toString(),
      apkSize: (apk?['size'] as num?)?.toInt(),
      publishedAt: DateTime.tryParse((j['published_at'] ?? '').toString()),
    );
  }
}

List<int> _parts(String v) => v
    .trim()
    .replaceFirst(RegExp('^v', caseSensitive: false), '')
    .split(RegExp(r'[-+]'))
    .first
    .split('.')
    .map((p) => int.tryParse(p) ?? 0)
    .toList();

/// > 0 when [a] is newer than [b].
int compareVersions(String a, String b) {
  final pa = _parts(a), pb = _parts(b);
  for (var i = 0; i < (pa.length > pb.length ? pa.length : pb.length); i++) {
    final d = (i < pa.length ? pa[i] : 0) - (i < pb.length ? pb[i] : 0);
    if (d != 0) return d;
  }
  return 0;
}

/// Latest GitHub release. Throws on network / HTTP errors.
Future<ReleaseInfo> fetchLatestRelease({http.Client? client}) async {
  final c = client ?? http.Client();
  try {
    final res = await c
        .get(
          Uri.parse('https://api.github.com/repos/$releasesRepo/releases/latest'),
          headers: {'Accept': 'application/vnd.github+json'},
        )
        .timeout(const Duration(seconds: 12));
    if (res.statusCode != 200) throw Exception('Update check failed (${res.statusCode})');
    final info = ReleaseInfo.fromGitHub(jsonDecode(res.body) as Map<String, dynamic>);
    if (info.version.isEmpty) throw const FormatException('Release has no version tag');
    return info;
  } finally {
    if (client == null) c.close();
  }
}
