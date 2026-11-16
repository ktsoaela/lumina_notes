import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lumina_notes/data/local_repository.dart';
import 'package:lumina_notes/sync/sync_engine.dart';
import 'package:lumina_notes/sync/sync_scheduler.dart';
import 'package:lumina_notes/ui/sync_status_chip.dart';

import 'fakes.dart';

void main() {
  late LocalRepository local;
  late SyncEngine engine;

  setUp(() {
    local = memoryLocal();
    engine = SyncEngine(local, FakeApiClient(), retry: false);
  });
  tearDown(() async {
    engine.dispose();
    await local.db.close();
  });

  Future<void> pumpChip(WidgetTester tester, {VoidCallback? onSignInAgain}) => tester.pumpWidget(MaterialApp(
        home: Scaffold(
          appBar: AppBar(actions: [SyncStatusChip(engine: engine, onSignInAgain: onSignInAgain ?? () {})]),
        ),
      ));

  const labels = {
    SyncState.idle: 'Synced',
    SyncState.syncing: 'Syncing…',
    SyncState.offline: 'Offline',
    SyncState.error: 'Sync error',
    SyncState.authExpired: 'Sign in again',
  };
  for (final e in labels.entries) {
    testWidgets('label for ${e.key.name} is "${e.value}"', (tester) async {
      await pumpChip(tester);
      engine.debugSetState(e.key);
      await tester.pump();
      expect(find.text(e.value), findsOneWidget);
    });
  }

  testWidgets('shows pending count when there are unsynced changes', (tester) async {
    await pumpChip(tester);
    engine.debugSetState(SyncState.offline, pendingCount: 3);
    await tester.pump();
    expect(find.text('Offline · 3'), findsOneWidget);
  });

  testWidgets('tap on Sign in again calls onSignInAgain', (tester) async {
    var called = 0;
    await pumpChip(tester, onSignInAgain: () => called++);
    engine.debugSetState(SyncState.authExpired);
    await tester.pump();
    await tester.tap(find.text('Sign in again'));
    expect(called, 1);
  });

  group('SyncScheduler', () {
    test('local edits trigger a debounced sync; remote applies do not', () async {
      final server = FakeApiClient();
      final eng = SyncEngine(local, server, retry: false);
      final connectivity = StreamController<bool>();
      final sched = SyncScheduler(
        eng,
        local,
        online: connectivity.stream,
        debounce: const Duration(milliseconds: 50),
        periodic: const Duration(hours: 1),
        observeLifecycle: false,
      )..start(syncImmediately: false);

      await local.applyRemote(bookshelves: []); // remote apply: must not schedule a sync
      await Future<void>.delayed(const Duration(milliseconds: 120));
      expect(server.pushCalls, 0);

      await local.createBookshelf('Typed on phone');
      await Future<void>.delayed(const Duration(milliseconds: 150));
      expect(server.pushCalls, 1);
      expect(server.shelves.values.map((b) => b.name), contains('Typed on phone'));

      sched.dispose();
      eng.dispose();
      await connectivity.close();
    });

    test('coming back online triggers a sync', () async {
      final server = FakeApiClient();
      final eng = SyncEngine(local, server, retry: false);
      final connectivity = StreamController<bool>();
      final sched = SyncScheduler(
        eng,
        local,
        online: connectivity.stream,
        periodic: const Duration(hours: 1),
        observeLifecycle: false,
      )..start(syncImmediately: false);
      await local.createBookshelf('queued');
      connectivity.add(false);
      await Future<void>.delayed(const Duration(milliseconds: 20));
      connectivity.add(true);
      await Future<void>.delayed(const Duration(milliseconds: 100));
      expect(server.shelves.values.map((b) => b.name), contains('queued'));
      sched.dispose();
      eng.dispose();
      await connectivity.close();
    });
  });
}
