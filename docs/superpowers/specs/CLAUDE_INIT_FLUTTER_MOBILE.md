# CLAUDE INIT — Lumina Flutter mobile (Approach A)

Copy everything below the line into a new Claude chat (Agent mode) in this repo.

---

## Mission

Build a **Flutter** app for **Android, iOS, and tablet** for **Lumina Notes**, with **offline-first local storage** and **online sync** to the existing **FastAPI** backend. Keep **Electron desktop** as-is (do not rewrite stick’n or replace Electron with Flutter).

**Workspace (source of truth):** `D:\HOBBIES\SOFTWAR_DEV\Work\lumina_notes`  
**Remote:** `https://github.com/ktsoaela/lumina_notes` branch `dev`  
**Design:** `docs/superpowers/specs/2026-11-16-flutter-mobile-offline-sync-design.md`

Ignore older clones like `C:\Work\lumina_notes` unless told otherwise (they may be behind).

## Product context

Lumina is a markdown notebook app: shelves → books → chapters → pages. Mermaid/Plotly exist on web/desktop; mobile v1 can show markdown + simple preview first.

Today:

- Desktop = Electron + bundled FastAPI (`LuminaApi`)
- Mobile = PWA + Capacitor (web UI) — **online-only** against API URL in Profile → Devices & sync
- Sync today = “same FastAPI URL + same JWT account” — **no offline note DB**

You are adding Flutter as the **primary** phone/tablet client with real offline/online sync.

## Hard constraints

1. **Do not** remove or rewrite Electron, stick’n, or the React web app in v1.
2. **Do not** invent a new cloud vendor; FastAPI remains source of truth.
3. **Do not** commit secrets, `.env`, or `database.sqlite`.
4. Prefer a new folder: `mobile/` (Flutter project root with `pubspec.yaml`).
5. Reuse existing REST API under `/api/...` (see `app.py`). Extend API only when sync needs cursors/`updated_at`/ETags.
6. Conflict policy v1: **last-write-wins** (document it). No fancy CRDT unless necessary later.
7. Follow existing project skills if present (ponytail = simplest thing that works; verify before claiming done).

## Existing API surface (reuse)

Auth: `POST /api/auth/signup`, `POST /api/auth/login`, `GET /api/auth/me`  
Hierarchy: bookshelves, notebooks, sections, pages CRUD as in `app.py`  
Health: `GET /health`  
Clients set base URL like today’s `src/lib/syncServer.ts` (empty = not used on Flutter; Flutter always needs a configured server URL **or** a clear “no server / local-only” mode — prefer **configured sync server** for multi-device).

## What to build (ordered)

### Phase 0 — Scaffold
- `flutter create` app in `mobile/` (Android + iOS).
- App name: Lumina Notes; package id consistent with desktop if possible (`com.lumina.notes`).
- README in `mobile/README.md`: how to run, point at API, build APK.

### Phase 1 — Online client
- Login / signup screens.
- Configurable API base URL (persist securely).
- Browse hierarchy + open/edit page markdown online via REST + JWT.
- Parity with core API types (ids, titles, content).

### Phase 2 — Offline store
- Local DB (prefer **Drift** + SQLite) mirroring bookshelves/notebooks/sections/pages.
- Outbox table for pending creates/updates/deletes.
- App reads/writes local DB first; UI works with airplane mode.

### Phase 3 — Sync engine
- Sync cursor / `updated_at` (add server fields + endpoints if missing; keep backward compatible with Electron).
- Pull remote changes → merge into local.
- Push outbox → clear on success; retry with backoff.
- Show sync status (idle / syncing / offline / error).

### Phase 4 — Polish
- Tablet layouts (wider nav + editor).
- Basic markdown preview (Mermaid/Plotly can be later).
- Document how Electron + Flutter share data (same account + same API URL).
- Update root README / `docs/features/` with Flutter mobile path (keep PWA docs but mark Flutter as primary mobile).

## Out of scope for this init

- Flutter desktop replacement
- stick’n on mobile
- Full Mermaid/Plotly parity
- End-to-end encryption of note bodies
- Rewriting Capacitor away (optional deprecation note only)

## Definition of done (v1)

1. `cd mobile && flutter run` works on Android emulator or device.
2. Offline: edit a page, kill network, edit again, reconnect → changes appear via API for the same user.
3. Electron (or curl) against the same API sees those pages after sync.
4. No secrets in git; `mobile/` builds without requiring Electron.

## First actions

1. Read `docs/superpowers/specs/2026-11-16-flutter-mobile-offline-sync-design.md`, `app.py` (API), `src/lib/api.ts`, `docs/features/sync.md`.
2. Write a short implementation plan under `docs/superpowers/plans/` (tasks with checkboxes).
3. Scaffold `mobile/` and get login + list notebooks online working before offline.
4. Ask before large API breaking changes; prefer additive sync fields.

Start with Phase 0 + Phase 1. Confirm the plan in 5–10 bullets, then implement.
