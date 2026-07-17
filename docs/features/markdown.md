# Markdown editing & live preview

![Markdown split view](./screenshots/markdown.png)

## What it is

Lumina is Markdown-first. Each page is a Markdown document you edit in **Notes**.

Use the top bar to switch views — **Edit**, **Split**, or **Read** — or open **Two pages** to compare two notes side by side. See [editor-views.md](./editor-views.md) for screenshots and details.

GitHub Flavored Markdown (GFM) is supported via `remark-gfm` (tables, strikethrough, task lists, autolinks).

## How to use

1. Open **Notes** and select a page in the sidebar.
2. Pick **Edit**, **Split**, or **Read** in the top bar (default is **Split** on desktop).
3. Type Markdown in the editor. The preview updates as you type.
4. Title the page in the header field above the editor.

### Useful syntax

```markdown
# Heading
**bold** and *italic*
- [ ] task
- [x] done

| Col A | Col B |
|-------|-------|
| one   | two   |
```

## Tips

- Word/character count appears under the editor.
- Export the rendered page with **Print**, **Markdown**, or **PDF** (see [export.md](./export.md)).
- Diagrams and charts use fenced code blocks — see [mermaid.md](./mermaid.md) and [plotly.md](./plotly.md).

## Limits

Code blocks are monospace; dedicated syntax highlighting themes are not included yet.
