/**
 * AuthShell template test suite (RED phase).
 *
 * Centered paper card on the warm-paper background. Hosts authentication forms
 * (LoginPage). No API calls in the template itself.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { AuthShell } from './AuthShell';

describe('AuthShell', () => {
  it('renders children centered on a paper card', () => {
    render(
      <AuthShell>
        <p data-testid="child">Login form</p>
      </AuthShell>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('uses the warm-paper background (--ink-paper)', () => {
    render(
      <AuthShell>
        <p>X</p>
      </AuthShell>,
    );
    const shell = screen.getByTestId('auth-shell');
    expect(shell.className).toMatch(/bg-ink-paper/);
  });

  it('renders a centered card with the children', () => {
    render(
      <AuthShell>
        <p data-testid="child">Login form</p>
      </AuthShell>,
    );
    const card = screen.getByTestId('auth-shell-card');
    expect(card).toBeInTheDocument();
    expect(card.className).toMatch(/max-w-md/);
  });

  it('renders the title when provided', () => {
    render(
      <AuthShell title="Sign in">
        <p>X</p>
      </AuthShell>,
    );
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });
});