import 'package:flutter/widgets.dart';

import 'data/api_client.dart';
import 'data/models.dart';
import 'data/notes_repository.dart';
import 'data/remote_repository.dart';
import 'data/session_store.dart';

typedef ApiFactory = ApiClient Function(String baseUrl, String? token);
typedef RepoFactory = NotesRepository Function(ApiClient api);

/// App-wide services. Notifies when the user signs in or out.
class AppServices extends ChangeNotifier {
  AppServices({
    required this.session,
    ApiFactory? apiFactory,
    RepoFactory? repoFactory,
  })  : _apiFactory = apiFactory ?? ((url, token) => ApiClient(baseUrl: url, token: token)),
        _repoFactory = repoFactory ?? RemoteRepository.new {
    if (session.isSignedIn) _connect();
  }

  final SessionStore session;
  final ApiFactory _apiFactory;
  final RepoFactory _repoFactory;

  ApiClient? _api;
  NotesRepository? _repo;

  bool get isSignedIn => session.isSignedIn && _repo != null;

  /// Client for the signed-in server. Only valid when [isSignedIn].
  ApiClient get api => _api!;

  /// Notes for the signed-in user. Only valid when [isSignedIn].
  NotesRepository get repo => _repo!;

  /// An unauthenticated client for a server the user is about to connect to.
  ApiClient apiFor(String baseUrl) => _apiFactory(baseUrl, null);

  void _connect() {
    _api = _apiFactory(session.serverUrl!, session.token);
    _repo = _repoFactory(_api!);
  }

  Future<void> signIn(String serverUrl, AuthResult auth) async {
    await session.saveServerUrl(serverUrl);
    await session.saveSession(auth);
    _connect();
    notifyListeners();
  }

  Future<void> signOut() async {
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
