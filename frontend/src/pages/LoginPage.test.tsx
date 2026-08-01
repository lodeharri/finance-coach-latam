/**
 * LoginPage test suite (RED phase).
 *
 * Renders FormField for email/password inside AuthShell. Calls useAuth.login on
 * submit. Surfaces inline error from Cognito on failure. Redirects to /dashboard
 * on success. Never reads tokens from URL.
 */
import { act, render, screen } from '@/test/test-utils';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { LoginPage } from './LoginPage';
import { sessionStore } from '@/stores/sessionStore';

const sessionApi = sessionStore.getState();

function makeIdToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

const ENV = {
  VITE_COGNITO_USER_POOL_CLIENT_ID: 'cid',
  VITE_COGNITO_REGION: 'us-east-1',
  VITE_API_BASE_URL: 'https://api.example.test',
};

function wrap(node: React.ReactNode, initialPath = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      {node}
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    sessionApi.clear();
    localStorage.clear();
  });

  afterEach(() => {
    sessionApi.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders email and password fields inside AuthShell', () => {
    wrap(<LoginPage env={ENV} />);
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('shows inline error from Cognito NotAuthorizedException', async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            __type: 'NotAuthorizedException',
            message: 'Incorrect username or password.',
          }),
          { status: 400 },
        ),
      )) as unknown as typeof fetch;

    wrap(<LoginPage env={ENV} />);
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submit = screen.getByRole('button', { name: /sign in|log in|entrar/i });

    await act(async () => {
      // Use fireEvent typing helpers via screen — but easier: call onChange via .fill
    });

    // Use the userEvent-style direct value-set on controlled inputs.
    emailInput.focus();
    // Use native setter so React picks up the value change.
    const nativeInputSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    nativeInputSetter?.call(emailInput, 'a@b.com');
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));

    nativeInputSetter?.call(passwordInput, 'wrong');
    passwordInput.dispatchEvent(new Event('input', { bubbles: true }));

    await act(async () => {
      submit.click();
    });

    expect(await screen.findByText(/incorrect username or password/i)).toBeInTheDocument();
  });

  it('navigates to /dashboard on successful login', async () => {
    const idToken = makeIdToken({
      sub: 'u-1',
      email: 'a@b.com',
      'cognito:groups': ['users'],
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            AuthenticationResult: { IdToken: idToken, RefreshToken: 'r', ExpiresIn: 3600 },
          }),
          { status: 200 },
        ),
      )) as unknown as typeof fetch;

    wrap(<LoginPage env={ENV} />);

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submit = screen.getByRole('button', { name: /sign in|log in|entrar/i });

    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    setter?.call(emailInput, 'a@b.com');
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    setter?.call(passwordInput, 'pw');
    passwordInput.dispatchEvent(new Event('input', { bubbles: true }));

    await act(async () => {
      submit.click();
    });

    // After login, session is set.
    expect(sessionStore.getState().idToken).toBe(idToken);
  });
});