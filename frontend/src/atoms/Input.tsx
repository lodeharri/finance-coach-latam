/**
 * Input atom — Litografía del Sur.
 *
 * Controlled input. Pressed paper background, ink tinta text.
 * Atoms have no state, no API calls.
 */
import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'aria-invalid' | 'aria-describedby'> {
  invalid?: boolean;
  describedById?: string;
}

const BASE_CLASSES =
  'w-full h-10 px-3 rounded-sm bg-ink-paper-press text-ink-tinta font-body text-md ' +
  'border border-ink-paper-press ' +
  'transition-colors duration-fast ' +
  'placeholder:text-ink-tinta-mute ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto focus-visible:border-ink-cobalto ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'aria-[invalid=true]:border-ink-negativo aria-[invalid=true]:focus-visible:ring-ink-negativo';

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className = '', invalid, describedById, ...rest },
  ref,
) {
  const classes = `${BASE_CLASSES} ${className}`.trim();
  return (
    <input
      ref={ref}
      className={classes}
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={describedById}
      {...rest}
    />
  );
});
