import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/widgets.dart';

import '../data/local_repository.dart';
import 'sync_engine.dart';

/// Decides *when* to sync: at start, when the network comes back, when the app
/// returns to the foreground, shortly after local edits, and periodically.
class SyncScheduler with WidgetsBindingObserver {
  SyncScheduler(
    this.engine,
    this.repo, {
    Stream<bool>? online,
    this.debounce = const Duration(seconds: 2),
    this.periodic = const Duration(seconds: 60),
    this.observeLifecycle = true,
  }) : _online = online ?? _connectivity();

  final SyncEngine engine;
  final LocalRepository repo;
  final Duration debounce;
  final Duration periodic;
  final bool observeLifecycle;
  final Stream<bool> _online;

  final List<StreamSubscription<Object?>> _subs = [];
  Timer? _debounceTimer;
  Timer? _periodicTimer;
  bool? _wasOnline;

  static Stream<bool> _connectivity() =>
      Connectivity().onConnectivityChanged.map((r) => r.any((c) => c != ConnectivityResult.none));

  void start({bool syncImmediately = true}) {
    _subs.add(_online.listen((up) {
      if (up && _wasOnline != true) engine.syncNow();
      _wasOnline = up;
    }, onError: (_) {}));
    _subs.add(repo.localEdits.listen((_) {
      _debounceTimer?.cancel();
      _debounceTimer = Timer(debounce, engine.syncNow);
    }));
    _periodicTimer = Timer.periodic(periodic, (_) => engine.syncNow());
    if (observeLifecycle) WidgetsBinding.instance.addObserver(this);
    if (syncImmediately) engine.syncNow();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) engine.syncNow();
  }

  void dispose() {
    for (final s in _subs) {
      s.cancel();
    }
    _debounceTimer?.cancel();
    _periodicTimer?.cancel();
    if (observeLifecycle) WidgetsBinding.instance.removeObserver(this);
  }
}
