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
    // 1234 cents = 12.34 in es-AR (comma decimal). We accept either comma or dot
    // because the runtime locale may default to en-US in jsdom.
    expect(container.textContent).toMatch(/12[.,]34/);
  });

  it('renders negative values with a minus sign', () => {
    const { container } = render(<AmountText amountCents={-500} />);
    expect(container.textContent).toMatch(/-/);
    expect(container.textContent).toMatch(/5[.,]00/);
  });

  it('renders zero as 0.00', () => {
    const { container } = render(<AmountText amountCents={0} />);
    expect(container.textContent).toMatch(/0[.,]00/);
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

  it('still renders formatted currency when amountCents is 0 (zero is valid)', () => {
    const { container } = render(<AmountText amountCents={0} currency="ARS" />);
    const span = container.querySelector('span')!;
    expect(span.textContent).not.toBe('—');
    // Currency-formatted zero is still "0,00" / "0.00" — but never the em-dash
    // guard sentinel.
    expect(span.textContent).toMatch(/0[.,]00/);
    expect(span.className).not.toMatch(/text-ink-tinta-mute/);
  });

  it('still exposes data-amount-cents (empty string) when guarded, so test selectors stay stable', () => {
    const { container } = render(
      <AmountText amountCents={undefined as unknown as number} />,
    );
    const span = container.querySelector('span')!;
    expect(span.getAttribute('data-amount-cents')).toBe('');
  });
});
