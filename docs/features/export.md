# Print · Markdown · PDF export

![Export actions on a note](./screenshots/export.png)

## What it is

From any open page you can:

| Action | Result |
|--------|--------|
| **Print** | Opens a print-friendly window (browser print dialog — printer or “Print to PDF”) |
| **Markdown** | Downloads the page as a `.md` file |
| **PDF** | Downloads an A4 PDF from the rendered preview |

## How to use

1. Open a page in **Notes**.
2. In the note header, click **Print**, **Markdown**, or **PDF**.
3. For PDF, wait for generation; save the file when prompted.

## How it works

- Print uses `openPrintWindow` with sanitized HTML from the preview.
- Markdown uses a client-side download of title + content.
- PDF uses HTML → PDF (html2pdf / Electron printToPDF on desktop when available).

## Limits

Very large pages, complex Mermaid, or heavy Plotly charts may not rasterize perfectly in PDF. Prefer Print → system PDF for tricky pages.
