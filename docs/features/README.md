# Features

User guides for everything Lumina Notes ships today. Screenshots were captured with Playwright (`e2e/docs-screenshots.spec.ts`).

| Feature | Guide | Screenshot |
|---------|--------|------------|
| Markdown editing & preview | [markdown.md](./markdown.md) | [screenshots/markdown.png](./screenshots/markdown.png) |
| Mermaid diagrams | [mermaid.md](./mermaid.md) | [screenshots/mermaid.png](./screenshots/mermaid.png) |
| Plotly charts | [plotly.md](./plotly.md) | [screenshots/plotly.png](./screenshots/plotly.png) |
| Books · chapters · pages | [hierarchy.md](./hierarchy.md) | [screenshots/hierarchy.png](./screenshots/hierarchy.png) · [library.png](./screenshots/library.png) |
| stick'n sticky strips | [sticky-strips.md](./sticky-strips.md) | [screenshots/sticky-strips.png](./screenshots/sticky-strips.png) |
| Desktop app (Electron) | [desktop.md](./desktop.md) | [screenshots/notes-overview.png](./screenshots/notes-overview.png) |
| Phone & tablet (PWA) | [mobile-pwa.md](./mobile-pwa.md) | [screenshots/mobile-pwa.png](./screenshots/mobile-pwa.png) |
| Print · Markdown · PDF | [export.md](./export.md) | [screenshots/export.png](./screenshots/export.png) |
| Quick search | [search.md](./search.md) | [screenshots/search.png](./screenshots/search.png) |
| Devices & sync | [sync.md](./sync.md) | [screenshots/profile-sync.png](./screenshots/profile-sync.png) |

## Refresh screenshots

```bash
npx playwright install chromium   # once
npx playwright test e2e/docs-screenshots.spec.ts --workers=1
```

Images are written to `docs/features/screenshots/`.
