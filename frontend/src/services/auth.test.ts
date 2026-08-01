/**
 * auth service test suite (RED phase).
 *
 * Validates the Cognito USER_PASSWORD_AUTH flow:
 *  - login(email, password) calls InitiateAuth with USERNAME/PASSWORD/AuthFlow/ClientId.
 *  - On success, decodes IdToken payload for sub/email/cognito:groups.
 *  - role resolves to 'admin' if `admins` in groups, else 'user' if `users` in groups.
 *  - refreshIfNeeded refreshes 60s before expiry.
 *  - logout clears session.
 *
 * We mock globalThis.fetch to avoid hitting Cognito. The decodeBearerJwt logic
 * is shared with the backend (`backend/src/interfaces/http/http.utils.ts`) so
 * the SPA can decode claims without re-validating the signature.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authService } from './auth';
import { sessionStore } from '@/stores/sessionStore';

const sessionApi = sessionStore.getState();

function makeIdToken(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = 'sig';
  return `${header}.${body}.${sig}`;
}

const ID_TOKEN = makeIdToken({
  sub: 'u-123',
  email: 'alice@example.com',
  'cognito:groups': ['users'],
  exp: Math.floor(Date.now() / 1000) + 3600,
});

const ADMIN_ID_TOKEN = makeIdToken({
  sub: 'admin-1',
  email: 'admin@example.com',
  'cognito:groups': ['admins'],
  exp: Math.floor(Date.now() / 1000) + 3600,
});

describe('authService', () => {
  beforeEach(() => {
    sessionApi.clear();
    localStorage.clear();
  });

  afterEach(() => {
    sessionApi.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('login() calls Cognito InitiateAuth with USER_PASSWORD_AUTH', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          AuthenticationResult: {
            IdToken: ID_TOKEN,
            RefreshToken: 'refresh-1',
            ExpiresIn: 3600,
          },
        }),
        { status: 200 },
      ),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await authService.login({
      email: 'alice@example.com',
      password: 'pw',
      clientId: 'client-id',
      region: 'us-east-1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('cognito-idp.us-east-1.amazonaws.com');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body.AuthFlow).toBe('USER_PASSWORD_AUTH');
    expect(body.ClientId).toBe('client-id');
    expect(body.AuthParameters).toEqual({
      USERNAME: 'alice@example.com',
      PASSWORD: 'pw',
    });
  });

  it('login() decodes IdToken and sets session with role=user', async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            AuthenticationResult: {
              IdToken: ID_TOKEN,
              RefreshToken: 'refresh-1',
              ExpiresIn: 3600,
            },
          }),
          { status: 200 },
        ),
      )) as unknown as typeof fetch;

    await authService.login({
      email: 'alice@example.com',
      password: 'pw',
      clientId: 'client-id',
      region: 'us-east-1',
    });

    const s = sessionStore.getState();
    expect(s.idToken).toBe(ID_TOKEN);
    expect(s.userId).toBe('u-123');
    expect(s.email).toBe('alice@example.com');
    expect(s.role).toBe('user');
  });

  it('login() resolves admin role from cognito:groups=admins', async () => {
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            AuthenticationResult: {
              IdToken: ADMIN_ID_TOKEN,
              RefreshToken: 'refresh-2',
              ExpiresIn: 3600,
            },
          }),
          { status: 200 },
        ),
      )) as unknown as typeof fetch;

    await authService.login({
      email: 'admin@example.com',
      password: 'pw',
      clientId: 'client-id',
      region: 'us-east-1',
    });

    expect(sessionStore.getState().role).toBe('admin');
  });

  it('login() throws on Cognito NotAuthorizedException with the backend message', async () => {
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

    await expect(
      authService.login({
        email: 'a@b.com',
        password: 'wrong',
        clientId: 'client-id',
        region: 'us-east-1',
      }),
    ).rejects.toThrow(/Incorrect username or password/);
  });

  it('refreshIfNeeded() refreshes when within 60s of expiry', async () => {
    sessionApi.setSession({
      idToken: ID_TOKEN,
      refreshToken: 'old-refresh',
      expiresAt: Date.now() + 30_000, // 30s left — within the 60s window
      userId: 'u-123',
      email: 'alice@example.com',
      role: 'user',
    });
    const newIdToken = makeIdToken({
      sub: 'u-123',
      email: 'alice@example.com',
      'cognito:groups': ['users'],
      exp: Math.floor(Date.now() / 1000) + 3600,
    });
    globalThis.fetch = (() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            AuthenticationResult: {
              IdToken: newIdToken,
              RefreshToken: 'new-refresh',
              ExpiresIn: 3600,
            },
          }),
          { status: 200 },
        ),
      )) as unknown as typeof fetch;

    await authService.refreshIfNeeded({
      clientId: 'client-id',
      region: 'us-east-1',
    });
    expect(sessionStore.getState().idToken).toBe(newIdToken);
    expect(sessionStore.getState().refreshToken).toBe('new-refresh');
  });

  it('refreshIfNeeded() does NOT refresh when expiry is comfortably in the future', async () => {
    sessionApi.setSession({
      idToken: ID_TOKEN,
      refreshToken: 'refresh',
      expiresAt: Date.now() + 600_000, // 10 minutes left
      userId: 'u-123',
      email: 'a@b.com',
      role: 'user',
    });
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await authService.refreshIfNeeded({
      clientId: 'client-id',
      region: 'us-east-1',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sessionStore.getState().idToken).toBe(ID_TOKEN);
  });

  it('logout() clears the session', () => {
    sessionApi.setSession({
      idToken: 'a',
      refreshToken: 'r',
      expiresAt: 1,
      userId: 'u',
      email: 'a@b.com',
      role: 'user',
    });
    authService.logout();
    expect(sessionStore.getState().idToken).toBeUndefined();
  });
});