import 'package:flutter_test/flutter_test.dart';
import 'package:lumina_notes/data/api_client.dart';
import 'package:lumina_notes/data/local_repository.dart';
import 'package:lumina_notes/data/models.dart';
import 'package:lumina_notes/sync/sync_engine.dart';

import 'fakes.dart';

void main() {
  late FakeApiClient server;
  late LocalRepository local;
  late SyncEngine engine;

  setUp(() {
    server = FakeApiClient();
    local = memoryLocal();
    engine = SyncEngine(local, server, retry: false);
  });
  tearDown(() async {
    engine.dispose();
    await local.db.close();
  });

  test('offline edit then sync pushes and clears outbox', () async {
    final b = await local.createBookshelf('Phone shelf');
    final n = await local.createNotebook(b.id, 'Book');
    final s = await local.createSection(n.id, 'Ch');
    final p = await local.createPage(s.id, 'Page');
    await local.savePage(p.copyWith(content: 'written offline'));

    await engine.syncNow();

    expect(engine.state, SyncState.idle);
    expect(await local.pendingOps(), isEmpty);
    expect(server.pagesById[p.id]!.content, 'written offline');
    expect(server.sectionsById, contains(s.id));
    expect(engine.lastSyncedAt, isNotNull);
  });

  test('pull applies remote page', () async {
    server.seed(content: 'from desktop');
    await engine.syncNow();
    expect((await local.page('page-1'))!.content, 'from desktop');
    expect((await local.bookshelves()).single.name, 'My bookshelf');
  });

  test('cursor persisted after pull and used next time', () async {
    server.seed();
    await engine.syncNow();
    final c1 = await local.meta('cursor');
    expect(c1, isNotNull);
    server.serverEditPage('page-1', 'later edit');
    await engine.syncNow();
    expect((await local.page('page-1'))!.content, 'later edit');
    expect(await local.meta('cursor'), isNot(c1));
  });

  test('pull skips entity with pending op', () async {
    server.seed(content: 'v1');
    await engine.syncNow();
    final p = (await local.page('page-1'))!;
    await local.savePage(p.copyWith(content: 'mine, unsent'));
    server.serverEditPage('page-1', 'server v2');
    server.dropPushResponses = true; // push "lost": op stays queued

    await engine.syncNow();

    expect((await local.page('page-1'))!.content, 'mine, unsent');
    expect(await local.hasPending(EntityKind.page, 'page-1'), isTrue);
  });

  test('stale push result replaces local with current', () async {
    server.seed(content: 'v1');
    await engine.syncNow();
    final p = (await local.page('page-1'))!;
    await local.savePage(p.copyWith(content: 'phone edit'));
    // Desktop saved later than the phone's edit.
    server.serverEditPage('page-1', 'desktop wins', at: DateTime.now().toUtc().add(const Duration(hours: 1)));

    await engine.syncNow();

    expect((await local.page('page-1'))!.content, 'desktop wins');
    expect(await local.pendingOps(), isEmpty);
  });

  test('newer phone edit wins over older server version', () async {
    server.seed(content: 'v1');
    await engine.syncNow();
    final p = (await local.page('page-1'))!;
    await local.savePage(p.copyWith(content: 'phone newer'));
    await engine.syncNow();
    expect(server.pagesById['page-1']!.content, 'phone newer');
    expect((await local.page('page-1'))!.content, 'phone newer');
  });

  test('rejected_op_applies_current_state', () async {
    server.seed();
    await engine.syncNow();
    // Desktop deletes the notebook; phone (not yet pulled) adds a page under it.
    server.serverDelete(EntityKind.notebook, 'nb-1');
    final orphan = await local.createPage('sec-1', 'Orphan');

    await engine.syncNow();

    expect(await local.page(orphan.id), isNull);
    expect(await local.notebooks('bs-1'), isEmpty); // tombstone pulled
    expect(await local.pendingOps(), isEmpty);
  });

  test('remote delete removes local rows', () async {
    server.seed();
    await engine.syncNow();
    server.serverDelete(EntityKind.page, 'page-1');
    await engine.syncNow();
    expect(await local.page('page-1'), isNull);
  });

  test('sync_auth_expired_keeps_outbox', () async {
    await local.createBookshelf('Unsent');
    server.syncError = const ApiException(401, 'Not authenticated');
    await engine.syncNow();
    expect(engine.state, SyncState.authExpired);
    expect(await local.pendingOps(), hasLength(1));

    // Re-login: engine resumes.
    server.syncError = null;
    await engine.syncNow();
    expect(engine.state, SyncState.idle);
    expect(await local.pendingOps(), isEmpty);
  });

  test('socket error sets offline', () async {
    await local.createBookshelf('Unsent');
    server.syncError = NetworkException(Exception('no route'));
    await engine.syncNow();
    expect(engine.state, SyncState.offline, reason: engine.lastError);
    expect(await local.pendingOps(), hasLength(1));
  });

  test('other server errors set error with message', () async {
    server.syncError = const ApiException(500, 'Boom');
    await engine.syncNow();
    expect(engine.state, SyncState.error);
    expect(engine.lastError, 'Boom');
  });

  test('concurrent syncNow calls share one run plus one follow-up', () async {
    server.seed();
    await Future.wait([engine.syncNow(), engine.syncNow(), engine.syncNow()]);
    expect(server.pushCalls, lessThanOrEqualTo(2));
    expect(engine.state, SyncState.idle);
  });

  test('edit made during a push is not lost', () async {
    server.seed(content: 'v1');
    await engine.syncNow();
    final p = (await local.page('page-1'))!;
    await local.savePage(p.copyWith(content: 'first'));
    // Next push: before results come back, the user types again.
    server.beforePush = () => local.savePage(p.copyWith(content: 'second'));
    await engine.syncNow();
    server.beforePush = null;
    await engine.syncNow();
    expect(server.pagesById['page-1']!.content, 'second');
    expect((await local.page('page-1'))!.content, 'second');
  });
}
