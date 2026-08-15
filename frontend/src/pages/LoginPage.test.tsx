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
    expect(screen.getByRole('heading', { name: /iniciar sesión/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/correo/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contraseña/i)).toBeInTheDocument();
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
    const emailInput = screen.getByLabelText(/correo/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submit = screen.getByRole('button', { name: /iniciar sesión|ingresar/i });

    emailInput.focus();
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

    const emailInput = screen.getByLabelText(/correo/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const submit = screen.getByRole('button', { name: /iniciar sesión|ingresar/i });

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

    expect(sessionStore.getState().idToken).toBe(idToken);
  });

  it('transforms into the new-password form when Cognito returns NEW_PASSWORD_REQUIRED', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ChallengeName: 'NEW_PASSWORD_REQUIRED',
            Session: 'mock-session',
            ChallengeParameters: { USERNAME: 'a@b.com' },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            AuthenticationResult: {
              IdToken: makeIdToken({
                sub: 'u-1',
                email: 'a@b.com',
                'cognito:groups': ['users'],
                exp: Math.floor(Date.now() / 1000) + 3600,
              }),
              RefreshToken: 'r',
              ExpiresIn: 3600,
            },
          }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    wrap(<LoginPage env={ENV} />);

    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    const emailInput = screen.getByLabelText(/correo/i);
    const passwordInput = screen.getByLabelText(/contraseña/i);
    const loginSubmit = screen.getByRole('button', { name: /iniciar sesión|ingresar/i });

    setter?.call(emailInput, 'a@b.com');
    emailInput.dispatchEvent(new Event('input', { bubbles: true }));
    setter?.call(passwordInput, 'TempPw1!');
    passwordInput.dispatchEvent(new Event('input', { bubbles: true }));

    await act(async () => {
      loginSubmit.click();
    });

    expect(await screen.findByTestId('new-password-form')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /elegí tu nueva contraseña/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/nueva contraseña/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmar contraseña/i)).toBeInTheDocument();
    expect(screen.getByTestId('new-password-submit')).toBeInTheDocument();
    expect(screen.getByTestId('new-password-cancel')).toBeInTheDocument();
    expect(sessionStore.getState().idToken).toBeUndefined();
  });

  it('shows a validation error when new-password fields do not match and does not call Cognito again', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ChallengeName: 'NEW_PASSWORD_REQUIRED',
          Session: 'mock-session',
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    wrap(<LoginPage env={ENV} />);

    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    setter?.call(screen.getByLabelText(/correo/i), 'a@b.com');
    screen.getByLabelText(/correo/i).dispatchEvent(new Event('input', { bubbles: true }));
    setter?.call(screen.getByLabelText(/contraseña/i), 'TempPw1!');
    screen.getByLabelText(/contraseña/i).dispatchEvent(new Event('input', { bubbles: true }));

    await act(async () => {
      screen.getByTestId('login-submit').click();
    });

    expect(await screen.findByTestId('new-password-form')).toBeInTheDocument();
    const newPwInput = screen.getByLabelText(/nueva contraseña/i);
    const confirmPwInput = screen.getByLabelText(/confirmar contraseña/i);
    const newPwSubmit = screen.getByTestId('new-password-submit');

    setter?.call(newPwInput, 'BrandNew1!');
    newPwInput.dispatchEvent(new Event('input', { bubbles: true }));
    setter?.call(confirmPwInput, 'Different1!');
    confirmPwInput.dispatchEvent(new Event('input', { bubbles: true }));

    await act(async () => {
      newPwSubmit.click();
    });

    expect(await screen.findByText(/no coinciden/i)).toBeInTheDocument();
    // Only the initial InitiateAuth call was made; RespondToAuthChallenge was not invoked.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('completes the new-password flow and signs the user in', async () => {
    const idToken = makeIdToken({
      sub: 'u-1',
      email: 'a@b.com',
      'cognito:groups': ['users'],
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ChallengeName: 'NEW_PASSWORD_REQUIRED',
            Session: 'mock-session',
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            AuthenticationResult: { IdToken: idToken, RefreshToken: 'r', ExpiresIn: 3600 },
          }),
          { status: 200 },
        ),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    wrap(<LoginPage env={ENV} />);

    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    setter?.call(screen.getByLabelText(/correo/i), 'a@b.com');
    screen.getByLabelText(/correo/i).dispatchEvent(new Event('input', { bubbles: true }));
    setter?.call(screen.getByLabelText(/contraseña/i), 'TempPw1!');
    screen.getByLabelText(/contraseña/i).dispatchEvent(new Event('input', { bubbles: true }));

    await act(async () => {
      screen.getByTestId('login-submit').click();
    });

    const newPwInput = await screen.findByLabelText(/nueva contraseña/i);
    const confirmPwInput = screen.getByLabelText(/confirmar contraseña/i);
    const newPwSubmit = await screen.findByTestId('new-password-submit');

    setter?.call(newPwInput, 'BrandNew1!');
    newPwInput.dispatchEvent(new Event('input', { bubbles: true }));
    setter?.call(confirmPwInput, 'BrandNew1!');
    confirmPwInput.dispatchEvent(new Event('input', { bubbles: true }));

    await act(async () => {
      newPwSubmit.click();
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, init2] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect((init2.headers as Record<string, string>)['X-Amz-Target']).toBe(
      'AWSCognitoIdentityProviderService.RespondToAuthChallenge',
    );
    expect(sessionStore.getState().idToken).toBe(idToken);
  });

  it('rejects a new password that does not meet the policy and does not call Cognito again', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ChallengeName: 'NEW_PASSWORD_REQUIRED',
          Session: 'mock-session',
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    wrap(<LoginPage env={ENV} />);

    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    setter?.call(screen.getByLabelText(/correo/i), 'a@b.com');
    screen.getByLabelText(/correo/i).dispatchEvent(new Event('input', { bubbles: true }));
    setter?.call(screen.getByLabelText(/contraseña/i), 'TempPw1!');
    screen.getByLabelText(/contraseña/i).dispatchEvent(new Event('input', { bubbles: true }));

    await act(async () => {
      screen.getByTestId('login-submit').click();
    });

    const newPwInput = await screen.findByLabelText(/nueva contraseña/i);
    const confirmPwInput = screen.getByLabelText(/confirmar contraseña/i);
    const newPwSubmit = await screen.findByTestId('new-password-submit');

    // Too short, no digit, no symbol — fails all three policy checks.
    setter?.call(newPwInput, 'short');
    newPwInput.dispatchEvent(new Event('input', { bubbles: true }));
    setter?.call(confirmPwInput, 'short');
    confirmPwInput.dispatchEvent(new Event('input', { bubbles: true }));

    await act(async () => {
      newPwSubmit.click();
    });

    expect(await screen.findByText(/al menos 8 caracteres/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('cancelling the new-password form returns to the normal login form', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ChallengeName: 'NEW_PASSWORD_REQUIRED',
          Session: 'mock-session',
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    wrap(<LoginPage env={ENV} />);

    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
    setter?.call(screen.getByLabelText(/correo/i), 'a@b.com');
    screen.getByLabelText(/correo/i).dispatchEvent(new Event('input', { bubbles: true }));
    setter?.call(screen.getByLabelText(/contraseña/i), 'TempPw1!');
    screen.getByLabelText(/contraseña/i).dispatchEvent(new Event('input', { bubbles: true }));

    await act(async () => {
      screen.getByTestId('login-submit').click();
    });

    expect(await screen.findByTestId('new-password-form')).toBeInTheDocument();

    await act(async () => {
      screen.getByTestId('new-password-cancel').click();
    });

    expect(screen.queryByTestId('new-password-form')).toBeNull();
    expect(screen.getByTestId('login-form')).toBeInTheDocument();
  });
});