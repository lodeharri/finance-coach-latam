/**
 * AppShell tests — Litografía del Sur.
 *
 * Mobile sidebar (REQ-FF-MOBILE-SIDEBAR): a hamburger button in the masthead
 * opens the Sidebar as a slide-over drawer on small viewports. The button is
 * only visible below the md breakpoint (`md:hidden` per Tailwind).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@/test/test-utils';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { sessionStore } from '@/stores/sessionStore';
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

  // Issue 4 — mobile responsive fixes. Pinned by test so a regression
  // (e.g. hardcoded px-12 padding) cannot ship and wreck the 375px layout.
  it('main content area uses reduced horizontal padding on mobile', () => {
    renderShell();
    const main = screen.getByTestId('app-shell-main');
    // Mobile-first: px-4 (16px) instead of px-12 (48px). On desktop we
    // restore the editorial breathing room via md:px-12 / md:pr-20.
    expect(main.className).toMatch(/px-4/);
    expect(main.className).toMatch(/md:px-12/);
  });

  it('masthead uses compact horizontal padding on mobile so the header fits a 375px viewport', () => {
    renderShell();
    const masthead = screen.getByTestId('app-shell-masthead');
    // Compact on mobile, editorial breathing room on md+.
    expect(masthead.className).toMatch(/px-4/);
    expect(masthead.className).toMatch(/md:px-12/);
  });

  it('masthead allows children to wrap on narrow viewports so role/date/logout never overflow the title', () => {
    renderShell();
    const masthead = screen.getByTestId('app-shell-masthead');
    // flex-wrap lets the date / RoleBadge / LogoutButton wrap to a second
    // row when there is no horizontal room.
    expect(masthead.className).toMatch(/flex-wrap/);
  });
});

describe('AppShell session user identity', () => {
  beforeEach(() => {
    sessionStore.getState().setSession({
      idToken: 'jwt',
      refreshToken: 'r',
      expiresAt: Date.now() + 600_000,
      userId: 'u1',
      email: 'ada.lovelace@example.com',
      role: 'admin',
    });
  });

  afterEach(() => {
    sessionStore.getState().clear();
    localStorage.clear();
  });

  it('renders the authenticated user email next to the logout button (not the role literal)', () => {
    renderShell('/dashboard', 'admin');
    const identity = screen.getByTestId('app-shell-user-identity');
    expect(identity.textContent).toBe('ada.lovelace@example.com');
  });

  it('does not render the role literal ("User" / "Admin") in the masthead', () => {
    renderShell('/dashboard', 'user');
    expect(screen.queryByTestId('role-badge')).not.toBeInTheDocument();
    expect(screen.queryByText(/^User$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Admin$/)).not.toBeInTheDocument();
  });

  it('omits the identity span when there is no active session', () => {
    sessionStore.getState().clear();
    renderShell('/dashboard', 'admin');
    expect(screen.queryByTestId('app-shell-user-identity')).not.toBeInTheDocument();
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
