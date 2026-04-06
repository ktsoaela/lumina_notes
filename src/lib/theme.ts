export type ThemeMode = 'light' | 'dark';

/** First visit and any non-`dark` preference use light mode. */
export const DEFAULT_THEME: ThemeMode = 'light';

const KEY = 'lumina_theme';

export function getStoredTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(KEY)?.trim();
    if (v === 'dark') return 'dark';
  } catch {
    /* ignore */
  }
  return DEFAULT_THEME;
}

export function setStoredTheme(mode: ThemeMode): void {
  try {
    if (mode === 'dark') {
      localStorage.setItem(KEY, 'dark');
    } else {
      localStorage.removeItem(KEY);
    }
  } catch {
    /* ignore */
  }
}

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
  root.style.colorScheme = mode === 'dark' ? 'dark' : 'light';
}
