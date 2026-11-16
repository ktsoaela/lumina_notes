# Flutter mobile/tablet + offline sync (Approach A)

**Status:** Approved direction (2026-11-16)  
**Repo:** `lumina_notes` (workspace: `D:\HOBBIES\SOFTWAR_DEV\Work\lumina_notes`)

## Goal

Ship a **Flutter** app for **Android / iOS / tablet** that works **offline and online**, while keeping **Electron** for Windows/macOS (including stick’n). All clients share data through the existing **FastAPI** backend.

## Non-goals

- Do not rewrite Electron desktop in Flutter.
- Do not replace FastAPI with a Flutter-only local backend.
- Do not require Supabase or a vendor cloud; self-hosted API stays the source of truth.
- Capacitor/PWA may remain as a secondary web path; Flutter becomes the primary mobile app.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ Electron        │     │ FastAPI + DB     │     │ Flutter         │
│ (desktop)       │────▶│ SQLite/Postgres  │◀────│ Android/iOS/    │
│ online → API    │     │ JWT auth         │     │ tablet          │
└─────────────────┘     └──────────────────┘     │ local Drift DB  │
                                                  │ sync when online│
                                                  └─────────────────┘
```

- **Server of record:** existing FastAPI (`app.py`) — bookshelves → notebooks → sections → pages.
- **Flutter local store:** Drift/SQLite (or equivalent) mirroring that hierarchy.
- **Sync:** pull/push when network is available; queue mutations while offline.
- **Conflicts (v1):** last-write-wins using server `updated_at` / revision fields (add fields on API if missing).
- **Auth:** same JWT login/signup endpoints; store token securely (flutter_secure_storage).

## Sync rules (v1)

1. On launch / reconnect: pull changed entities since last sync cursor.
2. Offline edits append to an outbox; flush when online.
3. If server version is newer than local and local has no pending outbox for that id → take server.
4. If both changed → LWW by timestamp; optional later: merge UI for pages.
5. Desktop Electron continues online-only against the same API (no Flutter required).

## Success criteria

- Create/edit a page on Flutter offline; after reconnect it appears on Electron (same account + sync URL).
- Edit on Electron; after Flutter sync it appears on the phone/tablet.
- App usable without network for read + write of already-synced notebooks.

## Suggested repo layout

```
lumina_notes/
  app.py, electron/, src/     # existing
  mobile/                     # NEW Flutter project (or apps/lumina_mobile/)
```

## Kickoff

Paste `docs/superpowers/specs/CLAUDE_INIT_FLUTTER_MOBILE.md` into Claude to start implementation.
