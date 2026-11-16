# Lumina Flutter Mobile + Offline Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Flutter Android/iOS/tablet client for Lumina Notes that reads and writes a local Drift DB and syncs with the existing FastAPI server (last-write-wins), while Electron keeps working unchanged.

**Architecture:** UI talks only to a `NotesRepository` interface. Phase 1 ships a `RemoteRepository` (REST + JWT); Phase 2 swaps in a `LocalRepository` (Drift) that records every mutation in an outbox. Phase 3 adds two additive server endpoints (`GET /api/sync/changes`, `POST /api/sync/push`) plus `updatedAt` on all four hierarchy tables and a tombstone table; a `SyncEngine` pulls changes and pushes the outbox.

**Tech Stack:** Flutter 3.47.9 / Dart 3.13.7 (`C:\Users\khots\flutter\bin`), `http`, `flutter_secure_storage`, `drift` + `drift_flutter`, `connectivity_plus`, `flutter_markdown_plus`; server: FastAPI + SQLite/Postgres (`app.py`, `db.py`), pytest.

**Spec:** `docs/superpowers/specs/2026-11-16-flutter-mobile-offline-sync-design.md` and `docs/superpowers/specs/CLAUDE_INIT_FLUTTER_MOBILE.md`

## Global Constraints

- Do not remove or rewrite Electron, stick'n, or the React web app. Existing `/api/...` routes keep their request/response shapes; only additive changes are allowed.
- FastAPI is the source of truth. No new cloud vendor.
- Never commit `.env*`, `*.sqlite`, or tokens. `mobile/build/` is already covered by the root `.gitignore` `build/` rule.
- Flutter project root: `mobile/` (`pubspec.yaml` there). Dart package name `lumina_notes`, org `com.lumina` → Android applicationId / iOS bundle id `com.lumina.lumina_notes`, so rename it to `com.lumina.notes` (matches desktop).
- App display name: `Lumina Notes`.
- Conflict policy v1: last-write-wins by timestamp, documented in `mobile/README.md` and `docs/features/sync.md`.
- Entity ids are made on the client and must match the server regex `^[A-Za-z0-9._:-]+$`, max 64 chars. Format: `<prefix>-<epochMillis>-<4 hex>`, with prefixes `bs`, `nb`, `sec`, `page`.
- Avoid the class name `Page` (it clashes with Flutter's `Page`). The model is `NotePage`.
- Run Flutter commands with `C:\Users\khots\flutter\bin` on PATH.

## Review Focus

1. **The JWT expires after 24h while the phone is offline.** Expected: sync shows `authExpired`, local data and the outbox are kept, and logging in again resumes the push. (Task 9 test `sync_auth_expired_keeps_outbox`.)
2. **A different user, or a different server URL, signs in on the same device.** Expected: the local DB is wiped before the first pull, so data from different owners never mixes. (Task 7 test `owner_change_wipes_local_db`.)
3. **A response is lost mid-push and the op is retried.** Expected: an idempotent upsert, with no 500 and no duplicate. (Task 8 test `test_push_upsert_is_idempotent`.)
4. **A parent is deleted on desktop while a child is edited offline on the phone.** Expected: the push result rejects the child, and the client removes it locally without looping forever. (Task 8 test `test_push_child_of_deleted_parent_rejected`; Task 9 test `rejected_op_applies_current_state`.)
5. **Self-hosted LAN servers use plain `http://`.** Expected: Android and iOS allow cleartext, so `http://192.168.x.x:58888` works. (Task 1 manifest/plist steps; verified manually in Task 12.)

---

## Phase 0 + 1: scaffold and online client

### Task 1: Scaffold `mobile/`

**Files:**
- Create: `mobile/` via `flutter create --org com.lumina --project-name lumina_notes --platforms android,ios mobile`
- Modify: `mobile/android/app/build.gradle(.kts)` with `applicationId = "com.lumina.notes"`, and `namespace` to match
- Modify: `mobile/android/app/src/main/AndroidManifest.xml`: `android:label="Lumina Notes"`, `android:usesCleartextTraffic="true"`, `<uses-permission android:name="android.permission.INTERNET"/>`
- Modify: `mobile/ios/Runner/Info.plist`: `CFBundleDisplayName` = `Lumina Notes`, `NSAppTransportSecurity` → `NSAllowsArbitraryLoads` = true, `NSAllowsLocalNetworking` = true
- Modify: `mobile/ios/Runner.xcodeproj/project.pbxproj`: `PRODUCT_BUNDLE_IDENTIFIER = com.lumina.notes`
- Create: `mobile/README.md` (run, point at API, `flutter build apk`)
- Replace: `mobile/lib/main.dart` (placeholder `LuminaApp` → `MaterialApp(title: 'Lumina Notes')`), `mobile/test/widget_test.dart`

- [ ] Step 1: Run `flutter create` and add the deps with `flutter pub add http flutter_secure_storage`.
- [ ] Step 2: Write `test/widget_test.dart`: pump `LuminaApp` and expect `find.text('Lumina Notes')`.
- [ ] Step 3: Apply the manifest, plist, and id edits, and write the README.
- [ ] Step 4: `flutter analyze` → `No issues found!`; `flutter test` → all pass; `flutter build apk --debug` → `Built build\app\outputs\flutter-apk\app-debug.apk`.
- [ ] Step 5: Commit `feat(mobile): scaffold Flutter app`.

### Task 2: Models + `ApiClient`

**Files:**
- Create: `mobile/lib/data/models.dart`, `mobile/lib/data/api_client.dart`, `mobile/lib/data/ids.dart`
- Test: `mobile/test/api_client_test.dart`, `mobile/test/ids_test.dart`

**Interfaces (Produces):**
- `enum EntityKind { bookshelf, notebook, section, page }`, with `String get wire` returning `'bookshelf'|'notebook'|'section'|'page'`
- Immutable classes with `fromJson`/`toJson`, using JSON keys exactly as the server sends them:
  `Bookshelf(id, name, updatedAt?)`, `Notebook(id, name, bookshelfId, archived, updatedAt?)`, `Section(id, notebookId, name, updatedAt?)`, `NotePage(id, sectionId, title, content, updatedAt?)`. `updatedAt` is `DateTime?` (UTC). The parser accepts `"2026-11-16 10:00:00"`, ISO strings with `Z`, and null. `archived` accepts `0/1/bool`.
- `User(id:int, email, name, username?)`; `AuthResult(token, user)`
- `String newId(EntityKind kind)` → `bs-|nb-|sec-|page-` + millis + `-` + 4 hex
- `class ApiException implements Exception { final int status; final String message; }`. `message` comes from FastAPI `detail`: a string, or the first `msg` of a list.
- `class ApiClient { ApiClient({required String baseUrl, String? token, http.Client? client}); String? token; }` with methods:
  `Future<bool> health()`, `Future<AuthResult> login(String identifier, String password)`, `Future<AuthResult> signup({email, password, name, username})`, `Future<User> me()`,
  `Future<List<Bookshelf>> listBookshelves()`, `Future<List<Notebook>> listNotebooks(String bookshelfId)` (archived=false), `Future<List<Section>> listSections(String notebookId)`, `Future<List<NotePage>> listPages(String sectionId)`,
  `createBookshelf(Bookshelf)`, `createNotebook(Notebook)`, `createSection(Section)`, `createPage(NotePage)`, `renameBookshelf(id,name)`, `renameNotebook(id,name)`, `renameSection(id,name)`, `updatePage(NotePage)`, `delete(EntityKind, String id)`.
  Every request carries `Authorization: Bearer <token>` when a token is set, a 15 s timeout, and `Content-Type: application/json`.

- [ ] Step 1: Write the tests with `package:http/testing.dart` `MockClient`:
  `login posts identifier+password and parses token` (asserts path `/api/auth/login` and body `{"identifier":"a","password":"b"}`); `base url trailing slash is not doubled` (`http://h:1/` → `http://h:1/api/auth/me`); `401 detail becomes ApiException(401,'Invalid credentials')`; `422 list detail uses first msg`; `listNotebooks sends bookshelfId query`; `bearer header sent`; `delete page hits DELETE /api/pages/{id}`; `Notebook.fromJson accepts archived 1 and sqlite timestamp`; `newId matches ^[A-Za-z0-9._:-]+$ and length <= 64 and starts with "page-"`.
- [ ] Step 2: `flutter test test/api_client_test.dart test/ids_test.dart` → FAIL (missing files).
- [ ] Step 3: Implement.
- [ ] Step 4: Same command → PASS.
- [ ] Step 5: Commit `feat(mobile): REST client and models`.

### Task 3: `SessionStore`

**Files:**
- Create: `mobile/lib/data/session_store.dart`
- Test: `mobile/test/session_store_test.dart`

**Interfaces (Produces):**
- `abstract class KeyValueSecureStore { Future<String?> read(String k); Future<void> write(String k, String v); Future<void> delete(String k); }`, with `FlutterSecureKeyValueStore` (wraps `FlutterSecureStorage`) and `MemoryKeyValueStore` (tests).
- `String normalizeServerUrl(String input)`: trims, strips trailing `/`, and adds `http://` when there is no scheme. Throws `FormatException('Enter a valid server URL')` unless the result parses as http/https with a non-empty host.
- `class SessionStore extends ChangeNotifier { Future<void> load(); String? serverUrl; String? token; User? user; bool get isSignedIn; Future<void> saveServerUrl(String); Future<void> saveSession(AuthResult); Future<void> clearSession(); }`. Keys: `lumina.serverUrl`, `lumina.token`, `lumina.user` (JSON).

- [ ] Step 1: Tests: `normalizeServerUrl("  10.0.2.2:58888/ ") == "http://10.0.2.2:58888"`; `"https://notes.example.com/"` → `"https://notes.example.com"`; `""` and `"ftp://x"` throw FormatException; `saveSession then new SessionStore(same store).load() restores token and user`; `clearSession keeps serverUrl, drops token`.
- [ ] Step 2: Run → FAIL. Step 3: Implement. Step 4: Run → PASS.
- [ ] Step 5: Commit `feat(mobile): secure session store`.

### Task 4: `NotesRepository`, `RemoteRepository`, app wiring, auth UI

**Files:**
- Create: `mobile/lib/data/notes_repository.dart`, `mobile/lib/data/remote_repository.dart`, `mobile/lib/app_scope.dart`, `mobile/lib/ui/connect_screen.dart`
- Modify: `mobile/lib/main.dart`
- Test: `mobile/test/connect_screen_test.dart`, `mobile/test/fakes.dart`

**Interfaces (Produces):**
- ```dart
  abstract class NotesRepository {
    Stream<void> get changes;            // emits after any mutation or sync apply
    Future<List<Bookshelf>> bookshelves();
    Future<List<Notebook>> notebooks(String bookshelfId);   // non-archived
    Future<List<Section>> sections(String notebookId);
    Future<List<NotePage>> pages(String sectionId);
    Future<NotePage?> page(String id);
    Future<Bookshelf> createBookshelf(String name);
    Future<Notebook> createNotebook(String bookshelfId, String name);
    Future<Section> createSection(String notebookId, String name);
    Future<NotePage> createPage(String sectionId, String title);
    Future<void> savePage(NotePage page);
    Future<void> rename(EntityKind kind, String id, String name);
    Future<void> delete(EntityKind kind, String id);
  }
  ```
- `RemoteRepository(ApiClient api)` implements it via `ApiClient`, uses `newId`, and emits on `changes` after each mutation. `createPage` sends `content: ''`.
- `class AppServices { final SessionStore session; ApiClient api; NotesRepository repo; }` exposed by the `AppScope extends InheritedWidget` (`AppScope.of(context)`). No state-management package.
- `ConnectScreen`: Server URL field (prefilled from the session), a "Test connection" button (`api.health()` → snackbar `Connected` / `Cannot reach server`), a Login/Sign up toggle, and fields identifier+password (or email, name, username, password). On success it calls `session.saveSession`. `main.dart` shows `ConnectScreen` when `!isSignedIn`, otherwise `ShelvesScreen` (Task 5).
- `test/fakes.dart`: `FakeApiClient extends ApiClient` overriding the methods with in-memory maps. Later tasks reuse it.

- [ ] Step 1: Widget tests: `shows error text from ApiException on bad login` (fake throws `ApiException(401,'Invalid credentials')` → `find.text('Invalid credentials')`); `successful login saves session` (MemoryKeyValueStore has `lumina.token`); `invalid url shows "Enter a valid server URL"`.
- [ ] Step 2: Run → FAIL. Step 3: Implement. Step 4: Run → PASS; `flutter analyze` clean.
- [ ] Step 5: Commit `feat(mobile): connect and auth screens`.

### Task 5: Browse + edit UI (online)

**Files:**
- Create: `mobile/lib/ui/shelves_screen.dart`, `mobile/lib/ui/notebooks_screen.dart`, `mobile/lib/ui/sections_screen.dart`, `mobile/lib/ui/pages_screen.dart`, `mobile/lib/ui/page_editor_screen.dart`, `mobile/lib/ui/repo_list.dart`
- Test: `mobile/test/browse_test.dart`

**Interfaces:**
- Consumes: `NotesRepository`, `AppScope`.
- Produces: `RepoList<T>({required Future<List<T>> Function() load, required Widget Function(T) item})`. It re-runs `load` on each `repo.changes` event and on pull-to-refresh. It shows `CircularProgressIndicator` while loading, an empty state (`Nothing here yet`), and error text on failure.
- Each list screen has a FAB "New …" (a name dialog) and a long-press menu with Rename and Delete (with a confirm dialog). The shelves app bar has a Sign out action (`session.clearSession`).
- `PageEditorScreen(pageId)`: a title `TextField` and a multiline content `TextField`. It autosaves with `repo.savePage` 800 ms after the last keystroke and on pop. The app bar shows `Saved` / `Saving…`.

- [ ] Step 1: Widget tests with `RemoteRepository(FakeApiClient)` seeded with shelf→notebook→section→page: `tap through hierarchy opens editor with page content`; `typing in editor saves after debounce` (`tester.pump(Duration(milliseconds: 900))` → fake page content updated); `create notebook via FAB appears in list`; `delete asks for confirmation`.
- [ ] Step 2: Run → FAIL. Step 3: Implement. Step 4: Run → PASS.
- [ ] Step 5: Manual check: run the API (`python run_api.py`, port 58888), then `flutter run -d windows` (or an Android emulator with URL `http://10.0.2.2:58888`). Log in as `demo_user`/`demo_user`, open the Welcome page, edit it, and confirm with `curl` that `GET /api/pages/sec-nb-demo-welcome` shows the edit.
- [ ] Step 6: Commit `feat(mobile): browse and edit notes online`.

---

## Phase 2: offline store

### Task 6: Drift database + `LocalRepository` with outbox

**Files:**
- Create: `mobile/lib/data/local_db.dart` (+ generated `local_db.g.dart`), `mobile/lib/data/local_repository.dart`
- Test: `mobile/test/local_repository_test.dart`

**Interfaces (Produces):**
- Deps: `flutter pub add drift drift_flutter` and `flutter pub add -d drift_dev build_runner`. Generate with `dart run build_runner build -d`.
- Tables: `Bookshelves(id PK, name, updatedAt)`, `Notebooks(id PK, bookshelfId, name, archived bool, updatedAt)`, `Sections(id PK, notebookId, name, updatedAt)`, `Pages(id PK, sectionId, title, content, updatedAt)`, `Outbox(seq int autoincrement PK, entity text, entityId text, op text ('upsert'|'delete'), payload text JSON, clientUpdatedAt DateTime, attempts int default 0; unique(entity, entityId))`, `SyncMeta(key PK, value)`. `updatedAt` is the local UTC edit time.
- `LocalDb.forTesting(QueryExecutor e)`; production `LocalDb()` uses `driftDatabase(name: 'lumina')`.
- `LocalRepository(LocalDb db)` implements `NotesRepository`. Each mutation runs in one transaction: it writes the row with `updatedAt = DateTime.now().toUtc()` and enqueues through the method below.
- `Future<void> enqueue(EntityKind kind, String id, String op, Map<String,dynamic> payload, DateTime at)`. Coalescing: if an outbox row exists for `(entity, entityId)`, it updates `op/payload/clientUpdatedAt` in place and **keeps `seq`**, so parents still flush before children.
- Upsert payloads hold the full row without `id`: bookshelf `{name}`, notebook `{bookshelfId,name,archived}`, section `{notebookId,name}`, page `{sectionId,title,content}`.
- `delete` cascades locally (notebook → sections → pages, and so on). It deletes the outbox rows of the cascaded descendants and enqueues one `delete` for the target only.
- Sync helpers, used by Task 9: `Future<List<OutboxEntry>> pendingOps({int limit = 200})` ordered by `seq`; `Future<void> removeOp(int seq)`; `Future<void> bumpAttempts(int seq)`; `Future<bool> hasPending(EntityKind, String id)`; `Future<void> applyRemote({List<Bookshelf>, List<Notebook>, List<Section>, List<NotePage>, List<(EntityKind,String)> tombstones})`; `Future<String?> meta(String k)`; `Future<void> setMeta(String k, String v)`; `Future<void> wipe()`.

- [ ] Step 1: Tests on `NativeDatabase.memory()`: `create page writes row and one upsert outbox entry`; `three edits of same page leave one outbox row with latest content and original seq`; `create notebook then section: notebook seq < section seq`; `delete notebook removes its sections/pages and their outbox rows, enqueues one delete`; `changes stream emits after savePage`; `archived notebooks hidden from notebooks()`.
- [ ] Step 2: Run → FAIL. Step 3: Implement. Step 4: Run → PASS.
- [ ] Step 5: Commit `feat(mobile): drift local store with outbox`.

### Task 7: Switch the app to local-first

**Files:**
- Modify: `mobile/lib/app_scope.dart`, `mobile/lib/main.dart`, `mobile/lib/ui/connect_screen.dart`
- Test: `mobile/test/owner_test.dart`

**Interfaces:**
- `AppServices.repo` is now a `LocalRepository`. `RemoteRepository` stays for tests and reference only.
- `Future<void> ensureOwner(LocalRepository repo, String serverUrl, int userId)`. If `meta('owner') != '$serverUrl|$userId'`, it calls `wipe()` and then sets `owner`, which also clears `cursor`. ConnectScreen calls it after a successful login.
- Sign out: if `pendingOps()` is not empty, a confirm dialog warns `N unsynced changes will be lost`. Signing out wipes the local DB.

- [ ] Step 1: Tests: `owner_change_wipes_local_db` (seed a page, ensureOwner with another userId → `bookshelves()` is empty); `same owner keeps data`.
- [ ] Step 2: Run → FAIL. Step 3: Implement. Step 4: Run → PASS, then run all of `flutter test`.
- [ ] Step 5: Commit `feat(mobile): local-first repository`.

---

## Phase 3: sync

### Task 8: Server sync API (additive)

**Files:**
- Modify: `db.py` (SCHEMA_SQLITE/SCHEMA_POSTGRES: add `updatedAt` to bookshelves/notebooks/sections; new table `sync_tombstones`; migrations in `init_schema`; `_quote_idents_pg` adds `deletedAt`)
- Modify: `app.py`: stamp `updatedAt` on every INSERT/UPDATE to the four tables (the lines listed by `grep -n "INSERT INTO \(pages\|sections\|notebooks\|bookshelves\)\|UPDATE \(pages\|sections\|notebooks\|bookshelves\)" app.py`), write tombstones in every hierarchy DELETE (including the cascades at the notebook and section deletes and `/api/user/data`), and add the routes below
- Create: `sync_api.py` (an `APIRouter` included in `app.py`, so `app.py` doesn't grow further)
- Test: `tests/test_sync.py` (same TestClient setup as `tests/test_api.py`)

**Server decisions:**
- Migration: `ALTER TABLE x ADD COLUMN updatedAt DATETIME` (SQLite rejects non-constant defaults on ALTER), then `UPDATE x SET updatedAt = COALESCE(createdAt, CURRENT_TIMESTAMP) WHERE updatedAt IS NULL`. Postgres: `ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ DEFAULT NOW()`.
- `sync_tombstones(entity TEXT, id TEXT, userId INTEGER, deletedAt, PRIMARY KEY(entity, id))`. An upsert of an id deletes its tombstone.
- Timestamps: helper `_now_utc() -> datetime` (aware). Bind parameters as a `datetime` on Postgres. On SQLite, bind the string `'%Y-%m-%d %H:%M:%S.%f'` in UTC, which sorts correctly against legacy `CURRENT_TIMESTAMP` values. API output is always ISO-8601 UTC with `Z`.
- Bump `SCHEMA_VERSION` to `"3"`.
- `GET /api/sync/changes?since=<iso|empty>` → `{cursor, bookshelves:[], notebooks:[], sections:[], pages:[], tombstones:[{entity,id}]}` for the current user, with rows where `updatedAt >= since` (all rows when `since` is empty, archived included). `cursor` = request start minus `CURSOR_OVERLAP = 5s`, because clients handle duplicates.
- `POST /api/sync/push` with body `{ops:[{opId, entity, op:'upsert'|'delete', id, clientUpdatedAt, data?}]}` (max 500, else 422), applied in order → `{results:[{opId, status:'applied'|'stale'|'rejected', detail?, current?}]}`.
  - Upsert, new row: the parent must be owned (a notebook's `bookshelfId`, a section's `notebookId`, a page's `sectionId`). Otherwise the result is `rejected`, `detail 'Parent not found'`, `current: null`.
  - Upsert, existing row owned by someone else: `rejected`, `'Not found'`.
  - Upsert, existing owned row with `row.updatedAt > clientUpdatedAt`: `stale`, `current` = the server row. Otherwise apply it (a reparent requires the new parent to be owned), set `updatedAt = now`, and return `applied`.
  - Delete: a missing row is `applied` (idempotent). A row with `updatedAt > clientUpdatedAt` is `stale` + `current`. Otherwise the existing cascade rules apply and tombstones are written. A bookshelf with notebooks is `rejected` + `current`.
  - The same payload validation as the existing Pydantic models (name lengths, content ≤ 2,000,000, id regex). A bad op is `rejected` with the validation message and does not abort the batch.

- [ ] Step 1: Tests: `test_changes_full_then_incremental` (signup → POST notebook via the old endpoint → changes(since='') includes it; changes(since=cursor) after a PUT rename includes the rename); `test_legacy_put_page_still_returns_same_shape`; `test_delete_notebook_writes_tombstones_for_sections_and_pages`; `test_push_upsert_creates_page_visible_to_legacy_list` (GET `/api/pages/{sectionId}` shows it, i.e. Electron sees it); `test_push_upsert_is_idempotent`; `test_push_stale_returns_current` (clientUpdatedAt older than a fresh server edit); `test_push_child_of_deleted_parent_rejected`; `test_push_other_users_entity_rejected`; `test_push_delete_missing_is_applied`; `test_push_bad_title_rejected_without_aborting_batch`.
- [ ] Step 2: `python -m pytest tests -q` → new tests FAIL, old 7 pass.
- [ ] Step 3: Implement.
- [ ] Step 4: `python -m pytest tests -q` → all pass.
- [ ] Step 5: Commit `feat(api): additive sync changes/push endpoints with tombstones`.

### Task 9: `SyncEngine`

**Files:**
- Modify: `mobile/lib/data/api_client.dart` (`Future<SyncChanges> changes(String? since)`, `Future<List<PushResult>> push(List<OutboxEntry> ops)`; models in `models.dart`)
- Create: `mobile/lib/sync/sync_engine.dart`
- Test: `mobile/test/sync_engine_test.dart`

**Interfaces (Produces):**
- `enum SyncState { idle, syncing, offline, error, authExpired }`
- `class SyncEngine extends ChangeNotifier { SyncEngine(LocalRepository repo, ApiClient api); SyncState state; DateTime? lastSyncedAt; String? lastError; Future<void> syncNow(); }`
- `syncNow` (one run at a time; a call during a run queues one more): **push first**, then pull. Push: `pendingOps` in batches of 200 → `api.push`. For `applied`, call `removeOp`. For `stale`/`rejected`, call `removeOp` and then apply `current` through `applyRemote`, or delete locally when `current` is null. Pull: `changes(meta('cursor'))` → `applyRemote`, which **skips any entity with `hasPending`**, then `setMeta('cursor', c.cursor)`.
- Errors: `ApiException` 401/403 → `authExpired` (the outbox is kept, the engine stops). Socket/timeout → `offline`. Anything else → `error`, plus `bumpAttempts`. Retry backoff `min(2^attempts, 60)` seconds, scheduled with a `Timer`.

- [ ] Step 1: Tests with `FakeApiClient` (extend it with push/changes over its maps) and an in-memory `LocalDb`: `offline edit then sync pushes and clears outbox`; `pull applies remote page`; `pull skips entity with pending op` (local content stays); `stale push result replaces local with current`; `rejected_op_applies_current_state` (null current → local row gone); `sync_auth_expired_keeps_outbox`; `socket error sets offline`; `cursor persisted after pull`.
- [ ] Step 2: Run → FAIL. Step 3: Implement. Step 4: Run → PASS.
- [ ] Step 5: Commit `feat(mobile): sync engine`.

### Task 10: Sync triggers + status UI

**Files:**
- Modify: `mobile/lib/app_scope.dart`, `mobile/lib/ui/shelves_screen.dart` (+ any list screen app bar)
- Create: `mobile/lib/ui/sync_status_chip.dart`
- Test: `mobile/test/sync_status_chip_test.dart`

**Interfaces:**
- Dep: `flutter pub add connectivity_plus`.
- Triggers: `syncNow()` after login, at app start (when signed in), when `onConnectivityChanged` reports a non-`none` result, on `AppLifecycleState.resumed`, 2 s after the last `repo.changes` event (debounced), and every 60 s.
- `SyncStatusChip` labels: idle → `Synced`, syncing → `Syncing…`, offline → `Offline`, error → `Sync error` (tap shows `lastError`), authExpired → `Sign in again` (tap opens ConnectScreen with the session kept). Tapping when idle runs `syncNow`.

- [ ] Step 1: Widget tests: one per state label, plus `tap on Sign in again opens ConnectScreen`.
- [ ] Step 2: Run → FAIL. Step 3: Implement. Step 4: Run → PASS.
- [ ] Step 5: Commit `feat(mobile): sync triggers and status`.

---

## Phase 4: polish

### Task 11: Tablet layout + markdown preview

**Files:**
- Create: `mobile/lib/ui/adaptive_home.dart`
- Modify: `mobile/lib/ui/page_editor_screen.dart`, `mobile/lib/main.dart`
- Test: `mobile/test/adaptive_test.dart`

**Interfaces:**
- Dep: `flutter pub add flutter_markdown_plus`.
- At width ≥ 840 dp, `AdaptiveHome` shows two panes: left is the navigation stack (shelves→pages, 360 dp), right is the editor for the selected page. Below 840 dp it keeps the Task 5 push navigation.
- The editor has an Edit/Preview toggle (a `SegmentedButton`). Preview renders `MarkdownBody(data: content, selectable: true)`. Mermaid/Plotly code fences render as plain code.

- [ ] Step 1: Tests: `wide layout shows list and editor side by side` (`tester.view.physicalSize = Size(1280, 800)`, then both pane keys are found); `narrow layout pushes editor`; `preview renders heading text`.
- [ ] Step 2: Run → FAIL. Step 3: Implement. Step 4: Run → PASS.
- [ ] Step 5: Commit `feat(mobile): tablet two-pane and markdown preview`.

### Task 12: Docs + end-to-end verification

**Files:**
- Modify: `mobile/README.md` (sync rules, LWW and clock-skew caveat, cleartext note), `docs/features/sync.md` (a Flutter section: same account + same API URL; mark Flutter as the primary mobile client and keep the PWA/Capacitor notes), `README.md` (a mobile section linking `mobile/README.md`)

- [ ] Step 1: Write the docs.
- [ ] Step 2: E2E on an Android emulator: start the API on `0.0.0.0:58888`, log in from the app at `http://10.0.2.2:58888`, then:
  1. Edit page A online. `curl -H "Authorization: Bearer $T" .../api/pages/<sec>` shows it.
  2. Turn on airplane mode. Edit A, create page B, and check the chip reads `Offline`.
  3. Turn the network back on. The chip reads `Synced`, and curl shows A's edit and B.
  4. Edit A through curl `PUT /api/pages/A` (standing in for Electron). Tap the chip, and the phone shows the edit.
- [ ] Step 3: `flutter analyze`, `flutter test`, `python -m pytest tests -q` all pass; `git status` shows no `.env`/`.sqlite`.
- [ ] Step 4: Commit `docs: Flutter mobile and offline sync`.
