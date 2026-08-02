/**
 * AmountText molecule — Litografía del Sur.
 *
 * Renders integer amountCents as a localized currency string in JetBrains Mono
 * with tabular-nums. Optional signal color via --ink-positivo | --ink-negativo.
 *
 * Safety belt: if amountCents is missing (undefined / null / NaN), the
 * component renders an em-dash with the mute ink color instead of "$NaN".
 * This guards against partial zod parse failures or raw 5xx payloads
 * upstream — the row stays present, the cell just shows no number.
 * Molecules have no API calls (REQ-FF-ATOMS-BOUNDARY).
 */
export type AmountSignal = 'positivo' | 'negativo' | undefined;

export interface AmountTextProps {
  amountCents: number | undefined | null;
  currency?: string;
  /** Use 'es-CO' by default — primary LATAM audience. */
  locale?: string;
  signal?: AmountSignal;
}

const SIGNAL_CLASSES: Record<Exclude<AmountSignal, undefined>, string> = {
  positivo: 'text-ink-positivo',
  negativo: 'text-ink-negativo',
};

/**
 * Currencies that should render with zero fractional digits in this app's
 * editorial UX. Modern ICU/Intl auto-detects COP as 2-decimal because
 * Colombia technically has a centavo subunit, but in practice retailers
 * and the user-facing form never use it — the Litografía del Sur treatment
 * expects "$ 12.000" not "$ 12.000,00" for COP. Same convention for CLP
 * (Chilean peso), JPY, UYI, and the rest of the ISO 4217 zero-decimal set.
 */
const ZERO_DECIMAL_CURRENCIES = new Set<string>([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'ISK',
  'JPY',
  'KMF',
  'KRW',
  'PYG',
  'RWF',
  'UGX',
  'UYI',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
  'COP',
]);

function isMissingAmount(value: number | undefined | null): boolean {
  return value === undefined || value === null || Number.isNaN(value);
}

function asValidCents(value: number | undefined | null): number {
  // Caller already routed missing/NaN to the em-dash branch; here we trust
  // the value is a finite number. The non-null assertion is the explicit
  // type-system acknowledgment of that contract.
  if (isMissingAmount(value)) {
    throw new Error('AmountText.asValidCents called with a missing value');
  }
  return value as number;
}

export function AmountText({
  amountCents,
  currency,
  locale = 'es-CO',
  signal,
}: AmountTextProps) {
  if (isMissingAmount(amountCents)) {
    return (
      <span
        className="font-mono tabular-nums text-ink-tinta-mute"
        data-amount-cents=""
      >
        —
      </span>
    );
  }
  const valid = asValidCents(amountCents);
  const useZeroDecimals = Boolean(currency) && ZERO_DECIMAL_CURRENCIES.has(currency!);
  const formatter = new Intl.NumberFormat(locale, {
    style: currency ? 'currency' : 'decimal',
    currency,
    ...(useZeroDecimals
      ? { minimumFractionDigits: 0, maximumFractionDigits: 0 }
      : {}),
  });
  const formatted = formatter.format(valid / 100);
  const colorClass = signal ? SIGNAL_CLASSES[signal] : 'text-ink-tinta';
  return (
    <span
      className={`font-mono tabular-nums ${colorClass}`}
      data-amount-cents={valid}
    >
      {formatted}
    </span>
  );
}
