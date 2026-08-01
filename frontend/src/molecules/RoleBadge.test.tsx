/**
 * RoleBadge test suite (RED phase).
 *
 * Validates the role -> variant mapping and aria-label.
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@/test/test-utils';
import { RoleBadge } from './RoleBadge';

describe('RoleBadge', () => {
  it('renders "Admin" for admin role with positivo variant', () => {
    // eslint-disable-next-line jsx-a11y/aria-role -- `role` is a regular prop, not an ARIA role
    render(<RoleBadge role="admin" />);
    const badge = screen.getByTestId('role-badge');
    expect(badge.textContent).toBe('Admin');
    const parent = badge.closest('span')?.parentElement as HTMLElement | null;
    expect(parent?.className ?? '').toMatch(/bg-ink-positivo/);
  });

  it('renders "User" for user role with alerta variant', () => {
    // eslint-disable-next-line jsx-a11y/aria-role -- `role` is a regular prop, not an ARIA role
    render(<RoleBadge role="user" />);
    const badge = screen.getByTestId('role-badge');
    expect(badge.textContent).toBe('User');
    const parent = badge.closest('span')?.parentElement as HTMLElement | null;
    expect(parent?.className ?? '').toMatch(/bg-ink-alerta/);
  });

  it('exposes an accessible name via aria-label', () => {
    // eslint-disable-next-line jsx-a11y/aria-role -- `role` is a regular prop, not an ARIA role
    render(<RoleBadge role="admin" />);
    expect(screen.getByLabelText(/Current role: Admin/)).toBeInTheDocument();
  });
});