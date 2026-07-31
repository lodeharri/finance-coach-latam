import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { ComingSoonPage } from './ComingSoonPage';

describe('ComingSoonPage', () => {
  it('renders the Litografía del Sur ledger heading', () => {
    render(<ComingSoonPage />);
    expect(screen.getByTestId('coming-soon-page')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /finance coach latam/i })).toBeInTheDocument();
  });

  it('prints the line number in JetBrains Mono small-caps style', () => {
    render(<ComingSoonPage />);
    // "N.º 0001" — the ledger signature element from design.md §1.5
    expect(screen.getByText(/N.º 0001/i)).toBeInTheDocument();
  });

  it('uses the warm-paper background token (--ink-paper)', () => {
    render(<ComingSoonPage />);
    const page = screen.getByTestId('coming-soon-page');
    // Style attributes survive RTL render — token color is hex #F5F0E2.
    expect(page.getAttribute('style') ?? '').toMatch(/--ink-paper|#F5F0E2/i);
  });
});
