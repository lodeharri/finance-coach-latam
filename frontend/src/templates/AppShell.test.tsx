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
    expect(screen.getByRole('link', { name: /categorías/i })).toBeInTheDocument();
  });

  it('renders the engraved folio strip in the masthead (signature element)', () => {
    renderShell('/transactions');
    const folio = screen.getByTestId('app-shell-folio');
    expect(folio.textContent).toMatch(/VOL\. III/);
    expect(folio.textContent).toMatch(/FOLIO/);
    expect(folio.className).toMatch(/font-mono/);
    expect(folio.className).toMatch(/tracking-\[0\.3em\]/);
  });

  it('changes the folio per route', () => {
    renderShell('/insights');
    expect(screen.getByTestId('app-shell-folio').textContent).toMatch(/FOLIO 07/);
  });

  it('the masthead has a 1 px hairline beneath it', () => {
    renderShell();
    expect(screen.getByTestId('app-shell-masthead')).toHaveClass('border-b');
  });

  it('the main area has asymmetric padding (pl-12 pr-20 on md+)', () => {
    renderShell();
    expect(screen.getByTestId('app-shell-main').className).toMatch(/px-12/);
    expect(screen.getByTestId('app-shell-main').className).toMatch(/md:pr-20/);
  });
});
