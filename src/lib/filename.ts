/** Safe filename stem for PDF / downloads (Windows + general). */
export function sanitizeFilename(name: string, fallback = 'note'): string {
  const s = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return s || fallback;
}

/** One path segment for exports: safe chars, spaces → hyphens. */
export function sanitizeFilenameSegment(name: string, fallback = ''): string {
  const s = sanitizeFilename(name, fallback)
    .replace(/\s+/g, '-')
    .replace(/_+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return s || fallback;
}

export type ExportNameParts = {
  book?: string | null;
  chapter?: string | null;
  page?: string | null;
};

/**
 * Export / print filename stem:
 * - with hierarchy: book_chapter_page
 * - otherwise: page name only
 */
export function buildExportFilename(parts: ExportNameParts): string {
  const page =
    sanitizeFilenameSegment(parts.page?.trim() || '', 'untitled') || 'untitled';
  const book = sanitizeFilenameSegment(parts.book?.trim() || '', '');
  const chapter = sanitizeFilenameSegment(parts.chapter?.trim() || '', '');

  const stem =
    book && chapter
      ? `${book}_${chapter}_${page}`
      : book
        ? `${book}_${page}`
        : chapter
          ? `${chapter}_${page}`
          : page;

  return stem.slice(0, 180) || 'untitled';
}

/** Human title for print document: Book · Chapter · Page (or just page). */
export function buildExportTitle(parts: ExportNameParts): string {
  const page = parts.page?.trim() || 'Untitled page';
  const book = parts.book?.trim() || '';
  const chapter = parts.chapter?.trim() || '';
  return [book, chapter, page].filter(Boolean).join(' · ');
}
