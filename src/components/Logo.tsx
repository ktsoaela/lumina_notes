import React, { useEffect, useState } from 'react';
import {
  defaultLogo,
  logoColourNoOutline,
  logoBlackAndWhite,
  logoWhite,
} from '../assets';
import { getStoredTheme, type ThemeMode } from '../lib/theme';

const variants = {
  outline: defaultLogo,
  colour: logoColourNoOutline,
  mono: logoBlackAndWhite,
  white: logoWhite,
} as const;

export type LogoVariant = keyof typeof variants;

interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  variant?: LogoVariant;
}

function readThemeMode(): ThemeMode {
  if (typeof document === 'undefined') return getStoredTheme();
  const root = document.documentElement;
  if (root.classList.contains('contrast')) return 'contrast';
  if (root.classList.contains('dark')) return 'dark';
  return 'light';
}

/**
 * Header mark: `book_black_and_white` in light mode, `book_white` in dark/contrast.
 * Follows Lumina's `.dark` / `.contrast` classes (not OS prefers-color-scheme).
 */
export function Logo({
  variant,
  className = 'h-8 w-auto',
  alt = 'Lumina Notes',
  ...rest
}: LogoProps) {
  const [mode, setMode] = useState<ThemeMode>(readThemeMode);

  useEffect(() => {
    const sync = () => setMode(readThemeMode());
    sync();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => obs.disconnect();
  }, []);

  const src = variant
    ? variants[variant]
    : mode === 'light'
      ? logoBlackAndWhite
      : logoWhite;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      draggable={false}
      {...rest}
    />
  );
}
