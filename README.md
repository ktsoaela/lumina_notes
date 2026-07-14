<div align="center">
  <img src="src/assets/book_black_and_white.png" alt="Lumina Notes logo" width="128" style="background:#ffffff;padding:16px;border-radius:12px" />
</div>

# Lumina Notes

**simple_markdown_notebook_application**

A Markdown note-taking app with a OneNote-inspired hierarchy (bookshelves → notebooks → sections → pages), Mermaid diagrams, Plotly charts, print/PDF export, and a Windows Electron desktop shell.

**Author:** [Khotso Tsoaela](https://github.com/ktsoaela) (`@ktsoaela`)

## Features

- Hierarchical notebooks with Markdown editing and live preview
- Mermaid diagrams and Plotly charts in notes
- Print and A4 PDF export from the rendered preview
- JWT authentication and shared SQLite storage
- Optional Django admin over the same database
- Windows installer via Electron (Start menu — no terminal required day to day)

## Stack

| Layer | Technology |
|--------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| API | FastAPI, Uvicorn, SQLite |
| Admin (optional) | Django 5 |
| Desktop | Electron + electron-builder (NSIS) |

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)
- [Python](https://www.python.org/) 3.11+

## Run locally

1. Install JavaScript dependencies:

   ```bash
   npm install
   ```

2. Install Python dependencies:

   ```bash
   pip install -r requirements.txt
   ```

3. Copy `.env.example` to `.env.local` (or `.env`) and set at least:

   - `JWT_SECRET` — secret used to sign auth tokens (required in production)
   - `LUMINA_ENV=production` — enables strict secret checks, disables demo seed & Swagger by default

4. Start the app:

   | Goal | Command |
   |------|---------|
   | Frontend only (Vite) | `npm run dev` |
   | Full stack (API + Django + Vite) | `npm start` |
   | Electron + Vite + API | `npm run dev:electron` |

Dev ports (defaults): Vite `5173`, API `58888`, Django admin `8001`.

## Print & PDF

On an open note, use **Print** (browser print dialog — printer or **Microsoft Print to PDF**) or **PDF** to download an A4 PDF from the rendered Markdown preview. Very large pages or some embedded charts may not rasterize perfectly in PDF.

## Windows desktop app

The desktop shell is **Electron**. The API and UI are **FastAPI + the built Vite `dist`** (bundled next to `LuminaApi.exe`).

### Using a prebuilt installer

1. Run the NSIS installer from `release/electron/` (e.g. `Lumina Notes Setup 1.0.0.exe`).
2. Launch **Lumina Notes** from the Start menu.

### Build the installer

Requires Node.js and Python (PyInstaller is installed by the build script if needed).

```bash
npm run build:installer
```

Or double-click `scripts/build_installer.bat`. The installer appears under `release/electron/`.

Default data file: `database.sqlite` next to `LuminaApi.exe` in the app’s `resources/backend` folder.

Optional: [Inno Setup 6](https://jrsoftware.org/isdl.php) can wrap `release/electron/win-unpacked` using `installer/LuminaNotes.iss`. The primary Windows installer is **electron-builder** (NSIS).

### Login errors / `passlib` + bcrypt

The API uses the `bcrypt` package only. If you see `passlib` in tracebacks or `(trapped) error reading bcrypt version`:

```bash
pip uninstall passlib -y
```

Then restart the API / uvicorn so it reloads `app.py`.

## Docker

Three stacks (separate Compose projects so they can run side-by-side):

| Codename | Role | API port | Postgres host port |
|----------|------|----------|--------------------|
| **charlie** | development | 58881 | 5433 |
| **bravo** | test / QA | 58882 | 5434 |
| **alpha** | production | 58888 | not published |

```bash
# Dev
cp .env.charlie.example .env.charlie   # optional
npm run compose:charlie -- up --build -d

# QA
cp .env.bravo.example .env.bravo       # set real secrets
npm run compose:bravo -- up --build -d

# Prod (requires .env.alpha)
cp .env.alpha.example .env.alpha       # set real JWT_SECRET + CORS_ORIGINS
npm run compose:alpha -- up --build -d
```

Or: `scripts\compose_env.bat charlie up --build -d`

Desktop/Electron keeps **SQLite**. Server stacks (**bravo** / **alpha**) use **Postgres** and `LUMINA_ENV=production`.

Single-container (bring your own Postgres URL):

```bash
docker build -t lumina-notes .
docker run --rm -p 58888:58888 \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e LUMINA_ENV=production \
  -e DATABASE_URL=postgresql://user:pass@host:5432/lumina \
  -e CORS_ORIGINS=http://127.0.0.1:58888 \
  lumina-notes
```

Health: `/health` on the API port.

## Kubernetes

Manifests live in `k8s/`. See [CONTRIBUTING.md](CONTRIBUTING.md) and the [Wiki](https://github.com/fullyoperational/lumina_notes/wiki) for cluster notes.

```bash
kubectl apply -f k8s/
```

## Documentation

| Doc | Purpose |
|-----|---------|
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute |
| [wiki/Ops-Runbooks.md](wiki/Ops-Runbooks.md) | Backup, secrets, incidents |
| [LICENSE](LICENSE) | MIT License |
| [GitHub Wiki](https://github.com/fullyoperational/lumina_notes/wiki) | Extended guides |

## License

MIT © Khotso Tsoaela

Notebook icon: [Flaticon](https://www.flaticon.com/free-icon/book_2015630)
