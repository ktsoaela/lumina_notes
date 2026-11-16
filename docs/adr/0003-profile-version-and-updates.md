# ADR 0003: Show app version in Profile and offer updates in-app

- **Status:** Accepted (implemented in v1.3.0)
- **Date:** 2026-11-16
- **Deciders:** Lumina Notes maintainers

## Context

Users cannot see which build they are running from inside the app. Releases live on GitHub (`v*`), but there is no in-product path to learn about a newer desktop or Flutter build, or to download it without leaving the notebook.

## Options considered

| Option | Summary | Tradeoff |
|--------|---------|----------|
| A. Profile shows version; optional check against GitHub Releases; user downloads when ready | Clear, opt-in | Needs network; no silent forced upgrades |
| B. Silent auto-update (Electron autoUpdater / Play) | Hands-off | Heavier signing/store setup; less control for self-hosted users |
| C. Version only in About/README | Cheap | Users never look there |

## Decision

We will use **Option A**:

1. **Profile** (desktop/web and Flutter) shows the current **version string** (e.g. `1.2.0` from `package.json` / Flutter `pubspec`).
2. Profile can **check for a newer GitHub Release** (tag / `latest`).
3. When a newer version exists, Profile **informs** the user (banner or row). The user chooses:
   - open the release / download in browser, or
   - download from inside the app/desktop (save installer/APK to a chosen path or trigger the OS installer flow).
4. **Auto-download** is an **opt-in** setting (“Download updates automatically when available”), off by default. Even then, **install** stays user-confirmed unless a later ADR says otherwise.
5. Desktop and Flutter each report their own channel (Electron vs Android APK). No requirement to auto-update the FastAPI server from the client.

## Consequences

**Positive**

- Users know what they are on and can get `Lumina-Notes.exe` / `Lumina-Notes-android.apk` without hunting Releases
- Opt-in auto-download respects self-hosted / cautious users

**Negative / follow-up**

- Needs a small Releases API client and rate-limit handling
- Download URLs must stay stable (or be resolved from `latest` asset names)
- CI must keep attaching named assets so the in-app download works

## Implementation (v1.3.0)

| Decision | Where |
|----------|-------|
| 1. Version in Profile | Desktop/web: badge under the name + **About & updates** (`src/lib/version.ts` → `__APP_VERSION__` from `package.json`). Flutter: Settings header chip, About panel, book-tree drawer and sign-in screen (`mobile/lib/version.dart`, `appVersionLabel`; `test/version_test.dart` keeps it equal to `pubspec.yaml`). |
| 2. Check GitHub `latest` | `fetchLatestRelease()` in `src/lib/version.ts` and `mobile/lib/version.dart`; launch check throttled to every 6 h on desktop/web. |
| 3. Inform + choose | Desktop: toast on launch + `UpdatesPanel` (Release notes / Download update / **Install now** / Show file). Flutter: snack bar on launch + About panel (**Download update** in-app with progress, **Install now**, Release notes, “Use browser instead”). |
| 4. Opt-in auto-download, user-confirmed install | Desktop: “Download new versions automatically” (off by default) → `lumina:download-update` saves to `Downloads/Lumina Notes updates`; **Install now** asks first, then quits and starts the new build (`lumina:install-update`). Flutter: “Download updates automatically” (off by default) → `UpdateService.download()`; install goes through Android's own confirmation (`REQUEST_INSTALL_PACKAGES`). |
| 5. Separate channels | Desktop picks `.exe` / `.dmg` / `.AppImage`; Flutter picks the `.apk` asset (`pickAsset`, `ReleaseInfo.fromGitHub`). |

Downloads are restricted to `https://github.com/ktsoaela/lumina_notes/releases/download/` and files are only revealed / launched from the updates folder.
