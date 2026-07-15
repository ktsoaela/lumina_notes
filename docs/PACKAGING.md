# Free multi-device sync + packaging (Windows / macOS / Android)

## Sync without Supabase

Lumina already stores notes in **your** FastAPI + SQLite/Postgres.

1. Run one shared API (free options):
   - Docker on [Render](https://render.com) / [Railway](https://railway.app) / [Fly.io](https://fly.io), or
   - `docker compose` / `uvicorn` on a PC at home (`http://192.168.x.x:58888` on Wi‑Fi).
2. On each device: **Profile → Devices & sync** → paste that URL → **Test & save**.
3. Sign in with the **same account** everywhere.

Leave the URL empty on the desktop installer to keep using the **local** bundled database.

Set `CORS_ORIGINS` on the server to include your app origins (Capacitor uses `https://localhost`).

## Windows EXE

```bash
npm run build:win
```

Installer + portable build land in `release/electron/`.

## macOS app / DMG

Build on a Mac (or GitHub Actions `macos-latest`):

```bash
npm run build:mac
```

Requires Python 3 + PyInstaller for the bundled API.

## Android APK

1. Install [Android Studio](https://developer.android.com/studio) (SDK + platform tools).
2. Once:

```bash
npm install
npm run build:mobile
npx cap add android   # only the first time
npx cap sync android
```

3. Open and build:

```bash
npx cap open android
```

In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**  
Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`

Or:

```bash
npm run build:apk
```

On first launch, set **Devices & sync** to your FastAPI URL (phone cannot run the Python backend itself).

## GitHub Actions

From the repo Actions tab → **Desktop & mobile packages** → **Run workflow**
(or push a tag `v1.0.1`).

Downloads appear under the run’s **Artifacts**:
- `windows-installer` — `.exe`
- `macos-app` — `.dmg` / `.zip`
- `android-apk` — debug `.apk`

Tagged runs also attach those files to the GitHub Release.
