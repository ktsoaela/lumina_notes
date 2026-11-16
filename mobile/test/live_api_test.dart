// Runs only against a real server:
//   LUMINA_LIVE_API=http://127.0.0.1:58888 flutter test test/live_api_test.dart
// Needs the dev demo seed (SEED_DEMO_USER=1, the default outside production).
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:lumina_notes/data/api_client.dart';
import 'package:lumina_notes/data/models.dart';
import 'package:lumina_notes/data/remote_repository.dart';

void main() {
  final url = Platform.environment['LUMINA_LIVE_API'];

  test('demo_user can browse, create, edit and delete against the live API', () async {
    final api = ApiClient(baseUrl: url!);
    expect(await api.health(), isTrue);
    final auth = await api.login('demo_user', 'demo_user');
    api.token = auth.token;
    final repo = RemoteRepository(api);

    final shelves = await repo.bookshelves();
    expect(shelves, isNotEmpty);
    final notebooks = await repo.notebooks(shelves.first.id);
    expect(notebooks.map((n) => n.name), contains('Welcome'));

    final nb = await repo.createNotebook(shelves.first.id, 'Flutter live test');
    final sec = await repo.createSection(nb.id, 'Phone');
    final page = await repo.createPage(sec.id, 'From Flutter');
    await repo.savePage(page.copyWith(content: '# Written on mobile'));

    // Re-read via the same endpoint Electron uses.
    final fresh = await ApiClient(baseUrl: url, token: auth.token).listPages(sec.id);
    expect(fresh.single.content, '# Written on mobile');

    await repo.delete(EntityKind.notebook, nb.id);
    expect((await repo.notebooks(shelves.first.id)).map((n) => n.id), isNot(contains(nb.id)));
  }, skip: url == null ? 'set LUMINA_LIVE_API to run' : false);
}
