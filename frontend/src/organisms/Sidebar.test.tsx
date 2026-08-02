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

  // Mobile drawer (REQ-FF-MOBILE-SIDEBAR)
  describe('mobile drawer', () => {
    it('does NOT render a drawer when mobileOpen is false', () => {
      render(
        <Sidebar
          currentRole="user"
          activePath="/dashboard"
          mobileOpen={false}
          onMobileClose={vi.fn()}
        />,
      );
      expect(screen.queryByTestId('mobile-sidebar-drawer')).not.toBeInTheDocument();
    });

    it('renders a drawer with the same nav links when mobileOpen is true', () => {
      render(
        <Sidebar
          currentRole="admin"
          activePath="/dashboard"
          mobileOpen
          onMobileClose={vi.fn()}
        />,
      );
      const drawer = screen.getByTestId('mobile-sidebar-drawer');
      expect(drawer).toBeInTheDocument();
      // All four user links + both admin links are present inside the drawer.
      expect(within(drawer).getByRole('link', { name: /tablero/i })).toBeInTheDocument();
      expect(within(drawer).getByRole('link', { name: /transacciones/i })).toBeInTheDocument();
      expect(within(drawer).getByRole('link', { name: /categorías/i })).toBeInTheDocument();
      expect(within(drawer).getByRole('link', { name: /usuarios/i })).toBeInTheDocument();
    });

    it('clicking the drawer backdrop calls onMobileClose', () => {
      const onMobileClose = vi.fn();
      render(
        <Sidebar
          currentRole="user"
          activePath="/dashboard"
          mobileOpen
          onMobileClose={onMobileClose}
        />,
      );
      fireEvent.click(screen.getByTestId('mobile-sidebar-backdrop'));
      expect(onMobileClose).toHaveBeenCalledTimes(1);
    });

    it('pressing Escape calls onMobileClose while the drawer is open', () => {
      const onMobileClose = vi.fn();
      render(
        <Sidebar
          currentRole="user"
          activePath="/dashboard"
          mobileOpen
          onMobileClose={onMobileClose}
        />,
      );
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onMobileClose).toHaveBeenCalledTimes(1);
    });

    it('clicking a nav link inside the drawer calls onNavigate AND onMobileClose', () => {
      const onNavigate = vi.fn();
      const onMobileClose = vi.fn();
      render(
        <Sidebar
          currentRole="admin"
          activePath="/dashboard"
          mobileOpen
          onMobileClose={onMobileClose}
          onNavigate={onNavigate}
        />,
      );
      const drawer = screen.getByTestId('mobile-sidebar-drawer');
      fireEvent.click(within(drawer).getByRole('link', { name: /transacciones/i }));
      expect(onNavigate).toHaveBeenCalledWith('/transactions');
      expect(onMobileClose).toHaveBeenCalledTimes(1);
    });
  });
});

function within(container: HTMLElement) {
  return {
    getByRole: (role: 'link' | 'button', options?: { name?: RegExp }) => {
      const all = screen.getAllByRole(role, options);
      const inContainer = all.find((el) => container.contains(el));
      if (!inContainer) throw new Error(`No ${role} inside the container`);
      return inContainer;
    },
  };
}
