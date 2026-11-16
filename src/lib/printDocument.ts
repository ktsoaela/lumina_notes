import { marked } from 'marked';
import { sanitizeHtml } from './sanitize';
import { READER_FONTS, getStoredReading } from './readingPrefs';

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
  /* Body follows the on-screen reader (index.css .md-reader): VS Code-like rhythm,
     the user's font + size, always dark-on-white for paper. */
  .lumina-print-inner .markdown-content {
    font-family: var(--print-font, 'Source Serif 4', Georgia, serif);
    font-size: var(--print-size, 14px);
    line-height: 1.6;
    color: #1a1a1a !important;
    overflow-wrap: break-word;
  }
  .lumina-print-inner .markdown-content :where(p, ul, ol, blockquote, pre, table) {
    margin: 0 0 1em;
  }
  .lumina-print-inner .markdown-content :where(h1, h2, h3, h4, h5, h6) {
    font-family: var(--print-heading-font, var(--print-font, Georgia, serif));
    font-weight: 600;
    line-height: 1.25;
    margin: 1.5em 0 0.65em;
    color: #1a1a1a !important;
  }
  .lumina-print-inner .markdown-content h1 { font-size: 2em; padding-bottom: 0.3em; border-bottom: 1px solid #ddd; }
  .lumina-print-inner .markdown-content h2 { font-size: 1.5em; padding-bottom: 0.3em; border-bottom: 1px solid #ddd; }
  .lumina-print-inner .markdown-content h3 { font-size: 1.25em; }
  .lumina-print-inner .markdown-content h4 { font-size: 1em; }
  .lumina-print-inner .markdown-content :where(ul, ol) { padding-left: 2em; }
  .lumina-print-inner .markdown-content li + li { margin-top: 0.25em; }
  .lumina-print-inner .markdown-content blockquote {
    padding: 0 1em;
    border-left: 0.25em solid #c9d6d1;
    color: #5c6b66 !important;
  }
  .lumina-print-inner .markdown-content hr { height: 2px; border: 0; background: #e3e3e3; margin: 1.75em 0; }
  .lumina-print-inner .markdown-content img { max-width: 100%; }
  .lumina-print-inner .markdown-content code {
    font-family: 'JetBrains Mono', Consolas, 'Courier New', monospace;
    font-size: 0.875em;
    padding: 0.15em 0.4em;
    border-radius: 4px;
    background-color: #f4f1ea;
    color: #1a1a1a !important;
  }
  .lumina-print-inner .markdown-content pre {
    font-size: 0.875em;
    line-height: 1.5;
    padding: 1em;
    border-radius: 6px;
    background-color: #f4f1ea;
    border: 1px solid #e9ecef;
    overflow-x: auto;
    white-space: pre-wrap;
  }
  .lumina-print-inner .markdown-content pre code { font-size: 1em; padding: 0; background: none; }
  .lumina-print-inner .markdown-content strong { font-weight: 600; }
  .lumina-print-inner .markdown-content a { color: #375348 !important; text-decoration: underline; }
  .lumina-print-inner .markdown-content table { border-collapse: collapse; margin: 0 0 1em; }
  .lumina-print-inner .markdown-content :where(th, td) {
    border: 1px solid #ddd;
    padding: 0.4em 0.85em;
    text-align: left;
    color: #1a1a1a !important;
  }
  .lumina-print-inner .markdown-content th { background-color: #f4f1ea; font-weight: 600; }
  /* Standalone print window (real body) */
  body.lumina-print-window {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    margin: 40px;
    line-height: 1.6;
    color: #1a1a1a;
    background: #ffffff;
  }
`;

/** The user's reading font + size (Profile → Reading & writing), for paper. */
function readerPrintCss(): string {
  try {
    const prefs = getStoredReading();
    const font = READER_FONTS.find((f) => f.id === prefs.font) ?? READER_FONTS[0];
    const heading = font.id === 'lumina' ? '"Fraunces", Georgia, serif' : font.stack;
    // Screen px → print: a touch smaller reads the same on paper.
    const size = Math.max(10, Math.round(prefs.size * 0.875));
    return `.lumina-print-inner{--print-font:${font.stack};--print-heading-font:${heading};--print-size:${size}px;}`;
  } catch {
    return '';
  }
}

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
  <style>${PRINT_DOCUMENT_CSS}${readerPrintCss()}</style>
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
