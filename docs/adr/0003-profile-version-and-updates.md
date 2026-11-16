# ADR 0003: Show app version in Profile and offer updates in-app

- **Status:** Proposed
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
