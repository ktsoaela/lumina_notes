import 'package:flutter_test/flutter_test.dart';
import 'package:lumina_notes/data/ids.dart';
import 'package:lumina_notes/data/models.dart';

void main() {
  test('newId matches server id rules and kind prefix', () {
    final re = RegExp(r'^[A-Za-z0-9._:-]+$');
    final prefixes = {
      EntityKind.bookshelf: 'bs-',
      EntityKind.notebook: 'nb-',
      EntityKind.section: 'sec-',
      EntityKind.page: 'page-',
    };
    for (final e in prefixes.entries) {
      final id = newId(e.key);
      expect(re.hasMatch(id), isTrue, reason: id);
      expect(id.length, lessThanOrEqualTo(64));
      expect(id, startsWith(e.value));
    }
  });

  test('newId is unique across rapid calls', () {
    final ids = List.generate(500, (_) => newId(EntityKind.page)).toSet();
    expect(ids.length, 500);
  });
}
