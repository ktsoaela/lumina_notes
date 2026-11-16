# Changelog

All notable changes to **Lumina Notes** (`simple_markdown_notebook_application`) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.3.0] - 2026-11-17

### Added

- Version shown in Profile (desktop/web) and in Settings, the book tree and the sign-in screen (Flutter) — ADR 0003
- Update check against GitHub Releases with notices; in-app download (desktop installer / Android APK) and **Install now**; opt-in automatic download — ADR 0003
- Reading & writing settings: font style, size and colour, with a contrast guard; print/PDF follow the reader — ADR 0004
- Move pages between chapters and chapters between books: drag-and-drop and **Move to…** on desktop and mobile (`POST /api/pages/{id}/move`, `POST /api/sections/{id}/move`) — ADR 0005
- stick'n on/off switch; system tray icon with per-colour notes — ADR 0005 / 0007
- Flutter phone/tablet redesign: Library, chapter tabs, book tree, two-pane tablet — ADR 0006
- stick'n notes pull out of the strip and tuck back on close, colour header with × / Esc, formatting bar, clearer placeholder — ADR 0007

### Fixed

- Markdown preview spacing and margins (styles relied on a Tailwind plugin that was not installed); fenced code blocks keep their line breaks

## [1.1.0] - 2026-11-16

### Added

- Public GitHub Pages site (`docs/index.html`) with Windows portable download
- Windows portable artifact `Lumina-Notes.exe` (Electron + bundled API)

### Fixed

- Electron startup races (`ERR_ABORTED` on Vite load); sticky window failures no longer quit the app
- Require Pydantic v2 (`pydantic>=2,<3`) so FastAPI validators import correctly

### Security

- `.gitignore` hardened: ignore real `.env*` (keep `*.example` templates), SQLite DBs, and Playwright artifacts
- Restored compose env templates (`.env.alpha|bravo|charlie.example`) with placeholder secrets only

### Changed

- App version bumped to 1.1.0

## [1.0.0] - 2026-07-14

### Added

- Markdown notebooks with OneNote-style hierarchy (bookshelves → notebooks → sections → pages)
- Mermaid diagram and Plotly chart support
- Print and A4 PDF export from rendered preview
- FastAPI backend with JWT auth and SQLite
- Optional Django admin over the shared database
- Electron desktop shell and Windows NSIS installer

[Unreleased]: https://github.com/ktsoaela/lumina_notes/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/ktsoaela/lumina_notes/releases/tag/v1.1.0
[1.0.0]: https://github.com/ktsoaela/lumina_notes/releases/tag/v1.0.0
