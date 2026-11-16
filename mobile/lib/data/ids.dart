import 'dart:math';

import 'models.dart';

final _rand = Random.secure();

const _prefixes = {
  EntityKind.bookshelf: 'bs',
  EntityKind.notebook: 'nb',
  EntityKind.section: 'sec',
  EntityKind.page: 'page',
};

/// Client-generated id accepted by the server regex `^[A-Za-z0-9._:-]+$` (max 64).
/// Format: `<prefix>-<epochMillis>-<8 hex>`.
String newId(EntityKind kind) {
  final millis = DateTime.now().millisecondsSinceEpoch;
  final suffix = _rand.nextInt(1 << 32).toRadixString(16).padLeft(8, '0');
  return '${_prefixes[kind]}-$millis-$suffix';
}
