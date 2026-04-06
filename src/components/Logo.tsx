import React from 'react';
import logoOutline from '../assets/book_colour_outline.png';
import logoColour from '../assets/book_colour_no_outline.png';
import logoMono from '../assets/book_black_and_white.png';

const variants = {
  outline: logoOutline,
  colour: logoColour,
  mono: logoMono,
} as const;

export type LogoVariant = keyof typeof variants;

interface LogoProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  variant?: LogoVariant;
}

/** Logo from `src/assets` — use `mono` on dark backgrounds (e.g. purple header). */
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
