/**
 * StatsCard organism tests (REQ-FFC-DASH-STATS, frontend-design §signature: big number).
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { StatsCard } from './StatsCard';

describe('StatsCard', () => {
  it('renders the label and amount in a compact variant', () => {
    render(<StatsCard label="Top category" amountCents={420000} variant="compact" />);
    expect(screen.getByText('Top category')).toBeInTheDocument();
    expect(screen.getByText(/4\.200/)).toBeInTheDocument();
  });

  it('renders the hero big number with the display font treatment', () => {
    render(<StatsCard label="MTD spend" amountCents={420000} variant="hero" ariaLabel="Month-to-date spend" />);
    const number = screen.getByTestId('stats-card-hero-number');
    expect(number).toBeInTheDocument();
    expect(number.className).toContain('font-display');
    expect(number.className).toContain('text-4xl');
    expect(number.className).toContain('font-bold');
  });

  it('renders the compact variant with the cobalt left strip signature', () => {
    render(<StatsCard label="Pending" amountCents={0} />);
    const card = screen.getByTestId('stats-card');
    expect(card.className).toContain('border-l-4');
    expect(card.className).toContain('border-ink-cobalto');
  });

  it('renders an ordinal kicker when the ordinal prop is provided', () => {
    render(<StatsCard label="Top category" amountCents={420000} variant="compact" ordinal="N.º 02" />);
    const ordinal = screen.getByTestId('stats-card-ordinal');
    expect(ordinal.textContent).toBe('N.º 02');
    expect(ordinal.className).toMatch(/font-mono/);
  });

  it('renders an accessible name from aria-label', () => {
    render(<StatsCard label="MTD" amountCents={100} ariaLabel="Month to date" />);
    expect(screen.getByRole('article', { name: /month to date/i })).toBeInTheDocument();
  });

  it('renders a delta line with named signal ink color', () => {
    render(
      <StatsCard
        label="Pending"
        amountCents={0}
        delta={{ label: '2 transactions pending', tone: 'alerta' }}
      />,
    );
    const delta = screen.getByText('2 transactions pending');
    expect(delta.className).toContain('text-ink-alerta');
  });

  it('renders non-currency content via children when amountCents is undefined', () => {
    render(<StatsCard label="PENDING"><span>3</span></StatsCard>);
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});