# Changelog

All notable changes to **Lumina Notes** (`simple_markdown_notebook_application`) are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- `/health` (+ `/ready`) DB-ready probes; Swagger/OpenAPI gated by `ENABLE_DOCS`
- Auth rate limiting; Pydantic size/password limits aligned with the client
- Toast notifications + React error boundary for save/UI failures
- API integration tests (`tests/test_api.py` / `npm run test:api`)
- DOMPurify sanitization for print/PDF HTML and Mermaid SVG

### Changed

- JWT tokens expire (`JWT_EXPIRE_HOURS`, default 24); production requires real `JWT_SECRET`
- Demo account seeding off by default in production (`SEED_DEMO_USER`)
- Docker runs as non-root with `HEALTHCHECK`; k8s probes use `/health`, CORS is origin-explicit
- Django honors `DATABASE_PATH` and refuses weak secrets / debug in production
- Removed Gemini API key from the Vite client bundle

### Added (docs / tooling)

- Project documentation suite: README, LICENSE, CHANGELOG, CONTRIBUTING
- GitHub Actions CI/CD workflow
- Dependabot configuration for npm and GitHub Actions
- Dockerfile for containerized API + static UI
- Kubernetes manifests under `k8s/`
- Wiki starter pages under `wiki/`

## [1.0.0] - 2026-07-14

### Added

- Markdown notebooks with OneNote-style hierarchy (bookshelves → notebooks → sections → pages)
- Mermaid diagram and Plotly chart support
- Print and A4 PDF export from rendered preview
- FastAPI backend with JWT auth and SQLite
- Optional Django admin over the shared database
- Electron desktop shell and Windows NSIS installer

[Unreleased]: https://github.com/fullyoperational/lumina_notes/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/fullyoperational/lumina_notes/releases/tag/v1.0.0
