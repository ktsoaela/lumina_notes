import 'package:drift/drift.dart' show driftRuntimeOptions;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumina_notes/app_scope.dart';
import 'package:lumina_notes/data/local_db.dart';
import 'package:lumina_notes/data/local_repository.dart';
import 'package:lumina_notes/data/models.dart';
import 'package:lumina_notes/data/session_store.dart';

import 'fakes.dart';

void main() {
  driftRuntimeOptions.dontWarnAboutMultipleDatabases = true;

  late LocalRepository repo;
  setUp(() => repo = LocalRepository(LocalDb.forTesting(NativeDatabase.memory())));
  tearDown(() => repo.db.close());

  test('owner_change_wipes_local_db', () async {
    await ensureOwner(repo, 'http://a', 1);
    await repo.createBookshelf('Mine');
    await repo.setMeta('cursor', 'c');
    await ensureOwner(repo, 'http://a', 2);
    expect(await repo.bookshelves(), isEmpty);
    expect(await repo.meta('cursor'), isNull);
    expect(await repo.meta('owner'), 'http://a|2');
  });

  test('server url change also wipes', () async {
    await ensureOwner(repo, 'http://a', 1);
    await repo.createBookshelf('Mine');
    await ensureOwner(repo, 'http://b', 1);
    expect(await repo.bookshelves(), isEmpty);
  });

  test('same owner keeps data', () async {
    await ensureOwner(repo, 'http://a', 1);
    await repo.createBookshelf('Mine');
    await ensureOwner(repo, 'http://a', 1);
    expect((await repo.bookshelves()).single.name, 'Mine');
  });

  test('AppServices uses the local repository and signOut wipes it', () async {
    final session = SessionStore(MemoryKeyValueStore());
    await session.load();
    final services = AppServices(session: session, apiFactory: (_, _) => FakeApiClient(), local: repo);
    await services.signIn('http://a', const AuthResult(token: 't', user: User(id: 1, email: '', name: '')));
    expect(services.repo, same(repo));
    await services.repo.createBookshelf('Offline shelf');
    expect(await services.pendingCount(), 1);
    await services.signOut();
    expect(await repo.bookshelves(), isEmpty);
    expect(session.isSignedIn, isFalse);
  });
}
