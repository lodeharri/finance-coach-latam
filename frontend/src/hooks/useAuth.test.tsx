/**
 * useAuth hook test suite (RED phase).
 *
 * Wraps authService in a React-friendly state machine:
 *  - status: 'idle' | 'authenticating' | 'authenticated' | 'error'
 *  - role: 'admin' | 'user' | undefined
 *  - error: string | null
 *
 * Exposes login(email, password), logout(), refreshIfNeeded().
 */
import { act, render } from '@/test/test-utils';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { useAuth } from './useAuth';
import { sessionStore } from '@/stores/sessionStore';

const sessionApi = sessionStore.getState();

function makeIdToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.sig`;
}

function Probe({ onReady }: { onReady: (api: ReturnType<typeof useAuth>) => void }) {
  const api = useAuth();
  // Surface the API to the test on first render.
  onReady(api);
  return <div data-testid="auth-status">{api.status}</div>;
}

describe('useAuth', () => {
  beforeEach(() => {
    sessionApi.clear();
    localStorage.clear();
  });

  it('initial status is idle when no session', () => {
    let api!: ReturnType<typeof useAuth>;
    render(<Probe onReady={(a) => (api = a)} />);
    expect(api.status).toBe('idle');
    expect(api.role).toBeUndefined();
    expect(api.error).toBeNull();
  });

  it('initial status is authenticated when session is already set', () => {
    sessionApi.setSession({
      idToken: makeIdToken({ sub: 'u1', email: 'a@b.com', 'cognito:groups': ['users'] }),
      refreshToken: 'r',
      expiresAt: Date.now() + 600_000,
      userId: 'u1',
      email: 'a@b.com',
      role: 'user',
    });
    let api!: ReturnType<typeof useAuth>;
    render(<Probe onReady={(a) => (api = a)} />);
    expect(api.status).toBe('authenticated');
    expect(api.role).toBe('user');
  });

  it('login() transitions through authenticating -> authenticated', async () => {
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

    let api!: ReturnType<typeof useAuth>;
    render(<Probe onReady={(a) => (api = a)} />);

    await act(async () => {
      await api.login({
        email: 'a@b.com',
        password: 'pw',
        clientId: 'cid',
        region: 'us-east-1',
      });
    });

    expect(api.status).toBe('authenticated');
    expect(api.role).toBe('user');
    expect(api.userId).toBe('u-1');
  });

  it('login() transitions to error on Cognito failure', async () => {
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

    let api!: ReturnType<typeof useAuth>;
    render(<Probe onReady={(a) => (api = a)} />);

    await act(async () => {
      try {
        await api.login({
          email: 'a@b.com',
          password: 'wrong',
          clientId: 'cid',
          region: 'us-east-1',
        });
      } catch {
        // expected — useAuth re-throws after capturing the message
      }
    });

    expect(api.status).toBe('error');
    expect(api.error).toMatch(/Incorrect username or password/);
  });

  it('logout() clears the session and resets status to idle', () => {
    sessionApi.setSession({
      idToken: 'a',
      refreshToken: 'r',
      expiresAt: Date.now() + 60_000,
      userId: 'u',
      email: 'a@b.com',
      role: 'user',
    });
    let api!: ReturnType<typeof useAuth>;
    render(<Probe onReady={(a) => (api = a)} />);
    expect(api.status).toBe('authenticated');
    act(() => api.logout());
    expect(api.status).toBe('idle');
  });

  it('refreshIfNeeded() silently does nothing when not authenticated', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    let api!: ReturnType<typeof useAuth>;
    render(<Probe onReady={(a) => (api = a)} />);
    await act(async () => {
      await api.refreshIfNeeded({ clientId: 'cid', region: 'us-east-1' });
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(api.status).toBe('idle');
  });
});