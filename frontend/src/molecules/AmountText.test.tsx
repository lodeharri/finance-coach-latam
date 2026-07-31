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
});
