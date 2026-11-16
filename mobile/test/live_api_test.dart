// Runs only against a real server:
//   LUMINA_LIVE_API=http://127.0.0.1:58888 flutter test test/live_api_test.dart
// Needs the dev demo seed (SEED_DEMO_USER=1, the default outside production).
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:lumina_notes/data/api_client.dart';
import 'package:lumina_notes/data/models.dart';
import 'package:lumina_notes/data/remote_repository.dart';
import 'package:lumina_notes/sync/sync_engine.dart';

import 'fakes.dart' show memoryLocal;

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

  test('offline edits sync to the server and desktop edits sync back (definition of done)', () async {
    final login = await ApiClient(baseUrl: url!).login('demo_user', 'demo_user');
    final local = memoryLocal();
    // Start "offline": nothing listens on this port.
    final offlineApi = ApiClient(baseUrl: 'http://127.0.0.1:9', token: login.token);
    final engine = SyncEngine(local, ApiClient(baseUrl: url, token: login.token), retry: false);

    // 1. First sync online: phone gets the account's notebooks.
    await engine.syncNow();
    expect(engine.state, SyncState.idle, reason: engine.lastError);
    final shelf = (await local.bookshelves()).first;
    final welcome = (await local.notebooks(shelf.id)).firstWhere((n) => n.name == 'Welcome');
    final section = (await local.sections(welcome.id)).first;
    final existing = (await local.pages(section.id)).first;

    // 2. Network gone: edit an existing page and create a new one.
    engine.api = offlineApi;
    await local.savePage(existing.copyWith(content: '${existing.content}\n\nEdited offline on the phone'));
    final created = await local.createPage(section.id, 'Written offline');
    await local.savePage(created.copyWith(content: '# Offline page'));
    await engine.syncNow();
    expect(engine.state, SyncState.offline);
    expect(await local.pendingCount(), 2);

    // 3. Reconnect: changes reach the server, visible through Electron's endpoint.
    engine.api = ApiClient(baseUrl: url, token: login.token);
    await engine.syncNow();
    expect(engine.state, SyncState.idle, reason: engine.lastError);
    expect(await local.pendingCount(), 0);
    final desktop = ApiClient(baseUrl: url, token: login.token);
    final serverPages = {for (final p in await desktop.listPages(section.id)) p.id: p};
    expect(serverPages[existing.id]!.content, endsWith('Edited offline on the phone'));
    expect(serverPages[created.id]!.content, '# Offline page');

    // 4. Desktop edits the page via the legacy route; the phone picks it up.
    await desktop.updatePage(serverPages[created.id]!.copyWith(content: '# Edited on desktop'));
    await engine.syncNow();
    expect((await local.page(created.id))!.content, '# Edited on desktop');

    // 5. Desktop deletes it; the phone removes it.
    await desktop.delete(EntityKind.page, created.id);
    await engine.syncNow();
    expect(await local.page(created.id), isNull);

    // Restore the seeded page so the test can run again.
    await desktop.updatePage(existing);
    engine.dispose();
    await local.db.close();
  }, skip: url == null ? 'set LUMINA_LIVE_API to run' : false);
}
