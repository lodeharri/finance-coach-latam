/**
 * Label atom — Litografía del Sur.
 *
 * Uses htmlFor to associate with a control. Optional required indicator.
 * Atoms have no state, no API calls.
 */
import type { LabelHTMLAttributes } from 'react';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
}

export function Label({ required = false, children, className = '', ...rest }: LabelProps) {
  const classes = `block font-body text-sm font-medium text-ink-tinta-soft ${className}`.trim();
  return (
    <label className={classes} {...rest}>
      {children}
      {required ? <span aria-hidden="true" className="text-ink-negativo ml-1">*</span> : null}
    </label>
  );
}
