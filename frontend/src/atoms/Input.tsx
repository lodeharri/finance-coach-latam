/**
 * Input atom — Litografía del Sur.
 *
 * Two variants:
 * - "default" (legacy): pressed-paper background with rounded border.
 *   Used in tables and inline controls where the form is dense.
 * - "editorial": hairline-bottom-only, transparent background, mono caps label
 *   convention applied by FormField. This is the signature form treatment.
 *
 * Controlled input. Atoms have no state, no API.
 */
import { forwardRef } from 'react';
import type { InputHTMLAttributes } from 'react';

export type InputVariant = 'default' | 'editorial';

export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'aria-invalid'> {
  variant?: InputVariant;
  invalid?: boolean;
  /** Convenience prop for aria-describedby. Overridden by aria-describedby in rest. */
  describedById?: string;
}

const DEFAULT_CLASSES =
  'w-full h-10 px-3 rounded-sm bg-ink-paper-press text-ink-tinta font-body text-md ' +
  'border border-ink-paper-press ' +
  'transition-colors duration-fast ' +
  'placeholder:text-ink-tinta-mute ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto focus-visible:border-ink-cobalto ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'aria-[invalid=true]:border-ink-negativo aria-[invalid=true]:focus-visible:ring-ink-negativo';

const EDITORIAL_CLASSES =
  'w-full px-0 py-2 bg-transparent text-ink-tinta font-body text-lg ' +
  'border-0 border-b border-ink-tinta ' +
  'transition-colors duration-fast ' +
  'placeholder:text-ink-tinta-mute ' +
  'focus:outline-none focus:border-ink-cobalto-deep ' +
  'focus-visible:ring-0 ' +
  'disabled:opacity-50 disabled:cursor-not-allowed ' +
  'aria-[invalid=true]:border-ink-negativo aria-[invalid=true]:focus:border-ink-negativo';

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className = '',
    variant = 'default',
    invalid,
    describedById,
    'aria-describedby': ariaDescribedBy,
    ...rest
  },
  ref,
) {
  const base = variant === 'editorial' ? EDITORIAL_CLASSES : DEFAULT_CLASSES;
  const classes = `${base} ${className}`.trim();
  const effectiveDescribedBy = describedById ?? ariaDescribedBy;
  return (
    <input
      ref={ref}
      className={classes}
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={effectiveDescribedBy}
      data-variant={variant}
      {...rest}
    />
  );
});
