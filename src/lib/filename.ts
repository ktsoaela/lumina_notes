/** Safe filename stem for PDF / downloads (Windows + general). */
export function sanitizeFilename(name: string, fallback = 'note'): string {
  const s = name
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return s || fallback;
}
