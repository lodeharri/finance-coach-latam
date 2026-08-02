/**
 * AppShell tests — Litografía del Sur.
 *
 * Mobile sidebar (REQ-FF-MOBILE-SIDEBAR): a hamburger button in the masthead
 * opens the Sidebar as a slide-over drawer on small viewports. The button is
 * only visible below the md breakpoint (`md:hidden` per Tailwind).
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@/test/test-utils';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './AppShell';

function renderShell(path = '/dashboard', role: 'admin' | 'user' | undefined = 'user') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="*" element={<AppShell {...(role ? { role } : {})}><p>Body</p></AppShell>} /></Routes>
    </MemoryRouter>,
  );
}

describe('AppShell mobile sidebar', () => {
  it('renders a hamburger button in the masthead', () => {
    renderShell();
    expect(screen.getByTestId('mobile-sidebar-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('mobile-sidebar-toggle')).toHaveAttribute(
      'aria-label',
      expect.stringMatching(/abrir menú/i),
    );
  });

  it('the hamburger button has the md:hidden utility so it is desktop-hidden by CSS', () => {
    renderShell();
    const btn = screen.getByTestId('mobile-sidebar-toggle');
    expect(btn.className).toMatch(/md:hidden/);
  });

  it('clicking the hamburger opens the mobile drawer', () => {
    renderShell('/dashboard', 'user');
    fireEvent.click(screen.getByTestId('mobile-sidebar-toggle'));
    expect(screen.getByTestId('mobile-sidebar-drawer')).toBeInTheDocument();
  });

  it('clicking the hamburger again closes the drawer (toggle)', () => {
    renderShell('/dashboard', 'user');
    const toggle = screen.getByTestId('mobile-sidebar-toggle');
    fireEvent.click(toggle);
    expect(screen.getByTestId('mobile-sidebar-drawer')).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(screen.queryByTestId('mobile-sidebar-drawer')).not.toBeInTheDocument();
  });

  it('navigating (drawer link click) closes the drawer', () => {
    renderShell('/dashboard', 'admin');
    fireEvent.click(screen.getByTestId('mobile-sidebar-toggle'));
    fireEvent.click(
      withinDrawer(screen.getByTestId('mobile-sidebar-drawer')).getByRole('link', {
        name: /transacciones/i,
      }),
    );
    expect(screen.queryByTestId('mobile-sidebar-drawer')).not.toBeInTheDocument();
  });
});

function withinDrawer(drawer: HTMLElement) {
  return {
    getByRole: (role: 'link' | 'button', options?: { name?: RegExp }) => {
      const all = screen.getAllByRole(role, options);
      const inDrawer = all.find((el) => drawer.contains(el));
      if (!inDrawer) throw new Error(`No ${role} inside the drawer`);
      return inDrawer;
    },
  };
}
