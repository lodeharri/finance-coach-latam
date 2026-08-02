/**
 * AmountText molecule — TDD test suite (RED phase).
 *
 * Accepts integer amountCents. Renders with tabular-nums + JetBrains Mono.
 * Optional signal color via --ink-positivo | --ink-negativo.
 * Molecules have no API calls.
 */
import { describe, expect, it } from 'vitest';
import { render } from '../test/test-utils';
import { AmountText } from './AmountText';

describe('AmountText', () => {
  it('renders a formatted amount string (default locale)', () => {
    const { container } = render(<AmountText amountCents={1234} />);
    // 1234 cents = 12.34 in es-CO (comma decimal). We accept either comma or dot
    // because the runtime locale may default to en-US in jsdom.
    expect(container.textContent).toMatch(/12[.,]34/);
  });

  it('renders negative values with a minus sign', () => {
    const { container } = render(<AmountText amountCents={-500} />);
    expect(container.textContent).toMatch(/-/);
    // Decimal style with no currency: -5.00 → "-5" after dropping the
    // hardcoded 2-decimal override (Intl auto-detects decimal style has
    // no fractional digits).
    expect(container.textContent).toMatch(/5/);
    expect(container.textContent).not.toMatch(/[.,]\d/);
  });

  it('renders zero as 0 (decimal style with no fractional digits)', () => {
    const { container } = render(<AmountText amountCents={0} />);
    // es-CO plain-number formatting: zero renders without decimals
    // (`Intl.NumberFormat('es-CO', { style: 'decimal' }).format(0) === '0'`).
    // No hardcoded minimumFractionDigits force anymore.
    expect(container.textContent).toMatch(/^0$/);
  });

  it('uses JetBrains Mono via font-mono + tabular class', () => {
    const { container } = render(<AmountText amountCents={100} />);
    const span = container.querySelector('span');
    expect(span).not.toBeNull();
    const cls = span!.className;
    expect(cls).toMatch(/font-mono/);
    expect(cls).toMatch(/tabular-nums/);
  });

  it('applies ink-positivo color when signal="positivo"', () => {
    const { container } = render(<AmountText amountCents={100} signal="positivo" />);
    expect(container.querySelector('span')!.className).toMatch(/text-ink-positivo/);
  });

  it('applies ink-negativo color when signal="negativo"', () => {
    const { container } = render(<AmountText amountCents={100} signal="negativo" />);
    expect(container.querySelector('span')!.className).toMatch(/text-ink-negativo/);
  });

  it('defaults to ink-tinta color when no signal is set', () => {
    const { container } = render(<AmountText amountCents={100} />);
    expect(container.querySelector('span')!.className).toMatch(/text-ink-tinta/);
  });

  // Safety belt: a missing or non-numeric amountCents must not render "$NaN".
  // Even though zod normalizes amount → amountCents, future partial-parse
  // failures or raw 5xx payloads could leave amountCents undefined/null/NaN.
  // Pinned so AmountText degrades to an em-dash with the mute ink color.
  it('renders em-dash when amountCents is undefined', () => {
    const { container } = render(
      <AmountText amountCents={undefined as unknown as number} />,
    );
    const span = container.querySelector('span')!;
    expect(span.textContent).toBe('—');
    expect(span.className).toMatch(/text-ink-tinta-mute/);
  });

  it('renders em-dash when amountCents is null', () => {
    const { container } = render(
      <AmountText amountCents={null as unknown as number} />,
    );
    const span = container.querySelector('span')!;
    expect(span.textContent).toBe('—');
    expect(span.className).toMatch(/text-ink-tinta-mute/);
  });

  it('renders em-dash when amountCents is NaN', () => {
    const { container } = render(<AmountText amountCents={NaN} />);
    const span = container.querySelector('span')!;
    expect(span.textContent).toBe('—');
    expect(span.className).toMatch(/text-ink-tinta-mute/);
  });

  it('renders COP currency without decimals (Colombia does not use centavos in practice)', () => {
    const { container } = render(<AmountText amountCents={0} currency="COP" />);
    const span = container.querySelector('span')!;
    expect(span.textContent).not.toBe('—');
    // COP is a zero-decimal currency for this app's UX. Modern ICU defaults
    // COP to 2 decimals; we override to match the Colombian convention
    // (e.g. "$ 0" and "$ 12.000" instead of "$ 0,00" and "$ 12.000,00").
    expect(span.textContent).not.toMatch(/[.,]00/);
    expect(span.textContent).toMatch(/0/);
    expect(span.className).not.toMatch(/text-ink-tinta-mute/);
  });

  it('renders ARS currency with 2 decimals (Intl auto-detects: ARS uses centavos)', () => {
    const { container } = render(<AmountText amountCents={1234} currency="ARS" />);
    const span = container.querySelector('span')!;
    expect(span.textContent).toMatch(/12[.,]34/);
  });

  it('renders USD currency with 2 decimals (Intl auto-detects)', () => {
    const { container } = render(<AmountText amountCents={1234} currency="USD" />);
    const span = container.querySelector('span')!;
    expect(span.textContent).toMatch(/12[.,]34/);
  });

  it('renders COP 1200000 cents (12.000 pesos) as "$ 12.000" — no decimal separator (regression for Issue 2)', () => {
    // This is the exact user-visible bug: with the old hardcoded 2-decimal
    // override, AmountText rendered COP 1,200,000 cents (the value the
    // form stores after Issue 3's ×100 conversion from the user typing
    // "12000") as "$ 12.000,00". User expected "$ 12.000" because Colombia
    // does not use centavos in practice.
    const { container } = render(<AmountText amountCents={1200000} currency="COP" />);
    const span = container.querySelector('span')!;
    // Must contain "12.000" (thousands separator) and NOT contain any decimal
    // separator like ",00" or ".00".
    expect(span.textContent).toMatch(/12\.000/);
    expect(span.textContent).not.toMatch(/12\.000[.,]00/);
  });

  it('renders COP 1234 cents as "$ 12" without decimals (small amounts)', () => {
    // 1234 cents → 12.34 pesos in major units. Without decimals: "12".
    const { container } = render(<AmountText amountCents={1234} currency="COP" />);
    const span = container.querySelector('span')!;
    expect(span.textContent).not.toMatch(/[.,]\d/);
  });

  it('still exposes data-amount-cents (empty string) when guarded, so test selectors stay stable', () => {
    const { container } = render(
      <AmountText amountCents={undefined as unknown as number} />,
    );
    const span = container.querySelector('span')!;
    expect(span.getAttribute('data-amount-cents')).toBe('');
  });
});
