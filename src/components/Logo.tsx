import React from 'react';
import {
  defaultLogo,
  logoColourNoOutline,
  logoBlackAndWhite,
} from '../assets';

const variants = {
  outline: defaultLogo,
  colour: logoColourNoOutline,
  mono: logoBlackAndWhite,
} as const;

export type LogoVariant = keyof typeof variants;

interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  variant?: LogoVariant;
}

/** Logo from `src/assets` — `outline` uses `defaultLogo`; use `mono` on dark backgrounds (e.g. purple header). */
export function Logo({
  variant = 'outline',
  className = 'h-8 w-auto',
  alt = 'Lumina Notes',
  ...rest
}: LogoProps) {
  return (
    <img
      src={variants[variant]}
      alt={alt}
      className={className}
      draggable={false}
      {...rest}
    />
  );
}
