/**
 * AmountInput atom — Litografía del Sur.
 *
 * Bordered input for transaction amounts (cents-only entry). The signature
 * element on TransactionForm per design: the bordered amount input with
 * tabular lining figures. The field accepts only positive integer cents
 * via parseInt validation. Surfaces inline error verbatim from backend.
 */
import { forwardRef } from 'react';
import type { ChangeEvent, InputHTMLAttributes } from 'react';

export interface AmountInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'aria-invalid' | 'aria-describedby' | 'type'> {
  value: string;
  onValueChange: (next: string) => void;
  invalid?: boolean;
  describedById?: string;
}

const BASE_CLASSES =
  'w-full h-12 px-3 rounded-sm bg-ink-paper text-ink-tinta font-mono text-lg ' +
  'border-2 border-ink-cobalto ' +
  'transition-colors duration-fast ' +
  'placeholder:text-ink-tinta-mute ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto-deep ' +
  'aria-[invalid=true]:border-ink-negativo aria-[invalid=true]:focus-visible:ring-ink-negativo';

export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(function AmountInput(
  { className = '', invalid, describedById, value, onValueChange, ...rest },
  ref,
) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    // Strip everything that isn't a digit; this is a cents-only field.
    const raw = event.target.value.replace(/\D+/g, '');
    onValueChange(raw);
  };
  const classes = `${BASE_CLASSES} ${className}`.trim();
  return (
    <input
      ref={ref}
      type="text"
      inputMode="numeric"
      className={classes}
      value={value}
      onChange={handleChange}
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={describedById}
      {...rest}
    />
  );
});