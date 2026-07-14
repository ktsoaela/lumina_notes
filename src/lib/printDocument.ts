import { marked } from 'marked';
import { sanitizeHtml } from './sanitize';

/**
 * Print / PDF HTML aligned with workbook/workbook EnhancedEditor (Markdown branch):
 * new window + document.write + print(), and the same HTML for html2pdf.
 */
export const PRINT_DOCUMENT_CSS = `
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    margin: 40px;
    line-height: 1.6;
    color: #333;
  }
  h1 {
    color: #2c3e50;
    border-bottom: 2px solid #3498db;
    padding-bottom: 10px;
    margin-top: 0;
  }
  h2 {
    color: #34495e;
    border-bottom: 1px solid #bdc3c7;
    padding-bottom: 5px;
    margin-top: 25px;
  }
  h3 {
    color: #2c3e50;
    margin-top: 20px;
  }
  .document-info {
    font-size: 14px;
    color: #555;
    margin: 12px 0 0 0;
  }
  .document-info p {
    margin: 4px 0;
  }
  .markdown-content {
    font-size: 14px;
  }
  .markdown-content p {
    margin-bottom: 12px;
  }
  .markdown-content ul, .markdown-content ol {
    margin-bottom: 12px;
    padding-left: 20px;
  }
  .markdown-content li {
    margin-bottom: 4px;
  }
  .markdown-content blockquote {
    border-left: 4px solid #3498db;
    padding-left: 15px;
    margin: 15px 0;
    color: #7f8c8d;
    font-style: italic;
  }
  .markdown-content code {
    background-color: #f8f9fa;
    padding: 2px 4px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 13px;
  }
  .markdown-content pre {
    background-color: #f8f9fa;
    padding: 15px;
    border-radius: 5px;
    overflow-x: auto;
    border: 1px solid #e9ecef;
  }
  .markdown-content pre code {
    background: none;
    padding: 0;
  }
  .markdown-content strong {
    font-weight: bold;
    color: #2c3e50;
  }
  .markdown-content em {
    font-style: italic;
  }
  .markdown-content a {
    color: #3498db;
    text-decoration: none;
  }
  .markdown-content table {
    border-collapse: collapse;
    width: 100%;
    margin: 15px 0;
  }
  .markdown-content th, .markdown-content td {
    border: 1px solid #ddd;
    padding: 8px 12px;
    text-align: left;
  }
  .markdown-content th {
    background-color: #f8f9fa;
    font-weight: bold;
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
  const result = marked.parse(markdown, { async: false });
  if (typeof result !== 'string') {
    throw new Error('Expected synchronous Markdown parse');
  }
  return sanitizeHtml(result);
}

/** Full HTML document for print preview window (workbook pattern). */
export function buildPrintDocumentHtml(title: string, markdown: string): string {
  const bodyHtml = markdownToHtml(markdown);
  const printed = new Date().toLocaleString();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>${PRINT_DOCUMENT_CSS}</style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="document-info">
    <p><strong>Document Type:</strong> Markdown (.md)</p>
    <p><strong>Printed:</strong> ${escapeHtml(printed)}</p>
  </div>
  <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />
  <div class="markdown-content">${bodyHtml}</div>
</body>
</html>`;
}

/**
 * Opens a new window with rendered Markdown and triggers the system print dialog
 * (same flow as workbook/workbook EnhancedEditor).
 */
export function openPrintWindow(title: string, markdown: string): void {
  const html = buildPrintDocumentHtml(title, markdown);
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
      <div class="markdown-content">${bodyHtml}</div>
    </div>
  `;
  return root;
}
