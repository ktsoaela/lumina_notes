<div align="center">
  <img src="src/assets/book_colour_outline.png" alt="Lumina Notes logo" width="128" style="background:#ffffff;padding:16px;border-radius:12px" />

  <h1>Lumina Notes</h1>

  <p><strong>Markdown notebooks with Mermaid, Plotly, desktop stickies, and self-hosted sync.</strong></p>

  <p>
    <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-375348?style=flat-square" /></a>
    <a href="https://ktsoaela.github.io/lumina_notes/"><img alt="Site" src="https://img.shields.io/badge/site-open-375348?style=flat-square" /></a>
    <a href="docs/features/README.md"><img alt="Docs" src="https://img.shields.io/badge/docs-features-547f72?style=flat-square" /></a>
    <img alt="Stack" src="https://img.shields.io/badge/React_19-FastAPI-436659?style=flat-square" />
  </p>
</div>

**[Open Lumina Notes →](https://ktsoaela.github.io/lumina_notes/)**

<p align="center">
  <img src="docs/features/screenshots/notes-overview.png" alt="Notes workspace" width="900" />
</p>

The page is [`docs/index.html`](docs/index.html). It is published from the `dev` branch by GitHub Actions.

**Author:** [Khotso Tsoaela](https://github.com/ktsoaela) (`@ktsoaela`)

---

## Why Lumina

- **OneNote-shaped** shelves → books → chapters → pages
- **Markdown-first** editor with live split preview
- **Mermaid** diagrams and **Plotly** charts in notes
- **Desktop** Electron app with neon **stick'n** sticky strips
- **PWA / Android** for phone and tablet
- **Your server** — JWT + SQLite/Postgres; no vendor lock-in cloud

## Quick start

**Requirements:** Node.js LTS, Python 3.11+

```bash
npm install
pip install -r requirements.txt
cp .env.example .env.local   # set JWT_SECRET for production
npm start                    # API + Django admin + Vite
```

| Goal | Command |
|------|---------|
| Frontend only | `npm run dev` → http://127.0.0.1:5173 |
| Full stack | `npm start` |
| Desktop + API + Vite | `npm run dev:electron` |
| Demo account (dev) | **View Demo** on the landing page (`demo_user` / `demo_user`) |

Default ports: Vite `5173`, API `58888`, Django `8001`.

### Production checklist

1. Set `LUMINA_ENV=production` and a strong `JWT_SECRET`
2. Set `CORS_ORIGINS` to your real web / PWA origins
3. Prefer Postgres via `DATABASE_URL` for shared servers
4. Disable demo seed (`SEED_DEMO_USER=0`) and docs UI on public hosts
5. Terminate TLS at your reverse proxy; expose only `/health` for probes

---

## Features & guides

Each feature has a short how-to (with Playwright screenshots):

| Feature | Guide |
|---------|--------|
| Edit · Read · Two pages | [docs/features/editor-views.md](docs/features/editor-views.md) |
| Markdown & live preview | [docs/features/markdown.md](docs/features/markdown.md) |
| Mermaid diagrams | [docs/features/mermaid.md](docs/features/mermaid.md) |
| Plotly charts | [docs/features/plotly.md](docs/features/plotly.md) |
| Books · chapters · pages | [docs/features/hierarchy.md](docs/features/hierarchy.md) |
| stick'n sticky strips | [docs/features/sticky-strips.md](docs/features/sticky-strips.md) |
| Desktop app | [docs/features/desktop.md](docs/features/desktop.md) |
| Phone & tablet (PWA) | [docs/features/mobile-pwa.md](docs/features/mobile-pwa.md) |
| Print · Markdown · PDF | [docs/features/export.md](docs/features/export.md) |
| Quick search (Ctrl+K) | [docs/features/search.md](docs/features/search.md) |
| Devices & sync | [docs/features/sync.md](docs/features/sync.md) |

Full index: [docs/features/README.md](docs/features/README.md)

<p align="center">
  <img src="docs/features/screenshots/mermaid.png" alt="Mermaid feature" width="420" />
  &nbsp;
  <img src="docs/features/screenshots/search.png" alt="Search feature" width="420" />
</p>

### Refresh docs screenshots

```bash
npx playwright install chromium
npx playwright test e2e/docs-screenshots.spec.ts --workers=1
```

---

## Stack

| Layer | Technology |
|--------|------------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS |
| API | FastAPI, Uvicorn, SQLite (or Postgres) |
| Admin (optional) | Django 5 (same database) |
| Desktop | Electron + electron-builder (Windows / macOS) |
| Mobile | PWA + Capacitor (Android APK) |

---

## Desktop & mobile packages

| Platform | Command / doc |
|----------|----------------|
| Windows installer | `npm run build:win` / `npm run build:installer` |
| macOS | `npm run build:mac` (on macOS) |
| Android APK | `npm run build:apk` |
| Sync & packaging notes | [docs/PACKAGING.md](docs/PACKAGING.md) |

Artifacts appear under `release/electron/` and Android Studio / Gradle output paths (see packaging doc).

---

## Docker

Three Compose projects (can run side by side):

| Codename | Role | API port |
|----------|------|----------|
| **charlie** | development | 58881 |
| **bravo** | test / QA | 58882 |
| **alpha** | production | 58888 |

```bash
# create .env.alpha locally from .env.example — do not commit it
npm run compose:alpha -- up --build -d
```

Health: `GET /health` on the API port.

Single image:

```bash
docker build -t lumina-notes .
docker run --rm -p 58888:58888 \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e LUMINA_ENV=production \
  -e DATABASE_URL=postgresql://user:pass@host:5432/lumina \
  -e CORS_ORIGINS=http://127.0.0.1:58888 \
  lumina-notes
```

---

## Kubernetes

```bash
kubectl apply -f k8s/
```

See [wiki/Kubernetes.md](wiki/Kubernetes.md) and [wiki/Ops-Runbooks.md](wiki/Ops-Runbooks.md).

---

## Documentation map

| Doc | Purpose |
|-----|---------|
| [docs/features/](docs/features/README.md) | Per-feature user guides + screenshots |
| [docs/PACKAGING.md](docs/PACKAGING.md) | Desktop, APK, multi-device sync |
| [wiki/Home.md](wiki/Home.md) | Wiki index |
| [CHANGELOG.md](CHANGELOG.md) | Release history |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development & PR guide |
| [LICENSE](LICENSE) | MIT |

---

## License

MIT © Khotso Tsoaela

Notebook icon: [Flaticon](https://www.flaticon.com/free-icon/book_2015630)
