# Flutter mobile/tablet + offline sync

**ADR:** [0001](../../adr/0001-flutter-mobile-offline-sync.md) (Accepted, 2026-11-16)

## Goal

Flutter app for Android / iOS / tablet with offline-first storage and sync to the existing FastAPI backend. Electron remains the desktop client.

## Architecture

```
Electron (desktop) ──▶ FastAPI + DB ◀── Flutter (Drift local DB + sync)
```

- Server of record: FastAPI hierarchy (shelves → books → chapters → pages)
- Conflicts v1: last-write-wins
- Auth: JWT (and QR pairing — see ADR 0002)

## Success criteria

- Offline edit on Flutter appears on Electron after sync (same account + API)
- Electron edits appear on Flutter after sync
- App usable offline for already-synced notebooks
