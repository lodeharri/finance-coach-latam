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
    render(<AuthShell title="Iniciar sesión"><p>X</p></AuthShell>);
    expect(screen.getByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();
  });

  it('renders the editorial plate: cobalt 4 px top rule + hairline border', () => {
    render(<AuthShell title="Iniciar sesión"><p>X</p></AuthShell>);
    const card = screen.getByTestId('auth-shell-card');
    expect(card.className).toMatch(/border-t-\[4px\]/);
    expect(card.className).toMatch(/border-t-ink-cobalto/);
    expect(card.className).toMatch(/border border-ink-paper-press/);
  });

  it('renders the kicker above the FINANZAS brand (signature: engraved plate)', () => {
    render(<AuthShell title="Iniciar sesión"><p>X</p></AuthShell>);
    const kicker = screen.getByTestId('auth-shell-kicker');
    expect(kicker.textContent).toBe('EDICIÓN DE OTOÑO · 2026');
    expect(kicker.className).toMatch(/font-mono/);
    expect(kicker.className).toMatch(/tracking-\[0\.3em\]/);
  });

  it('renders the asterism divider between the title block and the form', () => {
    render(<AuthShell title="Iniciar sesión"><p>X</p></AuthShell>);
    const asterism = screen.getByTestId('auth-shell-asterism');
    expect(asterism.textContent).toMatch(/\*\s*\*\s*\*/);
    expect(asterism.className).toMatch(/font-mono/);
    expect(asterism.className).toMatch(/tracking-\[0\.3em\]/);
  });
});
