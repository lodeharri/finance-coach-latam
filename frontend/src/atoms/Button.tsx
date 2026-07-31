/**
 * Button atom — Litografía del Sur.
 *
 * Variants: primary (cobalt) | secondary (paper-press) | destructive (negativo).
 * Sizes: sm | md | lg. Cobalt focus ring.
 * Atoms have no state, no API calls.
 */
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-ink-cobalto text-ink-paper hover:bg-ink-cobalto-deep active:bg-ink-cobalto-deep',
  secondary:
    'bg-ink-paper-press text-ink-tinta hover:bg-ink-paper-lift active:bg-ink-paper-press',
  destructive:
    'bg-ink-negativo text-ink-paper hover:opacity-90 active:opacity-80',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-md',
  lg: 'h-12 px-6 text-lg',
};

const BASE_CLASSES =
  'inline-flex items-center justify-center gap-2 rounded font-body font-medium ' +
  'transition-[background-color,opacity] duration-fast ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto focus-visible:ring-offset-2 focus-visible:ring-offset-ink-paper ' +
  'disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none';

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className = '', type = 'button', ...rest },
  ref,
) {
  const classes = `${BASE_CLASSES} ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`.trim();
  return <button ref={ref} type={type} className={classes} {...rest} />;
});
