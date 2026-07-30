import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { describe, expect, it } from 'vitest';
import { authenticate, HttpError } from './http.utils';

interface AuthorizerClaims {
  readonly sub: string;
  readonly email: string;
  readonly 'cognito:groups'?: string[] | string;
}

type ClaimOverrides = Partial<AuthorizerClaims>;

function makeEvent(
  claims: ClaimOverrides,
  headers: Record<string, string | undefined> = {},
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: '/anything',
    rawQueryString: '',
    headers,
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      domainName: 'api.example.com',
      domainPrefix: 'api',
      http: {
        method: 'GET',
        path: '/anything',
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: 'vitest',
      },
      requestId: 'req-1',
      routeKey: '$default',
      stage: '$default',
      time: '01/Jan/2026:00:00:00 +0000',
      timeEpoch: 0,
      authorizer: {
        jwt: {
          claims: claims as APIGatewayProxyEventV2WithJWTAuthorizer['requestContext']['authorizer']['jwt']['claims'],
          scopes: [],
        },
        principalId: 'test-principal',
        integrationLatency: 0,
      },
    },
    body: undefined,
    isBase64Encoded: false,
  };
}

/**
 * Build a minimal but well-formed JWT (header.payload.signature). The signature
 * segment is placeholder text — `authenticate` only decodes the payload and
 * never verifies signatures (API Gateway has already done that before the
 * request reached Lambda).
 */
function jwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
    'utf-8',
  ).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload), 'utf-8').toString(
    'base64url',
  );
  return `${header}.${body}.sig-not-verified`;
}

describe('authenticate', () => {
  // ─── Direct claim path (pre-existing behaviour, locked down) ─────────────

  it('derives admin role when claims include cognito:groups: ["admins"]', () => {
    const result = authenticate(
      makeEvent({
        sub: 'admin-1',
        email: 'admin@example.com',
        'cognito:groups': ['admins'],
      }),
    );

    expect(result).toEqual({
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
    });
  });

  it('derives user role when claims include cognito:groups: ["users"]', () => {
    const result = authenticate(
      makeEvent({
        sub: 'user-1',
        email: 'user@example.com',
        'cognito:groups': ['users'],
      }),
    );

    expect(result).toEqual({
      userId: 'user-1',
      email: 'user@example.com',
      role: 'user',
    });
  });

  // ─── Fallback path: decode the raw Authorization header when the claims
  //     object did not propagate cognito:groups (the production bug) ────────

  it('derives role from decoded JWT when claims omit cognito:groups but a Bearer token is present', () => {
    // Sub + email are present in claims (the gateway forwarded them) but the
    // colon-prefixed array claim did not survive. Production symptom: 500.
    // After fix: the function decodes the raw header and recovers the groups.
    const token = jwt({
      sub: 'admin-1',
      email: 'admin@example.com',
      'cognito:groups': ['admins'],
    });

    const result = authenticate(
      makeEvent(
        { sub: 'admin-1', email: 'admin@example.com' },
        { authorization: `Bearer ${token}` },
      ),
    );

    expect(result).toEqual({
      userId: 'admin-1',
      email: 'admin@example.com',
      role: 'admin',
    });
  });

  it('derives user role from decoded JWT (admins NOT in groups array)', () => {
    const token = jwt({
      sub: 'user-1',
      email: 'user@example.com',
      'cognito:groups': ['users'],
    });

    const result = authenticate(
      makeEvent(
        { sub: 'user-1', email: 'user@example.com' },
        { authorization: `Bearer ${token}` },
      ),
    );

    expect(result.role).toBe('user');
  });

  // ─── Error paths ────────────────────────────────────────────────────────

  it('throws HttpError(401) when there is no Authorization header and no cognito:groups in claims', () => {
    // Claims present with sub + email but the gateway stripped cognito:groups
    // AND no raw token to decode → 401, not 500. A missing token is a client
    // auth failure, not a server-side bug.
    expect(() =>
      authenticate(
        makeEvent({ sub: 'admin-1', email: 'admin@example.com' }),
      ),
    ).toThrow(HttpError);

    try {
      authenticate(
        makeEvent({ sub: 'admin-1', email: 'admin@example.com' }),
      );
    } catch (err) {
      expect(err).toBeInstanceOf(HttpError);
      expect((err as HttpError).statusCode).toBe(401);
    }
  });

  // ─── Triangulation: extra edge cases worth locking down ─────────────────

  it('treats cognito:groups as a comma-separated string (some configurations normalize array claims)', () => {
    const result = authenticate(
      makeEvent({
        sub: 'admin-1',
        email: 'admin@example.com',
        'cognito:groups': 'admins,users',
      }),
    );
    expect(result.role).toBe('admin');
  });

  it('prefers "admins" over "users" when both groups are present', () => {
    const result = authenticate(
      makeEvent({
        sub: 'admin-1',
        email: 'admin@example.com',
        'cognito:groups': ['users', 'admins'],
      }),
    );
    expect(result.role).toBe('admin');
  });

  it('throws HttpError(401) when Authorization header is not a Bearer token', () => {
    expect(() =>
      authenticate(
        makeEvent(
          { sub: 'admin-1', email: 'admin@example.com' },
          { authorization: 'Basic dXNlcjpwYXNz' },
        ),
      ),
    ).toThrow(HttpError);

    try {
      authenticate(
        makeEvent(
          { sub: 'admin-1', email: 'admin@example.com' },
          { authorization: 'Basic dXNlcjpwYXNz' },
        ),
      );
    } catch (err) {
      expect((err as HttpError).statusCode).toBe(401);
    }
  });

  it('throws HttpError(401) when the Bearer token payload cannot be parsed', () => {
    expect(() =>
      authenticate(
        makeEvent(
          { sub: 'admin-1', email: 'admin@example.com' },
          { authorization: 'Bearer not-a-jwt-token' },
        ),
      ),
    ).toThrow(HttpError);

    try {
      authenticate(
        makeEvent(
          { sub: 'admin-1', email: 'admin@example.com' },
          { authorization: 'Bearer not-a-jwt-token' },
        ),
      );
    } catch (err) {
      expect((err as HttpError).statusCode).toBe(401);
    }
  });
});
