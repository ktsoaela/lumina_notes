import html2pdf from 'html2pdf.js';
import { createPrintRootElement } from './printDocument';

/** Last-resort browser PDF when Electron + Python Chrome are unavailable. */
export async function exportMarkdownToPdf(
  title: string,
  markdown: string,
  filenameBase: string
): Promise<void> {
  const root = createPrintRootElement(title, markdown);
  document.body.appendChild(root);
  const el =
    (root.querySelector('.lumina-print-inner') as HTMLElement | null) ?? root;
  const prevCss = el.style.cssText;
  Object.assign(el.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '794px',
    maxWidth: '794px',
    minHeight: '200px',
    boxSizing: 'border-box',
    background: '#ffffff',
    color: '#1a1a1a',
    zIndex: '2147483646',
    opacity: '1',
    visibility: 'visible',
    pointerEvents: 'none',
    overflow: 'visible',
  });
  try {
    await document.fonts.ready.catch(() => undefined);
    await new Promise((r) => setTimeout(r, 250));
    await html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: `${filenameBase}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      } as never)
      .from(el)
      .save();
  } finally {
    el.style.cssText = prevCss;
    root.remove();
  }
}
