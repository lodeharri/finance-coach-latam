import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@/test/test-utils';
import { Sidebar } from './Sidebar';

describe('Sidebar', () => {
  it('renders both links for an admin', () => {
    render(<Sidebar currentRole="admin" activePath="/dashboard" />);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Categorías' })).toBeInTheDocument();
  });

  it.each([['user'], [null]] as const)('hides admin links for %s', (currentRole) => {
    render(<Sidebar currentRole={currentRole} activePath="/dashboard" />);
    expect(screen.queryByRole('link', { name: 'Categorías' })).not.toBeInTheDocument();
  });

  it('marks the active link with the cobalt border', () => {
    render(<Sidebar currentRole="user" activePath="/dashboard" />);
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveClass('border-ink-cobalto');
  });

  it('navigates through the callback', () => {
    const onNavigate = vi.fn();
    render(<Sidebar currentRole="admin" activePath="/dashboard" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('link', { name: 'Categorías' }));
    expect(onNavigate).toHaveBeenCalledWith('/admin/categories');
  });

  it('uses semantic navigation and anchor elements', () => {
    render(<Sidebar currentRole="user" activePath="/dashboard" />);
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
