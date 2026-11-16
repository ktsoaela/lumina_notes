# QR Pairing (Connect Phone) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The phone connects to the same Lumina API as desktop by scanning a QR / opening `lumina://pair?...` instead of typing a server URL.

**Architecture:** FastAPI gets two additive routes: `POST /api/pair/start` (JWT → short-lived single-use code + deep link) and `POST /api/pair/complete` (code → login-shaped `{token,user}`). Web/Electron Profile → Devices & sync renders the deep link as a QR. Flutter parses the link (scan or OS deep link), saves `serverUrl`, tries `pair/complete`, and falls back to the normal login form if the code is expired/used.

**Tech Stack:** FastAPI + sqlite/postgres (`db.py` wrapper), React 19 + `qrcode` npm, Flutter + `mobile_scanner` + `app_links`.

**Spec:** `docs/superpowers/specs/2026-11-16-qr-pairing-connect-phone-design.md` (+ `CLAUDE_INIT_QR_PAIRING.md` in the same folder)

## Global Constraints

- Deep link format, exactly: `lumina://pair?u=<urlencoded serverBaseUrl>&c=<code>`.
- Code TTL **5 minutes**, **single use**, cryptographically random, bound to the user who started it.
- Additive only: `/api/auth/*` routes and `src/lib/syncServer.ts` behaviour unchanged.
- No Lumina-hosted discovery service.
- Never commit `.env`, secrets, `database.sqlite`.
- Commit messages: **no** `Co-Authored-By` / AI trailer lines.

## Decisions

- **Base URL rule:** client sends `{"serverUrl": "<saved sync URL>"}`; server uses it if it is a valid http(s) URL. If omitted/empty, server uses the request's base URL; if that host is loopback (`127.0.0.1`, `localhost`, `::1`), it substitutes the machine's LAN IPv4 with port `$PORT` (default `58888`) and returns `"lan": true`.
- **LAN binding:** the bundled API listens on `127.0.0.1`, so a LAN QR only works if the API is started with `LUMINA_HOST=0.0.0.0`. `run_api.py` reads `LUMINA_HOST` (default unchanged `127.0.0.1`). UI shows a note when `lan` is true. Opt-in, not default (security).
- **Code alphabet:** `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, length 8, via `secrets.choice`.
- **pair/complete** ships in this PR (small); Flutter falls back to login if it fails.
- A pair link arriving while signed in is ignored with a snackbar "Sign out first to switch servers" (no silent account switch).

## Review Focus

1. Code reused twice / used after 5 min → second call must 400 with clear message (test in Task 1).
2. Two concurrent `pair/complete` with same code → only one succeeds: use conditional `UPDATE ... WHERE usedAt IS NULL` and check `rowcount` (Task 1).
3. QR built while desktop on bundled local API → URL must not be `127.0.0.1` (Task 1 test on loopback substitution).
4. Malformed scan (random QR, `lumina://pair` without `u`, `u=ftp://x`) → "Not a Lumina pairing code", nothing saved (Task 3 parser tests, Task 4 widget test).
5. Pair link opened while already signed in → no account switch (Task 3 `applyPairLink` test).

---

### Task 1: Pairing API

**Files:**
- Create: `pairing.py`
- Modify: `app.py` (call `pairing.migrate(conn)` in `init_db`; add the two routes near auth routes), `run_api.py` (`LUMINA_HOST`)
- Test: `tests/test_pairing.py` (same `_reload_app` + `TestClient` pattern as `tests/test_sync.py`)

**Interfaces:**
- Produces HTTP:
  - `POST /api/pair/start` (Bearer) body `{"serverUrl"?: str}` → `200 {"code": str, "expiresAt": ISO-Z str, "serverUrl": str, "deepLink": str, "lan": bool}`; invalid `serverUrl` → 400 `"Invalid server URL"`.
  - `POST /api/pair/complete` (no auth, `_rate_limit_auth`) body `{"code": str, "deviceName"?: str ≤64}` → `200 {"token", "user"}` (same as login); unknown/expired/used → 400 `"Pairing code is invalid or expired"`. Code compared case-insensitively (upper-cased).
