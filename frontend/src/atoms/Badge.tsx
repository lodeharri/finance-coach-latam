/**
 * Badge atom — Litografía del Sur.
 *
 * Status chip with named signal colors (never the brand cobalt).
 * The provided icon is force-cloned with aria-hidden="true" so screen readers
 * never announce decorative SVG. Atoms have no state, no API.
 */
import { Children, cloneElement, isValidElement } from 'react';
import type { ReactNode, ReactElement } from 'react';

export type BadgeVariant = 'positivo' | 'negativo' | 'fallo' | 'alerta' | 'neutral';

export interface BadgeProps {
  variant: BadgeVariant;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  positivo: 'bg-ink-positivo text-ink-paper',
  negativo: 'bg-ink-negativo text-ink-paper',
  fallo: 'bg-ink-fallo text-ink-paper',
  alerta: 'bg-ink-alerta text-ink-tinta',
  neutral: 'bg-ink-paper-press text-ink-tinta',
};

function makeIconAriaHidden(icon: ReactNode): ReactNode {
  return Children.map(icon, (child) => {
    if (isValidElement(child)) {
      const el = child as ReactElement<{ 'aria-hidden'?: string | boolean }>;
      return cloneElement(el, { 'aria-hidden': 'true' });
    }
    return child;
  });
}

export function Badge({ variant, icon, children, className = '' }: BadgeProps) {
  const classes =
    `inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 ` +
    `font-mono text-xs uppercase tracking-wide ` +
    `${VARIANT_CLASSES[variant]} ${className}`.trim();
  return (
    <span className={classes}>
      {icon ? <span className="inline-flex">{makeIconAriaHidden(icon)}</span> : null}
      {children}
    </span>
  );
}
