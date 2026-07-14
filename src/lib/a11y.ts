export type A11yPrefs = {
  largeText: boolean;
  reduceMotion: boolean;
  underlineLinks: boolean;
};

const KEY = 'lumina_a11y';

export const DEFAULT_A11Y: A11yPrefs = {
  largeText: false,
  reduceMotion: false,
  underlineLinks: false,
};

export function getStoredA11y(): A11yPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_A11Y };
    const parsed = JSON.parse(raw) as Partial<A11yPrefs>;
    return {
      largeText: Boolean(parsed.largeText),
      reduceMotion: Boolean(parsed.reduceMotion),
      underlineLinks: Boolean(parsed.underlineLinks),
    };
  } catch {
    return { ...DEFAULT_A11Y };
  }
}

export function setStoredA11y(prefs: A11yPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function applyA11y(prefs: A11yPrefs): void {
  const root = document.documentElement;
  root.classList.toggle('a11y-lg', prefs.largeText);
  root.classList.toggle('reduce-motion', prefs.reduceMotion);
  root.classList.toggle('underline-links', prefs.underlineLinks);
}
