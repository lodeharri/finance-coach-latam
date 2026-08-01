import { describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@/test/test-utils';
import { AppShell } from './AppShell';

function renderShell(path = '/dashboard', role: 'admin' | 'user' | undefined = 'user') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="*" element={<AppShell {...(role ? { role } : {})}><p>Body</p></AppShell>} /></Routes>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  it('renders header, sidebar, main, date and toast host', () => {
    renderShell();
    expect(screen.getByTestId('app-shell-masthead')).toHaveClass('bg-ink-cobalto');
    expect(screen.getByTestId('app-shell-sidebar')).toBeInTheDocument();
    expect(screen.getByTestId('app-shell-main')).toBeInTheDocument();
    expect(screen.getByTestId('app-shell-date')).toHaveClass('font-mono');
    expect(screen.getByTestId('app-shell-sidebar')).toBeInTheDocument();
  });

  it.each([['/dashboard', 'Tablero'], ['/admin/categories', 'Categorías']] as const)('derives page name for %s', (path, name) => {
    renderShell(path, 'admin');
    expect(screen.getByTestId('app-shell-page-name')).toHaveTextContent(name);
  });

  it('renders the role-aware sidebar', () => {
    renderShell('/dashboard', 'admin');
    expect(screen.getByRole('link', { name: 'Categorías' })).toBeInTheDocument();
  });
});
