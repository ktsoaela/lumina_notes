import 'dart:async';
import 'dart:convert';
import 'dart:math';

import 'package:flutter/foundation.dart';

import '../data/api_client.dart';
import '../data/local_db.dart';
import '../data/local_repository.dart';
import '../data/models.dart';

enum SyncState { idle, syncing, offline, error, authExpired }

/// Moves changes between the local DB and the server.
///
/// One run = push the outbox (in order, batches of 200), then pull changes
/// since the stored cursor. Conflicts are settled by the server
/// (last-write-wins); `stale`/`rejected` results carry the server's row, which
/// replaces the local one.
class SyncEngine extends ChangeNotifier {
  SyncEngine(this.repo, this.api, {this.retry = true});

  final LocalRepository repo;
  ApiClient api;

  /// Schedule automatic retries with backoff after offline/error (off in tests).
  final bool retry;

  static const batchSize = 200;

  SyncState state = SyncState.idle;
  DateTime? lastSyncedAt;
  String? lastError;
  int pending = 0;

  Future<void>? _running;
  bool _again = false;
  int _failures = 0;
  Timer? _retryTimer;
  bool _disposed = false;

  /// Runs a sync. A call during a run queues exactly one follow-up run.
  Future<void> syncNow() {
    if (_running != null) {
      _again = true;
      return _running!;
    }
    final run = _loop();
    _running = run;
    return run.whenComplete(() => _running = null);
  }

  Future<void> _loop() async {
    do {
      _again = false;
      await _runOnce();
    } while (_again && !_disposed && state == SyncState.idle);
  }

  void _set(SyncState s, {String? error}) {
    state = s;
    lastError = error;
    if (!_disposed) notifyListeners();
  }

  Future<void> _runOnce() async {
    _retryTimer?.cancel();
    _set(SyncState.syncing);
    try {
      await _push();
      await _pull();
      _failures = 0;
      lastSyncedAt = DateTime.now();
      pending = await repo.pendingCount();
      _set(SyncState.idle);
    } on ApiException catch (e) {
      if (e.isAuthError) {
        _set(SyncState.authExpired, error: 'Sign in again to sync');
        return; // no retry until the user signs in again
      }
      await _fail(SyncState.error, e.message);
    } on NetworkException {
      await _fail(SyncState.offline, 'Cannot reach server');
    } catch (e) {
      await _fail(SyncState.error, e.toString());
    }
  }

  Future<void> _fail(SyncState s, String message) async {
    _failures++;
    pending = await repo.pendingCount();
    _set(s, error: message);
    if (retry && !_disposed) {
      final secs = min(pow(2, _failures).toInt(), 60);
      _retryTimer = Timer(Duration(seconds: secs), syncNow);
    }
  }

  Future<void> _push() async {
    while (true) {
      final batch = await repo.pendingOps(limit: batchSize);
      if (batch.isEmpty) return;
      final ops = <PushOp>[];
      for (final e in batch) {
        final kind = entityKindFromWire(e.entity);
        ops.add(PushOp(
          opId: '${e.seq}',
          entity: kind,
          op: e.op,
          id: e.entityId,
          clientUpdatedAt: e.clientUpdatedAt,
          baseUpdatedAt: e.op == 'delete' ? e.baseUpdatedAt : await repo.serverVersion(kind, e.entityId),
          data: e.op == 'upsert' ? jsonDecode(e.payload) as Map<String, dynamic> : null,
        ));
      }
      final results = {for (final r in await api.push(ops)) r.opId: r};
      var progressed = false;
      for (final e in batch) {
        final r = results['${e.seq}'];
        if (r == null) continue; // no answer: keep the op, retry next run
        progressed = true;
        await _settle(e, r);
      }
      if (!progressed) return; // avoid spinning on a server that answers nothing
    }
  }

  Future<void> _settle(OutboxEntry e, PushResult r) async {
    final kind = entityKindFromWire(e.entity);
    // If the user edited the row again while this push was in flight, the
    // outbox entry changed: keep it so the newer edit is pushed next.
    await repo.removeOpIfUnchanged(e);
    final stillPending = await repo.hasPending(kind, e.entityId);
    switch (r.status) {
      case 'applied':
        if (r.updatedAt != null && e.op == 'upsert') {
          await repo.markPushed(kind, e.entityId, r.updatedAt!);
        }
      case 'stale' || 'rejected':
        if (stillPending) return;
        final cur = r.current;
        if (cur == null) {
          await repo.forgetLocal(kind, e.entityId);
        } else {
          await _applyCurrent(kind, cur);
        }
    }
  }

  Future<void> _applyCurrent(EntityKind kind, Map<String, dynamic> row) => switch (kind) {
        EntityKind.bookshelf => repo.applyRemote(bookshelves: [Bookshelf.fromJson(row)]),
        EntityKind.notebook => repo.applyRemote(notebooks: [Notebook.fromJson(row)]),
        EntityKind.section => repo.applyRemote(sections: [Section.fromJson(row)]),
        EntityKind.page => repo.applyRemote(pages: [NotePage.fromJson(row)]),
      };

  Future<void> _pull() async {
    final c = await api.changes(await repo.meta('cursor'));
    await repo.applyRemote(
      bookshelves: c.bookshelves,
      notebooks: c.notebooks,
      sections: c.sections,
      pages: c.pages,
      tombstones: c.tombstones,
    );
    await repo.setMeta('cursor', c.cursor);
  }

  @visibleForTesting
  void debugSetState(SyncState s, {int pendingCount = 0, String? error}) {
    pending = pendingCount;
    _set(s, error: error);
  }

  @override
  void dispose() {
    _disposed = true;
    _retryTimer?.cancel();
    super.dispose();
  }
}
