# ADR 0002: QR / deep-link phone pairing

- **Status:** Accepted
- **Date:** 2026-11-16
- **Deciders:** Lumina Notes maintainers

## Context

After ADR 0001, Flutter still needed a **sync server URL**. Typing `http://192.168…` on a phone is error-prone. The URL is already configured once on web/Electron under **Profile → Devices & sync**.

We need a happy path where the phone joins the same server and account **without typing a URL**, while keeping self-hosted FastAPI (no Lumina cloud discovery).

## Options considered

| Option | Summary | Tradeoff |
|--------|---------|----------|
| A. QR / `lumina://pair` with short-lived code | Desktop starts pair; phone scans; optional JWT exchange | Needs camera permission; LAN bind for local API |
| B. Manual URL only | Keep typing the URL | Simple but poor UX |
| C. mDNS / LAN discovery as primary | Auto-find PC on Wi‑Fi | Fragile across OS/networks; not enough alone |

## Decision

We will use **Option A**:

1. Signed-in desktop/web calls `POST /api/pair/start` and shows a QR + copyable link:  
   `lumina://pair?u=<serverBaseUrl>&c=<code>`
2. Codes are **cryptographically random**, **5-minute TTL**, **single-use**, bound to the user who started pairing.
3. Phone scans or opens the link → saves `serverUrl` → `POST /api/pair/complete` exchanges the code for a session (same shape as login).
4. If the saved sync URL is empty (bundled local API), the QR uses this machine’s **LAN IPv4**, never `127.0.0.1` or `0.0.0.0` (bind-all is not a browsable client address).
5. Escape hatches remain: **Enter server manually** / **Change server**.

## Consequences

**Positive**

- Happy path: no URL typing on the phone
- Additive API; existing login/signup unchanged
- Same Drift sync engine after sign-in

**Negative / follow-up**

- Local Wi‑Fi pairing needs the API listening on LAN (`LUMINA_HOST=0.0.0.0`); Electron defaults to that for the bundled API, with loopback still used for the UI (`http://127.0.0.1`)
- Camera permission on Android must stay optional hardware for Huawei/Play filtering
- Packaged builds must not honor a leaked `ELECTRON_DEV=1` (would wait on Vite `:5173`)

**References**

- Feature guide: [docs/features/sync.md](../features/sync.md)
- Design sketch: [docs/superpowers/specs/2026-11-16-qr-pairing-connect-phone-design.md](../superpowers/specs/2026-11-16-qr-pairing-connect-phone-design.md)
