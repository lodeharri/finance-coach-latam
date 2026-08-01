/**
 * Label atom — Litografía del Sur.
 *
 * Two variants:
 * - "default" (legacy): body-text label for the legacy default Input.
 * - "editorial": mono caps tracking-2em label that sits above the editorial
 *   hairline-bottom input. This is the signature form treatment.
 *
 * Atoms have no state, no API calls.
 */
import type { LabelHTMLAttributes } from 'react';

export type LabelVariant = 'default' | 'editorial';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  variant?: LabelVariant;
}

const VARIANT_CLASSES: Record<LabelVariant, string> = {
  default: 'block font-body text-sm font-medium text-ink-tinta-soft',
  editorial: 'block font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-soft',
};

export function Label({
  required = false,
  variant = 'default',
  children,
  className = '',
  ...rest
}: LabelProps) {
  const classes = `${VARIANT_CLASSES[variant]} ${className}`.trim();
  return (
    <label className={classes} {...rest}>
      {children}
      {required ? <span aria-hidden="true" className="text-ink-negativo ml-1">*</span> : null}
    </label>
  );
}
