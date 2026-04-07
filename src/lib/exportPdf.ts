import html2pdf from 'html2pdf.js';
import { createPrintRootElement } from './printDocument';

/**
 * PDF from the same rendered Markdown/HTML as print (workbook-style document + metadata).
 */
export async function exportMarkdownToPdf(
  title: string,
  markdown: string,
  filenameBase: string
): Promise<void> {
  const el = createPrintRootElement(title, markdown);
  document.body.appendChild(el);
  try {
    await exportPageToPdf(el, filenameBase);
  } finally {
    el.remove();
  }
}

/**
 * Renders a DOM subtree to A4 PDF via html2canvas + jsPDF.
 * Temporarily moves the node on-screen — html2canvas often returns a blank PDF
 * for elements far outside the viewport (e.g. left: -12000px) or display:none.
 */
export async function exportPageToPdf(
  sourceElement: HTMLElement,
  filenameBase: string
): Promise<void> {
  const el = sourceElement;
  const prevCss = el.style.cssText;

  // Bring on-screen for rasterization; inline styles override Tailwind opacity/position.
  Object.assign(el.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '210mm',
    maxWidth: '210mm',
    boxSizing: 'border-box',
    background: '#ffffff',
    zIndex: '2147483646',
    opacity: '1',
    visibility: 'visible',
    pointerEvents: 'none',
    overflow: 'visible',
  });

  await document.fonts.ready.catch(() => undefined);
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
  // Mermaid / async SVG layout
  await new Promise((r) => setTimeout(r, 250));

  try {
    await html2pdf()
      .set({
        margin: [12, 12, 12, 12],
        filename: `${filenameBase}.pdf`,
        image: { type: 'jpeg', quality: 0.92 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          scrollX: 0,
          scrollY: 0,
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      })
      .from(el)
      .save();
  } finally {
    el.style.cssText = prevCss;
  }
}
