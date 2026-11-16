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

## Finding your way around (v1.3)

- **Library** — your bookshelves are chips across the top; books are cards with a coloured spine. Long-press (or ⋮) a book to rename or delete it.
- **Inside a book** — chapters are colour-coded **tabs**; the numbered page list sits below. Tap **Book tree** (top right) for the whole Book · chapter · page tree.
- **Tablet (≥ 840 dp wide)** — the page list stays beside the editor; on a **phone** the editor opens on its own screen and Back returns to the list.
- **Move** — ⋮ on a page → *Move to another chapter*; long-press a chapter tab → *Move to another book*. Or long-press a page and drop it on a chapter tab.
- **Reading** — Preview uses a VS Code–style Markdown reader.

## Settings

Tap the **Settings** icon in the Library:

- **Appearance** — System / Light / Dark.
- **Reading & writing** — font style, size (12–28 px) and colour for the editor and preview. A colour too faint for the current theme is ignored (you'll see a warning).
- **About & updates** — installed version (also shown on the sign-in screen and at the bottom of the book tree), latest release, **Download update** inside the app, then **Install now** (Android asks you to confirm). Optional: *Tell me about new versions* (on) and *Download updates automatically* (off).
- **Account** — server, email, sign out.

## Decisions

- [ADR 0001 — Flutter offline sync](../adr/0001-flutter-mobile-offline-sync.md)
- [ADR 0002 — QR phone pairing](../adr/0002-qr-phone-pairing.md)
- [ADR 0003 — Version and updates](../adr/0003-profile-version-and-updates.md)
- [ADR 0004 — Reader typography](../adr/0004-markdown-reader-typography.md)
- [ADR 0005 — Move pages and chapters](../adr/0005-sticky-toggle-and-move-hierarchy.md)
- [ADR 0006 — Phone / tablet UI](../adr/0006-mobile-tablet-ui-desktop-frozen.md)

See also [Devices & sync](./sync.md). The older [PWA guide](./mobile-pwa.md) remains for the web install path.
