export type ThemeMode = 'light' | 'dark' | 'contrast';

/** First visit and any non-`dark`/`contrast` preference use light mode. */
export const DEFAULT_THEME: ThemeMode = 'light';

const KEY = 'lumina_theme';

export function getStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)?.trim();
    if (v === 'dark' || v === 'contrast') return v;
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

export function setStoredTheme(mode: ThemeMode): void {
  try {
    if (mode === 'dark' || mode === 'contrast') {
      localStorage.setItem(KEY, mode);
    } else {
      localStorage.removeItem(KEY);
    }
  } catch {
    /* ignore */
  }
}

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  root.classList.remove('dark', 'contrast');
  if (mode === 'dark') {
    root.classList.add('dark');
  } else if (mode === 'contrast') {
    root.classList.add('contrast');
  }
  root.style.colorScheme =
    mode === 'dark' || mode === 'contrast' ? 'dark' : 'light';
}
