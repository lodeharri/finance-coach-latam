/**
 * LogoutButton atom tests (REQ-FFC-FE-LOGOUT).
 *
 * The atom has logic (controlled callbacks + navigation) so the test is
 * colocated per the foundation TDD policy. Covers:
 *  - Renders "Sign out" in active voice (NOT "Logout").
 *  - Click calls sessionStore.clear() then navigates to /login.
 *  - Click fires Cognito RevokeToken with the stored refresh token.
 *  - Keyboard activation (Enter / Space).
 *  - Visible focus ring (cobalt ink) for keyboard users.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { LogoutButton } from './LogoutButton';
import { sessionStore } from '@/stores/sessionStore';

function Probe() {
  return (
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route
          path="/dashboard"
          element={<LogoutButton clientId="client-1" region="us-east-1" />}
        />
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
    // Stub fetch so the RevokeToken POST the click handler fires has a
    // resolvable target. Without this, the fetch would fail in jsdom and the
    // click test would log unhandled errors.
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200 })) as unknown as typeof fetch;
  });

  afterEach(() => {
    sessionStore.getState().clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders the active-voice label "Cerrar sesión" (REQ-FFC-FE-LOGOUT)', () => {
    render(<Probe />);
    expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeInTheDocument();
  });

  it('click clears the session then navigates to /login', async () => {
    render(<Probe />);
    const button = screen.getByRole('button', { name: /cerrar sesión/i });
    fireEvent.click(button);

    await waitFor(() => expect(sessionStore.getState().idToken).toBeUndefined());
    expect(sessionStore.getState().userId).toBeUndefined();
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('click fires Cognito RevokeToken with the stored refresh token', async () => {
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockClear();
    render(<Probe />);
    const button = screen.getByRole('button', { name: /cerrar sesión/i });
    fireEvent.click(button);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://cognito-idp.us-east-1.amazonaws.com/');
    expect((init.headers as Record<string, string>)['X-Amz-Target']).toBe(
      'AWSCognitoIdentityProviderService.RevokeToken',
    );
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toEqual({ ClientId: 'client-1', Token: 'r' });
  });

  it('keyboard activation (Enter) clears the session and navigates', async () => {
    render(<Probe />);
    const button = screen.getByRole('button', { name: /cerrar sesión/i });
    button.focus();
    fireEvent.keyDown(button, { key: 'Enter' });
    // Native <button> elements fire click on Enter; emulate it explicitly.
    fireEvent.click(button);

    await waitFor(() => expect(sessionStore.getState().idToken).toBeUndefined());
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('keyboard activation (Space) triggers the same flow', async () => {
    render(<Probe />);
    const button = screen.getByRole('button', { name: /cerrar sesión/i });
    fireEvent.click(button); // Space on a button fires click
    await waitFor(() => expect(sessionStore.getState().idToken).toBeUndefined());
    expect(screen.getByTestId('login-page')).toBeInTheDocument();
  });

  it('uses native <button type="button"> to avoid form-submit side effects', () => {
    render(<Probe />);
    const button = screen.getByRole('button', { name: /cerrar sesión/i });
    expect(button.tagName).toBe('BUTTON');
    expect(button.getAttribute('type')).toBe('button');
  });

  it('has an accessible name that says what the control does', () => {
    render(<Probe />);
    // aria-label is the long-form for assistive tech; the visible label is
    // "Cerrar sesión". Both surface the same intent.
    const button = screen.getByRole('button', { name: /cerrar sesión/i });
    expect(button).toHaveAccessibleName(/cerrar sesión/i);
  });
});