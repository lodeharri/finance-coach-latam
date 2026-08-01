/**
 * StatsCard organism — Litografía del Sur.
 *
 * Editorial treatment:
 * - Hero variant: text-4xl (104 px) display number (was text-[64px] / 3xl=64).
 * - Cobalt 4 px left rule on hero (signature: cobalt strip accent on cards).
 * - Compact variant: 4 px cobalt left rule (border-l-4 border-ink-cobalto).
 * - Mono kicker `N.º 02 · TOP CATEGORY` ordinal on compact (signature).
 * - Paper-grain background overlay on hero.
 * - Named signal inks for PENDING / FAILED deltas — never the brand cobalt.
 */
import type { ReactNode } from 'react';
import { AmountText } from '@/molecules/AmountText';

export type StatsCardVariant = 'hero' | 'compact';

export interface StatsCardProps {
  /** Uppercase mono label above the number. */
  label: string;
  /** Big number — for variant='hero' this is the 104 px display number. */
  amountCents?: number | undefined;
  /** Optional alternative content (already formatted) for non-currency stats. */
  children?: ReactNode;
  /** Optional delta line below the number — e.g. PENDING count. */
  delta?: { label: string; tone: 'positivo' | 'negativo' | 'fallo' | 'alerta' | 'neutral' } | undefined;
  /** Hero = big number, 104 px Bricolage. Compact = regular size for grid cards. */
  variant?: StatsCardVariant;
  /** Optional mono ordinal like 'N.º 02'. Compact variant uses it as a kicker. */
  ordinal?: string;
  /** Accessible name override for screen readers. */
  ariaLabel?: string;
}

const VARIANT_CLASSES: Record<StatsCardVariant, string> = {
  hero: 'col-span-12 md:col-span-6 p-10 border-l-4 border-ink-cobalto',
  compact: 'col-span-12 md:col-span-2 p-5 border-l-4 border-ink-cobalto',
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
  ordinal,
  ariaLabel,
}: StatsCardProps) {
  const isHero = variant === 'hero';
  return (
    <article
      data-testid="stats-card"
      data-variant={variant}
      aria-label={ariaLabel ?? label}
      className={`relative overflow-hidden rounded-sm border border-ink-paper-press bg-ink-paper-lift ${VARIANT_CLASSES[variant]}`}
      style={
        isHero
          ? {
              backgroundImage:
                'radial-gradient(circle at 1px 1px, var(--ink-paper-grain) 1px, transparent 0)',
              backgroundSize: '8px 8px',
            }
          : undefined
      }
    >
      <header className="flex items-baseline justify-between gap-3">
        <span className="block font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-mute">
          {label}
        </span>
        {ordinal ? (
          <span
            data-testid="stats-card-ordinal"
            className="block font-mono text-[10px] uppercase tracking-[0.2em] text-ink-cobalto"
          >
            {ordinal}
          </span>
        ) : null}
      </header>
      {isHero && amountCents !== undefined ? (
        <span
          className="mt-3 block font-display text-4xl font-bold leading-none tracking-tight text-ink-tinta"
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
        <span
          className={`mt-3 block font-body text-sm ${DELTA_CLASSES[delta.tone]}`}
          data-testid="stats-card-delta"
        >
          {delta.label}
        </span>
      ) : null}
    </article>
  );
}
