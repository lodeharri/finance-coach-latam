/**
 * AmountText molecule — Litografía del Sur.
 *
 * Renders integer amountCents as a localized currency string in JetBrains Mono
 * with tabular-nums. Optional signal color via --ink-positivo | --ink-negativo.
 * Molecules have no API calls (REQ-FF-ATOMS-BOUNDARY).
 */
export type AmountSignal = 'positivo' | 'negativo' | undefined;

export interface AmountTextProps {
  amountCents: number;
  currency?: string;
  /** Use 'es-AR' by default — primary LATAM audience. */
  locale?: string;
  signal?: AmountSignal;
}

const SIGNAL_CLASSES: Record<Exclude<AmountSignal, undefined>, string> = {
  positivo: 'text-ink-positivo',
  negativo: 'text-ink-negativo',
};

export function AmountText({
  amountCents,
  currency,
  locale = 'es-AR',
  signal,
}: AmountTextProps) {
  const formatter = new Intl.NumberFormat(locale, {
    style: currency ? 'currency' : 'decimal',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const formatted = formatter.format(amountCents / 100);
  const colorClass = signal ? SIGNAL_CLASSES[signal] : 'text-ink-tinta';
  return (
    <span
      className={`font-mono tabular-nums ${colorClass}`}
      data-amount-cents={amountCents}
    >
      {formatted}
    </span>
  );
}
