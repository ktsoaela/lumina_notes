# QR / deep-link phone pairing

**ADR:** [0002](../../adr/0002-qr-phone-pairing.md) (Accepted, 2026-11-16)

## Goal

Set the sync server URL on web/Electron once. The phone connects by scanning a QR or opening `lumina://pair?u=…&c=…` — not by typing a URL.

## Flow

1. Devices & sync → **Create pairing code** (`POST /api/pair/start`)
2. Phone scans QR → saves server URL → `POST /api/pair/complete` → session
3. Codes: 5-minute TTL, single-use
4. Local API QR uses LAN IP, never `127.0.0.1` / `0.0.0.0`

## Success criteria

- Happy path: no URL typed on the phone
- Same account + API as Electron after pair
- Clear error for expired/used codes