- `pairing.py`: `migrate(conn)`, `new_code() -> str`, `build_deep_link(server_url: str, code: str) -> str`, `resolve_base_url(client_url: str|None, request_base: str, port: str) -> tuple[str, bool]`, `lan_ip() -> str|None` (UDP socket connect trick, no packet sent; `None` → keep loopback).
- Table `pairing_codes(code TEXT PRIMARY KEY, userId INTEGER NOT NULL, expiresAt TEXT NOT NULL, usedAt TEXT, deviceName TEXT, createdAt TEXT NOT NULL)` — same DDL on both dialects. Times stored as `sync_api.iso(...)` strings (sortable text).

- [ ] **Step 1: Write failing tests** in `tests/test_pairing.py`:
  - `test_start_requires_auth` → 401/403 without token.
  - `test_start_returns_code_and_link` → code matches `^[A-Z2-9]{8}$`; with `serverUrl="http://192.168.0.225:58888/"` deepLink == `lumina://pair?u=http%3A%2F%2F192.168.0.225%3A58888&c=<code>`; `expiresAt` ≈ now+300s (±5s).
  - `test_start_rejects_bad_url` (`ftp://x`) → 400.
  - `test_start_loopback_substitutes_lan` → patch `pairing.lan_ip` to `"10.1.2.3"`, no serverUrl (TestClient host is `testserver`, so also unit-test `resolve_base_url(None, "http://127.0.0.1:58888", "58888") == ("http://10.1.2.3:58888", True)` and non-loopback passes through with `False`).
  - `test_complete_returns_session_for_owner` → token works on `/api/auth/me` and returns the starter's user id.
  - `test_complete_single_use` → second call 400.
  - `test_complete_expired` → set `expiresAt` in the past via direct DB update → 400.
  - `test_complete_unknown_code` → 400.
- [ ] **Step 2:** `python -m unittest tests.test_pairing -v` → fails (404s).
- [ ] **Step 3:** Implement `pairing.py`, routes, `migrate` in `init_db`, `run_api.py` host env.
- [ ] **Step 4:** `python -m unittest tests.test_pairing tests.test_sync tests.test_api -v` → all pass.
- [ ] **Step 5:** Commit `feat(api): pairing codes for connecting a phone`.

### Task 2: Web / Electron Connect phone panel

**Files:**
- Create: `src/lib/pairing.ts`, `src/lib/pairing.test.ts`, `src/components/ConnectPhonePanel.tsx`
- Modify: `src/components/ProfilePage.tsx` (render `<ConnectPhonePanel />` at the end of the `sync` section), `package.json` (`qrcode` + `@types/qrcode`), `docs/features/sync.md`

**Interfaces:**
- `startPairing(): Promise<PairStart>` — POSTs `apiUrl('/api/pair/start')` with the stored JWT and `{serverUrl: getSyncServerUrl() || undefined}`; throws `Error(readApiError(...))`.
- `type PairStart = { code: string; expiresAt: string; serverUrl: string; deepLink: string; lan: boolean }`
- `secondsLeft(expiresAt: string, now: number): number` — floor, clamped ≥ 0.
- Panel: button "Create pairing code" → QR (`QRCode.toDataURL(deepLink)`) + server URL text + "Copy link" + "Expires in m:ss" ticking each second; at 0 shows "Code expired" + "New code". When `lan`: note "Phone and this PC must be on the same Wi‑Fi. The desktop API must accept LAN connections (start it with LUMINA_HOST=0.0.0.0)." Uses the *saved* URL, not the unsaved draft.

