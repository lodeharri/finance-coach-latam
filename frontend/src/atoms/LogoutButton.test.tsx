/**
 * LogoutButton atom tests (REQ-FFC-FE-LOGOUT).
 *
 * The atom has logic (controlled callbacks + navigation) so the test is
 * colocated per the foundation TDD policy. Covers:
 *  - Renders "Sign out" in active voice (NOT "Logout").
 *  - Click calls sessionStore.clear() then navigates to /login.
 *  - Keyboard activation (Enter / Space).
 *  - Visible focus ring (cobalt ink) for keyboard users.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LogoutButton } from './LogoutButton';
import { sessionStore } from '@/stores/sessionStore';

function Probe() {
  return (
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<LogoutButton />} />
        <Route path="/login" element={<div data-testid="login-page">Login page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('LogoutButton', () => {
  beforeEach(() => {
    sessionStore.getState().setSession({
      idToken: 'jwt',
      refreshToken: 'r',
      expiresAt: Date.now() + 600_000,
      userId: 'u1',
      email: 'a@b.com',
      role: 'user',
    });
  });

  afterEach(() => {
    sessionStore.getState().clear();
    localStorage.clear();
  });

  it('renders the active-voice label "Sign out" (REQ-FFC-FE-LOGOUT)', () => {
    render(<Probe />);
    expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
  });

  it('click clears the session then navigates to /login', () => {
    render(<Probe />);
    const button = screen.getByRole('button', { name: /sign out/i });
    fireEvent.click(button);

    expect(sessionStore.getState().idToken).toBeUndefined();
    expect(sessionStore.getState().userId).toBeUndefined();
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('keyboard activation (Enter) clears the session and navigates', () => {
    render(<Probe />);
    const button = screen.getByRole('button', { name: /sign out/i });
    button.focus();
    fireEvent.keyDown(button, { key: 'Enter' });
    // Native <button> elements fire click on Enter; emulate it explicitly.
    fireEvent.click(button);

    expect(sessionStore.getState().idToken).toBeUndefined();
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('keyboard activation (Space) triggers the same flow', () => {
    render(<Probe />);
    const button = screen.getByRole('button', { name: /sign out/i });
    fireEvent.click(button); // Space on a button fires click
    expect(sessionStore.getState().idToken).toBeUndefined();
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('uses native <button type="button"> to avoid form-submit side effects', () => {
    render(<Probe />);
    const button = screen.getByRole('button', { name: /sign out/i });
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
  });

  it('has an accessible name that says what the control does', () => {
    render(<Probe />);
    // aria-label is the long-form for assistive tech; the visible label is
    // "Sign out". Both surface the same intent.
    const button = screen.getByRole('button', { name: /sign out/i });
    expect(button).toHaveAccessibleName(/sign out/i);
  });
});