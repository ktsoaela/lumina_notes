# Flutter phone & tablet

Primary mobile client for Lumina Notes. Source: [`mobile/`](../../mobile/README.md).

## What it is

A Flutter app with a **local Drift database**. You can read and edit notes offline; changes sync to your self-hosted FastAPI when the network is back. Electron stays the desktop app.

## How to use

1. Install the APK from [Releases](https://github.com/ktsoaela/lumina_notes/releases) (or build with `flutter build apk --release` in `mobile/`).
2. On desktop, open **Profile → Devices & sync → Connect phone** and create a pairing code.
3. On the phone, tap **Scan to connect** and scan the QR (or open the `lumina://pair` link).
4. You are signed into the same account; notes sync both ways.

Typing a server URL is still available under **Enter server manually**.

## Decisions

- [ADR 0001 — Flutter offline sync](../adr/0001-flutter-mobile-offline-sync.md)
- [ADR 0002 — QR phone pairing](../adr/0002-qr-phone-pairing.md)

See also [Devices & sync](./sync.md). The older [PWA guide](./mobile-pwa.md) remains for the web install path.
