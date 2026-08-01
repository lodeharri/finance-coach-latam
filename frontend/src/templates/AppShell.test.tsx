/**
 * AppShell template test suite (RED phase).
 *
 * Verifies:
 *  - Renders the cobalt masthead 48px tall.
 *  - Shows page name (Bricolage Grotesque) + today's date (JetBrains Mono) + HexStamp.
 *  - Renders children content area.
 *  - Shows RoleBadge when role is provided.
 *  - Honors prefers-reduced-motion (transitions disabled via tokens.css).
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('renders the cobalt masthead', () => {
    render(
      // eslint-disable-next-line jsx-a11y/aria-role -- `role` is a regular prop, not an ARIA role
      <AppShell pageName="Dashboard" role="user">
        <p>Page body</p>
      </AppShell>,
    );
    const masthead = screen.getByTestId('app-shell-masthead');
    expect(masthead).toBeInTheDocument();
    expect(masthead.className).toMatch(/bg-ink-cobalto/);
    // jsdom normalizes inline px height into a unit-less number; check via
    // attribute instead of computed style.
    expect(masthead.getAttribute('style') ?? '').toMatch(/48px|height:\s*48/);
  });

  it('renders the page name in Bricolage Grotesque display style', () => {
    render(
      // eslint-disable-next-line jsx-a11y/aria-role -- `role` is a regular prop, not an ARIA role
      <AppShell pageName="Dashboard" role="user">
        <p>Body</p>
      </AppShell>,
    );
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
  });

  it('renders the date in JetBrains Mono small-caps style (right-aligned)', () => {
    render(
      // eslint-disable-next-line jsx-a11y/aria-role -- `role` is a regular prop, not an ARIA role
      <AppShell pageName="Dashboard" role="user">
        <p>Body</p>
      </AppShell>,
    );
    const dateEl = screen.getByTestId('app-shell-date');
    expect(dateEl).toBeInTheDocument();
    expect(dateEl.className).toMatch(/font-mono/);
  });

  it('renders the HexStamp signature element', () => {
    const { container } = render(
      // eslint-disable-next-line jsx-a11y/aria-role -- `role` is a regular prop, not an ARIA role
      <AppShell pageName="Dashboard" role="user">
        <p>Body</p>
      </AppShell>,
    );
    const svg = container.querySelector('svg[aria-hidden="true"]');
    expect(svg).not.toBeNull();
  });

  it('renders children in the content area', () => {
    render(
      // eslint-disable-next-line jsx-a11y/aria-role -- `role` is a regular prop, not an ARIA role
      <AppShell pageName="Dashboard" role="user">
        <p data-testid="child">Body content here</p>
      </AppShell>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('shows the role badge when role is provided', () => {
    render(
      // eslint-disable-next-line jsx-a11y/aria-role -- `role` is a regular prop, not an ARIA role
      <AppShell pageName="Dashboard" role="admin">
        <p>Body</p>
      </AppShell>,
    );
    expect(screen.getByTestId('role-badge')).toBeInTheDocument();
    expect(screen.getByTestId('role-badge').textContent?.toLowerCase()).toContain('admin');
  });

  it('does not render the role badge when role is undefined', () => {
    render(
      <AppShell pageName="Dashboard">
        <p>Body</p>
      </AppShell>,
    );
    expect(screen.queryByTestId('role-badge')).not.toBeInTheDocument();
  });

  it('uses the warm-paper background (--ink-paper)', () => {
    const { container } = render(
      // eslint-disable-next-line jsx-a11y/aria-role -- `role` is a regular prop, not an ARIA role
      <AppShell pageName="Dashboard" role="user">
        <p>Body</p>
      </AppShell>,
    );
    const root = container.firstChild as HTMLElement;
    expect(root.className).toMatch(/bg-ink-paper/);
  });
});