import { marked } from 'marked';
import { sanitizeHtml } from './sanitize';

/**
 * Print / PDF styles. Scoped to `.lumina-print-inner` for in-app PDF export
 * (html2canvas cannot rely on bare `body` selectors on a div root).
 */
export const PRINT_DOCUMENT_CSS = `
  .lumina-print-inner {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    box-sizing: border-box;
    padding: 28px 32px;
    line-height: 1.6;
    color: #1a1a1a !important;
    background: #ffffff !important;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .lumina-print-inner * {
    color: inherit;
    box-sizing: border-box;
  }
  .lumina-print-inner h1 {
    color: #2c3e50 !important;
    border-bottom: 2px solid #547f72;
    padding-bottom: 10px;
    margin-top: 0;
    font-size: 1.6rem;
    font-weight: 600;
  }
  .lumina-print-inner h2 {
    color: #34495e !important;
    border-bottom: 1px solid #bdc3c7;
    padding-bottom: 5px;
    margin-top: 25px;
    font-size: 1.25rem;
  }
  .lumina-print-inner h3 {
    color: #2c3e50 !important;
    margin-top: 20px;
    font-size: 1.1rem;
  }
  .lumina-print-inner .document-info {
    font-size: 14px;
    color: #555 !important;
    margin: 12px 0 0 0;
  }
  .lumina-print-inner .document-info p {
    margin: 4px 0;
    color: #555 !important;
  }
  .lumina-print-inner .markdown-content {
    font-size: 14px;
    color: #1a1a1a !important;
  }
  .lumina-print-inner .markdown-content p {
    margin-bottom: 12px;
    color: #1a1a1a !important;
  }
  .lumina-print-inner .markdown-content ul,
  .lumina-print-inner .markdown-content ol {
    margin-bottom: 12px;
    padding-left: 20px;
  }
  .lumina-print-inner .markdown-content li {
    margin-bottom: 4px;
  }
  .lumina-print-inner .markdown-content blockquote {
    border-left: 4px solid #547f72;
    padding-left: 15px;
    margin: 15px 0;
    color: #5c6b66 !important;
    font-style: italic;
  }
  .lumina-print-inner .markdown-content code {
    background-color: #f4f1ea;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 13px;
    color: #1a1a1a !important;
  }
  .lumina-print-inner .markdown-content pre {
    background-color: #f4f1ea;
    padding: 15px;
    border-radius: 5px;
    overflow-x: auto;
    border: 1px solid #e9ecef;
    color: #1a1a1a !important;
  }
  .lumina-print-inner .markdown-content pre code {
    background: none;
    padding: 0;
  }
  .lumina-print-inner .markdown-content strong {
    font-weight: bold;
    color: #2c3e50 !important;
  }
  .lumina-print-inner .markdown-content em {
    font-style: italic;
  }
  .lumina-print-inner .markdown-content a {
    color: #547f72 !important;
    text-decoration: underline;
  }
  .lumina-print-inner .markdown-content table {
    border-collapse: collapse;
    width: 100%;
    margin: 15px 0;
  }
  .lumina-print-inner .markdown-content th,
  .lumina-print-inner .markdown-content td {
    border: 1px solid #ddd;
    padding: 8px 12px;
    text-align: left;
    color: #1a1a1a !important;
  }
  .lumina-print-inner .markdown-content th {
    background-color: #f4f1ea;
    font-weight: bold;
  }
  /* Standalone print window (real body) */
  body.lumina-print-window {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    margin: 40px;
    line-height: 1.6;
    color: #1a1a1a;
    background: #ffffff;
  }
`;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function markdownToHtml(markdown: string): string {
  const result = marked.parse(markdown ?? '', { async: false });
  if (typeof result !== 'string') {
    throw new Error('Expected synchronous Markdown parse');
  }
  return sanitizeHtml(result);
}

/** Full HTML document for print preview window (workbook pattern). */
export function buildPrintDocumentHtml(
  title: string,
  markdown: string,
  documentName?: string
): string {
  const bodyHtml = markdownToHtml(markdown);
  const printed = new Date().toLocaleString();
  const fileTitle = documentName?.trim() || title;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(fileTitle)}</title>
  <style>${PRINT_DOCUMENT_CSS}</style>
</head>
<body class="lumina-print-window">
  <div class="lumina-print-inner">
    <h1>${escapeHtml(title)}</h1>
    <div class="document-info">
      <p><strong>Document Type:</strong> Markdown (.md)</p>
      <p><strong>Printed:</strong> ${escapeHtml(printed)}</p>
    </div>
    <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />
    <div class="markdown-content">${bodyHtml || '<p><em>No content on this page.</em></p>'}</div>
  </div>
</body>
</html>`;
}

/**
 * Opens a new window with rendered Markdown and triggers the system print dialog
 * (same flow as workbook/workbook EnhancedEditor).
 * `documentName` becomes the window / “Save as PDF” filename stem when provided.
 */
export function openPrintWindow(
  title: string,
  markdown: string,
  documentName?: string
): void {
  const html = buildPrintDocumentHtml(title, markdown, documentName);
  const w = window.open('', '_blank');
  if (!w) {
    window.alert('Pop-up blocked — allow pop-ups for this site to print.');
    return;
  }
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 0);
}

/**
 * Root element for PDF export: same content + styles as print, for html2canvas.
 * Returns the outer wrapper; pass `.lumina-print-inner` to html2pdf.
 */
export function createPrintRootElement(title: string, markdown: string): HTMLDivElement {
  const bodyHtml = markdownToHtml(markdown);
  const printed = new Date().toLocaleString();
  const root = document.createElement('div');
  root.setAttribute('data-lumina-print-root', 'true');
  root.innerHTML = `
    <style>${PRINT_DOCUMENT_CSS}</style>
    <div class="lumina-print-inner">
      <h1>${escapeHtml(title)}</h1>
      <div class="document-info">
        <p><strong>Document Type:</strong> Markdown (.md)</p>
        <p><strong>Printed:</strong> ${escapeHtml(printed)}</p>
      </div>
      <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />
      <div class="markdown-content">${bodyHtml || '<p><em>No content on this page.</em></p>'}</div>
    </div>
  `;
  return root;
}