- [ ] **Step 1:** Tests in `pairing.test.ts`: `secondsLeft` (future 90.4s → 90; past → 0); `startPairing` with mocked `fetch` sends `serverUrl` from `localStorage['lumina_sync_server']` and Bearer token, and omits it when empty.
- [ ] **Step 2:** `npx vitest run src/lib/pairing.test.ts` → fails.
- [ ] **Step 3:** Implement lib + panel; wire into ProfilePage; update `docs/features/sync.md` (phone: scan QR, don't type URL; LAN note).
- [ ] **Step 4:** `npx vitest run` and `npx tsc --noEmit` → pass.
- [ ] **Step 5:** Commit `feat(web): Connect phone QR in Devices & sync`.

### Task 3: Flutter pair link parsing + API

**Files:**
- Create: `mobile/lib/data/pair_link.dart`, `mobile/test/pair_link_test.dart`
- Modify: `mobile/lib/data/api_client.dart` (`pairComplete`), `mobile/test/fakes.dart` (fake `pairComplete`), `mobile/lib/app_scope.dart` (`applyPairLink`), `mobile/lib/data/session_store.dart` (`clearServerUrl`)

**Interfaces:**
- `class PairLink { final String serverUrl; final String? code; }`
- `PairLink? parsePairLink(String raw)` — accepts `lumina://pair?u=..&c=..`; `u` run through `normalizeServerUrl`; returns `null` on any other scheme/host, missing/invalid `u`. `c` optional (upper-cased, trimmed, empty → null).
- `Future<AuthResult> ApiClient.pairComplete(String code, {String? deviceName})`.
- `Future<String?> AppServices.applyPairLink(PairLink link)` — if signed in: returns `'Sign out first to switch servers'`, no change. Else `session.saveServerUrl`; if `code` != null try `pairComplete` → `signIn`; on failure return the error message (`errorMessage(e)`), URL stays saved. Returns `null` on full success.
- `Future<void> SessionStore.clearServerUrl()`.

- [ ] **Step 1:** Tests: parser (valid, missing c, uppercase, `https://x/pair`, `lumina://other`, `u=ftp://x`, garbage text → null); `applyPairLink` success signs in; failure keeps URL + returns `'Pairing code is invalid or expired'`; signed-in → returns the sign-out message and URL unchanged; `clearServerUrl` removes `lumina.serverUrl`.
- [ ] **Step 2:** `flutter test test/pair_link_test.dart` → fails.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** `flutter test` → pass.
- [ ] **Step 5:** Commit `feat(mobile): parse lumina://pair links and exchange pairing codes`.

### Task 4: Flutter scan-first connect screen + deep links

**Files:**
- Create: `mobile/lib/ui/scan_screen.dart`
- Modify: `mobile/lib/ui/connect_screen.dart`, `mobile/lib/main.dart` (app_links listener), `mobile/pubspec.yaml` (`mobile_scanner`, `app_links`), `mobile/android/app/src/main/AndroidManifest.xml` (CAMERA permission; intent-filter VIEW/DEFAULT/BROWSABLE, scheme `lumina`, host `pair`), `mobile/ios/Runner/Info.plist` (`CFBundleURLTypes` scheme `lumina`, `NSCameraUsageDescription`), `mobile/test/connect_screen_test.dart`, `mobile/README.md`

**Interfaces:**
- `ConnectScreen({reauth, Future<String?> Function(BuildContext)? scan})` — `scan` defaults to pushing `ScanScreen` (returns the raw QR string); tests inject a fake.
- No URL known: brand, `FilledButton` key `scanQr` "Scan to connect", hint "Open Profile → Devices & sync on your computer", `TextButton` key `manualServer` "Enter server manually" → reveals `serverUrl` field + `testConnection` + login form (existing flow).
- URL known: line "Server: <host>" + `TextButton` key `changeServer` (calls `clearServerUrl`) + login form; no URL field.
- Scan result → `parsePairLink`; null → error "Not a Lumina pairing code"; else `applyPairLink`, show returned message as `_error` (login form now visible).
- `main.dart`: `AppLinks().uriLinkStream` + initial link → `parsePairLink` → `applyPairLink`, message via a root `ScaffoldMessenger` key.

- [ ] **Step 1:** Update widget tests: fresh app shows `scanQr` and no `serverUrl` field; fake scan of valid link with code → signed in; fake scan of expired code → login form visible with error, `kv['lumina.serverUrl']` set; garbage scan → "Not a Lumina pairing code"; manual path (`manualServer` then existing `_fillLogin`) still logs in; `changeServer` returns to scan screen. Existing tests switch to the manual path.
- [ ] **Step 2:** `flutter test test/connect_screen_test.dart` → fails.
- [ ] **Step 3:** Implement; `flutter pub add mobile_scanner app_links`; platform config; README.
- [ ] **Step 4:** `flutter test` and `flutter analyze` → clean.
- [ ] **Step 5:** Commit `feat(mobile): scan-to-connect screen and lumina://pair deep links`.

### Task 5: Verify end to end

- [ ] Run API with `LUMINA_HOST=0.0.0.0`, log in on web, create pairing code; confirm deep link uses LAN IP, not 127.0.0.1.
- [ ] `curl` `pair/complete` with that code → token; second call → 400.
- [ ] On device/emulator (if available): scan → signed in → sync both ways. If no device, record that this step was not run.
