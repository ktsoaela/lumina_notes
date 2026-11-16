# Lumina Notes — Flutter mobile (Android / iOS / tablet)

The primary phone/tablet client for Lumina Notes. It talks to the same FastAPI
server as the Electron desktop app. Use the same account and the same server
URL on every device.

Works **offline**: notes live in a local database (Drift/SQLite) on the
device, edits are queued, and the app syncs with the server whenever it can.
Conflict rules: [docs/features/sync.md](../docs/features/sync.md#conflicts-v1-last-write-wins).

## Run

```bash
# 1. Start the API from the repo root (port 58888 by default)
python run_api.py                       # binds 127.0.0.1
# or, so an emulator/phone on your LAN can reach it:
uvicorn app:app --host 0.0.0.0 --port 58888

# 2. Run the app
cd mobile
flutter pub get
flutter run                             # pick an Android emulator/device, iOS simulator, or `-d windows`
```

## Point the app at your server

On the first screen, enter the server URL and tap **Test connection**, then sign in or sign up:

| Where the app runs       | Server URL                    |
|--------------------------|-------------------------------|
| Android emulator         | `http://10.0.2.2:58888`       |
| iOS simulator / desktop  | `http://127.0.0.1:58888`      |
| Phone on your Wi-Fi      | `http://<your-PC-LAN-IP>:58888` (server must listen on `0.0.0.0`) |
| Hosted                   | `https://notes.example.com`   |
| Phone over USB (no Wi-Fi needed) | run `adb reverse tcp:58888 tcp:58888`, then use `http://127.0.0.1:58888` |

The app allows plain `http://` (Android `usesCleartextTraffic`, iOS ATS
exceptions) so LAN self-hosting works. Use HTTPS for anything internet-facing.

The token and server URL are stored in the platform's secure storage (Keychain / Android Keystore).

Demo login (when the server seeds it in development): `demo_user` / `demo_user`.

## How sync works

- All screens read and write the local DB; every change also goes into an
  outbox (one entry per item, kept in order so parents are pushed before children).
- Sync = push the outbox (`POST /api/sync/push`), then pull changes since the
  last cursor (`GET /api/sync/changes`).
- Sync runs at start, when connectivity returns, on app resume, 2 s after an
  edit, every 60 s, and on pull-to-refresh. Failures retry with backoff (max 60 s).
- Token expired? The chip shows **Sign in again**; local data and unsynced
  changes are kept when the same user signs back in.
- Signing out, or signing in as another user / to another server, wipes the
  local DB (you're warned if there are unsynced changes).
- Tablets (≥ 840 dp wide) get a two-pane layout: navigation left, editor right.

## Build

```bash
flutter build apk --release        # build/app/outputs/flutter-apk/app-release.apk
flutter build appbundle            # Play Store
flutter build ipa                  # needs macOS + Xcode
```

App id: `com.lumina.notes`.

## Test

```bash
flutter analyze
flutter test

# Against a real server (from the repo root: uvicorn app:app --port 58888)
LUMINA_LIVE_API=http://127.0.0.1:58888 flutter test test/live_api_test.dart
```

Server sync tests: `python -m pytest tests -q` (add
`LUMINA_TEST_PG_URL=postgresql://...` to also run them on Postgres).
