import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@/test/test-utils';
import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  it('renders the four user-role links (Dashboard, Transacciones, Cuentas, Insights)', () => {
    render(<Sidebar currentRole="user" activePath="/dashboard" />);
    expect(screen.getByRole('link', { name: 'Tablero' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Transacciones' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cuentas' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Insights' })).toBeInTheDocument();
  });

  it('renders the four user-role links plus admin links (Categorías, Usuarios) for admin', () => {
    render(<Sidebar currentRole="admin" activePath="/dashboard" />);
    expect(screen.getByRole('link', { name: 'Tablero' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Transacciones' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cuentas' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Insights' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Categorías' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Usuarios' })).toBeInTheDocument();
  });

  it.each([['user'], [null]] as const)('hides admin links for %s', (currentRole) => {
    render(<Sidebar currentRole={currentRole} activePath="/dashboard" />);
    expect(screen.queryByRole('link', { name: 'Categorías' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Usuarios' })).not.toBeInTheDocument();
  });

  it('marks the active link with the cobalt border', () => {
    render(<Sidebar currentRole="user" activePath="/transactions" />);
    expect(screen.getByRole('link', { name: 'Transacciones' })).toHaveClass('border-ink-cobalto');
  });

  it('navigates through the callback', () => {
    const onNavigate = vi.fn();
    render(<Sidebar currentRole="admin" activePath="/dashboard" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('link', { name: 'Usuarios' }));
    expect(onNavigate).toHaveBeenCalledWith('/admin/users');
  });

  it('uses semantic navigation element', () => {
    render(<Sidebar currentRole="user" activePath="/dashboard" />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});