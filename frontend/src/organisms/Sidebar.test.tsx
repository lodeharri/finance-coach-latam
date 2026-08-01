import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@/test/test-utils';
import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  it('renders the four user-role links (Dashboard, Transacciones, Cuentas, Insights)', () => {
    render(<Sidebar currentRole="user" activePath="/dashboard" />);
    expect(screen.getByRole('link', { name: /tablero/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /transacciones/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /cuentas/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /insights/i })).toBeInTheDocument();
  });

  it('renders the four user-role links plus admin links (Categorías, Usuarios) for admin', () => {
    render(<Sidebar currentRole="admin" activePath="/dashboard" />);
    expect(screen.getByRole('link', { name: /tablero/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /transacciones/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /cuentas/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /insights/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /categorías/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /usuarios/i })).toBeInTheDocument();
  });

  it.each([['user'], [null]] as const)('hides admin links for %s', (currentRole) => {
    render(<Sidebar currentRole={currentRole} activePath="/dashboard" />);
    expect(screen.queryByRole('link', { name: /categorías/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /usuarios/i })).not.toBeInTheDocument();
  });

  it('marks the active link with the cobalt border', () => {
    render(<Sidebar currentRole="user" activePath="/transactions" />);
    expect(screen.getByRole('link', { name: /transacciones/i })).toHaveClass('border-ink-cobalto');
  });

  it('renders ledger line numbers (01, 02, …) before each link (signature)', () => {
    render(<Sidebar currentRole="user" activePath="/dashboard" />);
    // Each link now has a mono prefix like "01." "02." etc.
    expect(screen.getByTestId('sidebar-link-/dashboard').textContent).toMatch(/01\./);
    expect(screen.getByTestId('sidebar-link-/transactions').textContent).toMatch(/02\./);
    expect(screen.getByTestId('sidebar-link-/accounts').textContent).toMatch(/03\./);
    expect(screen.getByTestId('sidebar-link-/insights').textContent).toMatch(/04\./);
  });

  it('renders the sidebar masthead with HexStamp + volume tag', () => {
    render(<Sidebar currentRole="user" activePath="/dashboard" />);
    expect(screen.getByTestId('sidebar-masthead')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-volume').textContent).toMatch(/VOL\. III/);
  });

  it('navigates through the callback', () => {
    const onNavigate = vi.fn();
    render(<Sidebar currentRole="admin" activePath="/dashboard" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('link', { name: /usuarios/i }));
    expect(onNavigate).toHaveBeenCalledWith('/admin/users');
  });

  it('uses semantic navigation element', () => {
    render(<Sidebar currentRole="user" activePath="/dashboard" />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
