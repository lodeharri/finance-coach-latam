/**
 * auth service — Cognito USER_PASSWORD_AUTH + REFRESH_TOKEN_AUTH.
 *
 * Stores IdToken + RefreshToken in sessionStore. Never persists AccessToken.
 * Decodes IdToken payload (without verifying the signature — the API Gateway
 * already validated it before forwarding the request) to extract
 * `sub`, `email`, `cognito:groups`.
 */
import { sessionStore, type Role } from '@/stores/sessionStore';

interface LoginArgs {
  email: string;
  password: string;
  clientId: string;
  region: string;
}

interface RefreshArgs {
  clientId: string;
  region: string;
}

interface IdTokenClaims {
  sub?: string;
  email?: string;
  exp?: number;
  'cognito:groups'?: unknown;
}

function base64UrlDecode(s: string): string {
  if (typeof atob === 'function') {
    // jsdom + browsers: convert base64url -> base64 -> atob
    const base64 = s.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    return atob(padded);
  }
  return Buffer.from(s, 'base64url').toString('utf-8');
}

function decodeIdToken(token: string): IdTokenClaims {
  const parts = token.split('.');
  if (parts.length !== 3) return {};
  try {
    const payload = base64UrlDecode(parts[1]!);
    return JSON.parse(payload) as IdTokenClaims;
  } catch {
    return {};
  }
}

function normalizeGroups(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((g): g is string => typeof g === 'string');
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    const unwrapped =
      trimmed.startsWith('[') && trimmed.endsWith(']')
        ? trimmed.slice(1, -1).trim()
        : trimmed;
    return unwrapped
      .split(',')
      .map((g) => g.trim().replace(/^['"]|['"]$/g, ''))
      .filter((g) => g.length > 0);
  }
  return [];
}

function resolveRoleFromGroups(groups: readonly string[]): Role | undefined {
  if (groups.includes('admins')) return 'admin';
  if (groups.includes('users')) return 'user';
  return undefined;
}

type CognitoAction = 'InitiateAuth' | 'RespondToAuthChallenge';

async function postCognito<T>(
  region: string,
  body: Record<string, unknown>,
  action: CognitoAction = 'InitiateAuth',
): Promise<T> {
  const url = `https://cognito-idp.${region}.amazonaws.com/`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-amz-json-1.1',
      'X-Amz-Target': `AWSCognitoIdentityProviderService.${action}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      typeof json.message === 'string' ? json.message : `Cognito request failed (${res.status})`;
    throw new Error(message);
  }
  return json as T;
}

interface InitiateAuthResult {
  AuthenticationResult?: {
    IdToken?: string;
    RefreshToken?: string;
    ExpiresIn?: number;
  };
  ChallengeName?: string;
  Session?: string;
  ChallengeParameters?: Record<string, string>;
}

export interface NewPasswordRequiredSignal {
  kind: 'NEW_PASSWORD_REQUIRED';
  session: string;
  email: string;
}

interface CompleteNewPasswordArgs {
  email: string;
  session: string;
  newPassword: string;
  clientId: string;
  region: string;
}

function consumeAuthenticationResult(auth: NonNullable<InitiateAuthResult['AuthenticationResult']>): void {
  const claims = decodeIdToken(auth.IdToken as string);
  const groups = normalizeGroups(claims['cognito:groups']);
  const role = resolveRoleFromGroups(groups);
  if (!role || !claims.sub || !claims.email) {
    throw new Error('IdToken missing sub/email or unrecognized group');
  }
  sessionStore.getState().setSession({
    idToken: auth.IdToken as string,
    refreshToken: auth.RefreshToken as string,
    expiresAt: Date.now() + (auth.ExpiresIn as number) * 1000,
    userId: claims.sub,
    email: claims.email,
    role,
  });
}

export const authService = {
  async login(args: LoginArgs): Promise<void | NewPasswordRequiredSignal> {
    const result = await postCognito<InitiateAuthResult>(
      args.region,
      {
        AuthFlow: 'USER_PASSWORD_AUTH',
        ClientId: args.clientId,
        AuthParameters: {
          USERNAME: args.email,
          PASSWORD: args.password,
        },
      },
      'InitiateAuth',
    );
    if (result.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
      if (!result.Session) {
        throw new Error('Cognito NEW_PASSWORD_REQUIRED challenge missing Session');
      }
      return { kind: 'NEW_PASSWORD_REQUIRED', session: result.Session, email: args.email };
    }
    const auth = result.AuthenticationResult;
    if (!auth || !auth.IdToken || !auth.RefreshToken || !auth.ExpiresIn) {
      throw new Error('Cognito response missing AuthenticationResult fields');
    }
    consumeAuthenticationResult(auth);
  },

  async completeNewPasswordChallenge(args: CompleteNewPasswordArgs): Promise<void> {
    const result = await postCognito<InitiateAuthResult>(
      args.region,
      {
        ChallengeName: 'NEW_PASSWORD_REQUIRED',
        ClientId: args.clientId,
        Session: args.session,
        ChallengeResponses: {
          USERNAME: args.email,
          NEW_PASSWORD: args.newPassword,
        },
      },
      'RespondToAuthChallenge',
    );
    const auth = result.AuthenticationResult;
    if (!auth || !auth.IdToken || !auth.RefreshToken || !auth.ExpiresIn) {
      throw new Error('Cognito response missing AuthenticationResult fields');
    }
    consumeAuthenticationResult(auth);
  },

  async refreshIfNeeded(args: RefreshArgs): Promise<void> {
    const session = sessionStore.getState();
    if (!session.idToken || !session.refreshToken || !session.expiresAt) return;
    const msLeft = session.expiresAt - Date.now();
    if (msLeft > 60_000) return; // > 60s, no refresh needed
    const result = await postCognito<InitiateAuthResult>(
      args.region,
      {
        AuthFlow: 'REFRESH_TOKEN_AUTH',
        ClientId: args.clientId,
        AuthParameters: {
          REFRESH_TOKEN: session.refreshToken,
        },
      },
      'InitiateAuth',
    );
    const auth = result.AuthenticationResult;
    if (!auth || !auth.IdToken || !auth.ExpiresIn) {
      throw new Error('Cognito refresh missing fields');
    }
    sessionStore.getState().setSession({
      ...session,
      idToken: auth.IdToken,
      expiresAt: Date.now() + auth.ExpiresIn * 1000,
      // refresh token is preserved unless Cognito returned a new one
      refreshToken: auth.RefreshToken ?? session.refreshToken,
    });
  },

  logout(): void {
    sessionStore.getState().clear();
  },
};