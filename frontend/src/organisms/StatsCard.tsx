/**
 * StatsCard organism — Litografía del Sur.
 *
 * Paper card. The signature element of DashboardPage is THE BIG NUMBER:
 * Bricolage Grotesque 700 at 64px, with a small uppercase label above and
 * a delta line below (signal ink color). Named signal inks for PENDING
 * /FAILED deltas — never the brand cobalt.
 */
import type { ReactNode } from 'react';
import { AmountText } from '@/molecules/AmountText';

export type StatsCardVariant = 'hero' | 'compact';

export interface StatsCardProps {
  /** Uppercase mono label above the number. */
  label: string;
  /** Big number — for variant='hero' this is the 64px display number. */
  amountCents?: number | undefined;
  /** Optional alternative content (already formatted) for non-currency stats. */
  children?: ReactNode;
  /** Optional delta line below the number — e.g. PENDING count. */
  delta?: { label: string; tone: 'positivo' | 'negativo' | 'fallo' | 'alerta' | 'neutral' } | undefined;
  /** Hero = big number, 64px Bricolage. Compact = regular size for grid cards. */
  variant?: StatsCardVariant;
  /** Accessible name override for screen readers. */
  ariaLabel?: string;
}

const VARIANT_CLASSES: Record<StatsCardVariant, string> = {
  hero: 'col-span-12 md:col-span-6 p-8',
  compact: 'col-span-12 md:col-span-2 p-5',
};

const DELTA_CLASSES: Record<NonNullable<StatsCardProps['delta']>['tone'], string> = {
  positivo: 'text-ink-positivo',
  negativo: 'text-ink-negativo',
  fallo: 'text-ink-fallo',
  alerta: 'text-ink-alerta',
  neutral: 'text-ink-tinta-mute',
};

export function StatsCard({
  label,
  amountCents,
  children,
  delta,
  variant = 'compact',
  ariaLabel,
}: StatsCardProps) {
  const isHero = variant === 'hero';
  return (
    <article
      data-testid="stats-card"
      aria-label={ariaLabel ?? label}
      className={`rounded-sm border border-ink-paper-press bg-ink-paper-lift ${VARIANT_CLASSES[variant]}`}
    >
      <span className="block font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-mute">
        {label}
      </span>
      {isHero && amountCents !== undefined ? (
        <span
          className="mt-2 block font-display text-[64px] font-bold leading-none text-ink-tinta"
          data-testid="stats-card-hero-number"
        >
          <AmountText amountCents={amountCents} currency="ARS" />
        </span>
      ) : amountCents !== undefined ? (
        <span className="mt-2 block font-display text-3xl font-bold text-ink-tinta">
          <AmountText amountCents={amountCents} currency="ARS" />
        </span>
      ) : (
        <span className="mt-2 block font-display text-3xl font-bold text-ink-tinta">{children}</span>
      )}
      {delta ? (
        <span className={`mt-3 block font-body text-sm ${DELTA_CLASSES[delta.tone]}`}>{delta.label}</span>
      ) : null}
    </article>
  );
}