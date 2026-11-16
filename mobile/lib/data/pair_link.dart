import 'session_store.dart' show normalizeServerUrl;

/// A scanned / opened `lumina://pair?u=<server>&c=<code>` link from Profile → Devices & sync.
class PairLink {
  const PairLink(this.serverUrl, this.code);

  /// Normalized server base URL (same rules as [normalizeServerUrl]).
  final String serverUrl;

  /// Single-use pairing code, upper-cased; null when the link only names a server.
  final String? code;
}

/// Parses a pairing link, or returns null if [raw] is not one (any other QR, bad url).
PairLink? parsePairLink(String raw) {
  final uri = Uri.tryParse(raw.trim());
  if (uri == null || uri.scheme != 'lumina' || uri.host != 'pair') return null;
  final String server;
  try {
    server = normalizeServerUrl(uri.queryParameters['u'] ?? '');
  } on FormatException {
    return null;
  }
  final code = uri.queryParameters['c']?.trim().toUpperCase();
  return PairLink(server, (code == null || code.isEmpty) ? null : code);
}
