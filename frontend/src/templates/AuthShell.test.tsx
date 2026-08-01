import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { AuthShell } from './AuthShell';

describe('AuthShell', () => {
  it('renders children centered on a paper card', () => {
    render(<AuthShell><p data-testid="child">Login form</p></AuthShell>);
    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.getByTestId('auth-shell')).toHaveClass('bg-ink-paper');
    expect(screen.getByTestId('auth-shell-card')).toHaveClass('max-w-md');
  });

  it('renders the branded auth identity', () => {
    const { container } = render(<AuthShell><p>X</p></AuthShell>);
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByText('FINANZAS')).toBeInTheDocument();
    expect(screen.getByText('Asistente financiero personal')).toBeInTheDocument();
    expect(screen.getByText('Litografía del Sur · finance-coach-latam')).toBeInTheDocument();
  });

  it('renders the title when provided', () => {
    render(<AuthShell title="Sign in"><p>X</p></AuthShell>);
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });
});
