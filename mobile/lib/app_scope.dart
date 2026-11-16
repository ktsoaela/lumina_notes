import 'package:flutter/widgets.dart';

import 'data/api_client.dart';
import 'data/local_db.dart';
import 'data/local_repository.dart';
import 'data/models.dart';
import 'data/notes_repository.dart';
import 'data/session_store.dart';

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
  })  : _apiFactory = apiFactory ?? ((url, token) => ApiClient(baseUrl: url, token: token)),
        _local = local,
        _repoFactory = repoFactory {
    if (session.isSignedIn) _connect();
  }

  final SessionStore session;
  final ApiFactory _apiFactory;
  final RepoFactory? _repoFactory; // tests: bypass the local DB
  LocalRepository? _local;

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
    _api = _apiFactory(session.serverUrl!, session.token);
    _repo = _repoFactory?.call(_api!) ?? local;
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

  /// Replace an expired token without touching local data or the outbox.
  Future<void> refreshToken(AuthResult auth) async {
    await session.saveSession(auth);
    _api?.token = auth.token;
    notifyListeners();
  }

  /// Signs out and wipes the local DB (including unsynced changes).
  Future<void> signOut() async {
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
