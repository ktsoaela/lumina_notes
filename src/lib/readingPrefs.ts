/** Reading & writing typography — font style, size, colour for editor + Markdown preview. */

export type ReaderFontId = 'lumina' | 'system' | 'sans' | 'georgia' | 'mono';

export const READER_FONTS: { id: ReaderFontId; label: string; stack: string }[] = [
  {
    id: 'lumina',
    label: 'Lumina serif (default)',
    stack: '"Source Serif 4", ui-serif, Georgia, serif',
  },
  {
    id: 'system',
    label: 'System UI (VS Code style)',
    stack:
      '-apple-system, BlinkMacSystemFont, "Segoe WPC", "Segoe UI", system-ui, "Ubuntu", "Droid Sans", sans-serif',
  },
  {
    id: 'sans',
    label: 'Plus Jakarta Sans',
    stack: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
  },
  { id: 'georgia', label: 'Georgia', stack: 'Georgia, "Times New Roman", serif' },
  {
    id: 'mono',
    label: 'JetBrains Mono',
    stack: '"JetBrains Mono", ui-monospace, SFMono-Regular, Consolas, monospace',
  },
];

export type ReadingPrefs = {
  font: ReaderFontId;
  /** px, 12–28 */
  size: number;
  /** CSS colour, or null to follow the theme */
  color: string | null;
};

export const DEFAULT_READING: ReadingPrefs = { font: 'lumina', size: 16, color: null };
export const READER_SIZE_MIN = 12;
export const READER_SIZE_MAX = 28;

const KEY = 'lumina_reading';
export const READING_EVENT = 'lumina-reading-prefs';

export function getStoredReading(): ReadingPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_READING };
    const p = JSON.parse(raw) as Partial<ReadingPrefs>;
    const font = READER_FONTS.some((f) => f.id === p.font)
      ? (p.font as ReaderFontId)
      : DEFAULT_READING.font;
    const size = Number(p.size);
    const color =
      typeof p.color === 'string' && /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : null;
    return {
      font,
      size:
        Number.isFinite(size) && size >= READER_SIZE_MIN && size <= READER_SIZE_MAX
          ? Math.round(size)
          : DEFAULT_READING.size,
      color,
    };
  } catch {
    return { ...DEFAULT_READING };
  }
}

export function setStoredReading(prefs: ReadingPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event(READING_EVENT));
  } catch {
    /* ignore */
  }
}

export function applyReading(prefs: ReadingPrefs): void {
  const root = document.documentElement.style;
  const font = READER_FONTS.find((f) => f.id === prefs.font) ?? READER_FONTS[0];
  root.setProperty('--reader-font', font.stack);
  // Lumina's own identity pairs Source Serif body with Fraunces headings;
  // any other choice uses the picked font for headings too (like VS Code).
  root.setProperty(
    '--reader-heading-font',
    font.id === 'lumina' ? 'var(--font-display)' : font.stack
  );
  root.setProperty('--reader-size', `${prefs.size}px`);
  if (prefs.color) root.setProperty('--reader-color', prefs.color);
  else root.removeProperty('--reader-color');
}
