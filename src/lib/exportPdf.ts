import { buildPrintDocumentHtml } from './printDocument';
import { apiUrl } from './syncServer';

declare global {
  interface Window {
    luminaDesktop?: {
      isDesktop: boolean;
      exportPdf: (
        html: string,
        filename: string
      ) => Promise<{ ok: boolean; path?: string; canceled?: boolean; error?: string }>;
      setStickyMode?: (mode: 'pack' | 'writing') => void;
      openPageInMain?: (nav: {
        bookshelfId: string;
        notebookId: string;
        sectionId: string;
        pageId: string;
      }) => void;
      onOpenPage?: (
        cb: (nav: {
          bookshelfId: string;
          notebookId: string;
          sectionId: string;
          pageId: string;
        }) => void
      ) => () => void;
    };
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename.endsWith('.pdf') ? filename : `${filename}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportPdfViaApi(
  title: string,
  markdown: string,
  filenameBase: string
): Promise<void> {
  const token = localStorage.getItem('lumina_token');
  const res = await fetch(apiUrl('/api/export/pdf'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      title,
      markdown,
      filename: filenameBase,
    }),
  });
  if (!res.ok) {
    let detail = 'PDF export failed';
    try {
      const j = (await res.json()) as { detail?: string };
      if (j.detail) detail = j.detail;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  const blob = await res.blob();
  const type = (blob.type || res.headers.get('content-type') || '').toLowerCase();
  // Reject empty / non-PDF bodies (e.g. stale proxy HTML, broken renderer)
  if (blob.size < 1024 || (type && !type.includes('pdf') && !type.includes('octet-stream'))) {
    throw new Error(
      `PDF export returned invalid file (${blob.size} bytes, ${type || 'unknown type'})`
    );
  }
  downloadBlob(blob, `${filenameBase}.pdf`);
}

async function exportPdfViaHtml2Pdf(
  title: string,
  markdown: string,
  filenameBase: string
): Promise<void> {
  const { exportMarkdownToPdf: legacy } = await import('./exportPdfLegacy');
  await legacy(title, markdown, filenameBase);
}

/**
 * Hybrid PDF export:
 * 1) Electron Chromium printToPDF (desktop)
 * 2) Python API → Chrome/Edge --print-to-pdf (or Playwright)
 * 3) Browser html2pdf fallback
 */
export async function exportMarkdownToPdf(
  title: string,
  markdown: string,
  filenameBase: string
): Promise<void> {
  const html = buildPrintDocumentHtml(title, markdown, filenameBase);
  const errors: string[] = [];

  if (window.luminaDesktop?.exportPdf) {
    try {
      const result = await window.luminaDesktop.exportPdf(html, `${filenameBase}.pdf`);
      if (result.ok) return;
      if (result.canceled) return;
      if (result.error) errors.push(`electron: ${result.error}`);
    } catch (e) {
      errors.push(`electron: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  try {
    await exportPdfViaApi(title, markdown, filenameBase);
    return;
  } catch (e) {
    errors.push(`api: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    await exportPdfViaHtml2Pdf(title, markdown, filenameBase);
    return;
  } catch (e) {
    errors.push(`html2pdf: ${e instanceof Error ? e.message : String(e)}`);
  }

  throw new Error(errors.join(' · ') || 'PDF export failed');
}
