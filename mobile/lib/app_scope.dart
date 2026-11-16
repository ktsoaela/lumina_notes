import 'package:flutter/widgets.dart';

import 'data/api_client.dart';
import 'data/local_db.dart';
import 'data/local_repository.dart';
import 'data/models.dart';
import 'data/notes_repository.dart';
import 'data/session_store.dart';
import 'sync/sync_engine.dart';
import 'sync/sync_scheduler.dart';

typedef ApiFactory = ApiClient Function(String baseUrl, String? token);
typedef RepoFactory = NotesRepository Function(ApiClient api);

/// App-wide services. Notifies when the user signs in or out.
///
/// Notes are read and written through the local Drift DB ([local]); the sync
/// engine moves changes to and from the server.
class AppServices extends ChangeNotifier {
  AppServices({
    required this.session,
    ApiFactory? apiFactory,
    LocalRepository? local,
    RepoFactory? repoFactory,
    this.autoSync = true,
  })  : _apiFactory = apiFactory ?? ((url, token) => ApiClient(baseUrl: url, token: token)),
        _local = local, // ignore: prefer_initializing_formals
        _repoFactory = repoFactory { // ignore: prefer_initializing_formals
    if (session.isSignedIn) _connect();
  }

  final SessionStore session;
  final ApiFactory _apiFactory;
  final RepoFactory? _repoFactory; // tests: bypass the local DB
  LocalRepository? _local;

  /// Start the sync scheduler on sign-in (off in widget tests: no plugins).
  final bool autoSync;

  SyncEngine? _sync;
  SyncScheduler? _scheduler;

  /// The sync engine for the signed-in user (null when not using the local DB).
  SyncEngine? get sync => _sync;

  ApiClient? _api;
  NotesRepository? _repo;

  bool get isSignedIn => session.isSignedIn && _repo != null;

  /// The local store (created on first use).
  LocalRepository get local => _local ??= LocalRepository(LocalDb());

  /// Client for the signed-in server. Only valid when [isSignedIn].
  ApiClient get api => _api!;

  /// Notes for the signed-in user. Only valid when [isSignedIn].
  NotesRepository get repo => _repo!;

  /// An unauthenticated client for a server the user is about to connect to.
  ApiClient apiFor(String baseUrl) => _apiFactory(baseUrl, null);

  void _connect() {
    _stopSync();
    _api = _apiFactory(session.serverUrl!, session.token);
    _repo = _repoFactory?.call(_api!) ?? local;
    if (_repoFactory == null) {
      _sync = SyncEngine(local, _api!, retry: autoSync);
      if (autoSync) _scheduler = SyncScheduler(_sync!, local)..start();
    }
  }

  void _stopSync() {
    _scheduler?.dispose();
    _scheduler = null;
    _sync?.dispose();
    _sync = null;
  }

  Future<int> pendingCount() async => _repoFactory == null ? local.pendingCount() : 0;

  Future<void> signIn(String serverUrl, AuthResult auth) async {
    final url = normalizeServerUrl(serverUrl);
    if (_repoFactory == null) await ensureOwner(local, url, auth.user.id);
    await session.saveServerUrl(url);
    await session.saveSession(auth);
    _connect();
    notifyListeners();
  }

  /// Signs out and wipes the local DB (including unsynced changes).
  Future<void> signOut() async {
    _stopSync();
    if (_repoFactory == null && _local != null) await _local!.wipe();
    await session.clearSession();
    _api = null;
    _repo = null;
    notifyListeners();
  }
}

class AppScope extends InheritedNotifier<AppServices> {
  const AppScope({super.key, required AppServices services, required super.child})
      : super(notifier: services);

  static AppServices of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, 'AppScope missing above $context');
    return scope!.notifier!;
  }
}
