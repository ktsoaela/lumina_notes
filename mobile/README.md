# Lumina Notes — Flutter mobile (Android / iOS / tablet)

The primary phone/tablet client for Lumina Notes. It talks to the same FastAPI
server as the Electron desktop app. Use the same account and the same server
URL on every device.

> Status: Phase 1 (online client). Offline storage and sync come in later phases.
> See `../docs/superpowers/plans/2026-11-16-flutter-mobile-offline-sync.md`.

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

The app allows plain `http://` (Android `usesCleartextTraffic`, iOS ATS
exceptions) so LAN self-hosting works. Use HTTPS for anything internet-facing.

The token and server URL are stored in the platform's secure storage (Keychain / Android Keystore).

Demo login (when the server seeds it in development): `demo_user` / `demo_user`.

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
```
