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

/* ---------- contrast guard (WCAG relative luminance) ---------- */

function parseHex(c: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return null;
  const h = m[1].length === 3 ? m[1].replace(/./g, (x) => x + x) : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio (1–21), or null when a colour can't be parsed. */
export function contrastRatio(a: string, b: string): number | null {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return null;
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Minimum ratio for a custom text colour; below this we fall back to the theme colour. */
export const MIN_READER_CONTRAST = 3;

/** The current theme's page colour (`--paper`). */
export function currentPaperColor(): string {
  try {
    return getComputedStyle(document.documentElement).getPropertyValue('--paper').trim();
  } catch {
    return '';
  }
}

/** True when the custom colour is readable on [paper] (or can't be judged). */
export function isReadableOn(color: string, paper: string): boolean {
  const r = contrastRatio(color, paper);
  return r === null || r >= MIN_READER_CONTRAST;
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
  // Respect theme contrast: a colour that vanishes on this theme's paper is ignored.
  if (prefs.color && isReadableOn(prefs.color, currentPaperColor())) {
    root.setProperty('--reader-color', prefs.color);
  } else {
    root.removeProperty('--reader-color');
  }
}
