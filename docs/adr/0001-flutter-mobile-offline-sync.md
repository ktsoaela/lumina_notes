# ADR 0001: Flutter as primary mobile client with offline sync

- **Status:** Accepted
- **Date:** 2026-11-16
- **Deciders:** Lumina Notes maintainers

## Context

Lumina Notes already ships **Electron + bundled FastAPI** on desktop and a **PWA/Capacitor** path on phones. The PWA is online-only: no local note database, so airplane-mode editing and reliable multi-device sync are weak.

We need a phone/tablet client that:

- Works offline for read and write of already-synced notebooks
- Syncs to the same self-hosted FastAPI (SQLite or Postgres) used by Electron
- Does not force a rewrite of desktop (stick'n stays Electron)

## Options considered

| Option | Summary | Tradeoff |
|--------|---------|----------|
| A. Flutter + Drift offline DB + sync engine | New `mobile/` app; FastAPI remains source of truth | Extra client stack; best offline UX |
| B. Improve Capacitor/PWA with local storage | Stay on web stack | Offline sync is awkward; weaker native feel |
| C. Flutter rewrite of desktop too | One codebase everywhere | Large rewrite; stick'n/Electron investment lost |

## Decision

We will ship **Approach A**: a **Flutter** app under `mobile/` for Android, iOS, and tablet, with a **Drift/SQLite** local store and an outbox-based sync engine against existing `/api/...` routes (additive sync endpoints only).

- Conflict policy v1: **last-write-wins** by timestamp
- Auth: same JWT signup/login (and later pairing)
- Electron and the React web app stay as they are for v1
- Capacitor/PWA may remain as a secondary path; Flutter is the primary mobile client

## Consequences

**Positive**

- Offline editing on phone/tablet with sync to Electron via the same account and API URL
- Clear ownership: FastAPI is still the server of record

**Negative / follow-up**

- Two UI stacks to maintain (React desktop/web + Flutter mobile)
- Mermaid/Plotly parity on mobile can lag
- CI must build Flutter APKs in addition to Electron packages

**References**

- Feature guide: [docs/features/sync.md](../features/sync.md), [docs/features/flutter-mobile.md](../features/flutter-mobile.md)
- Design sketch: [docs/superpowers/specs/2026-11-16-flutter-mobile-offline-sync-design.md](../superpowers/specs/2026-11-16-flutter-mobile-offline-sync-design.md)
