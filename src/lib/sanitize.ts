import type { Config } from 'dompurify';
import DOMPurify from 'dompurify';

const PRINT_PURIFY: Config = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
};

const SVG_PURIFY: Config = {
  USE_PROFILES: { svg: true, svgFilters: true },
  ADD_TAGS: ['foreignObject'],
};

/** Sanitize Markdown→HTML for print/PDF (blocks scripts / event handlers). */
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, PRINT_PURIFY);
}

/** Sanitize Mermaid SVG output before assigning to innerHTML. */
export function sanitizeSvg(dirty: string): string {
  return DOMPurify.sanitize(dirty, SVG_PURIFY);
}

export function escapeText(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
