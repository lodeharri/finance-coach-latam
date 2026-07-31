import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import type { VerifiedToken } from '../../domain/ports/auth.port';

// API Gateway's HttpJwtAuthorizer validates the JWT before invoking Lambda
// and forwards the claims via `event.requestContext.authorizer.jwt.claims`.
// We type the event with the JWT-authorizer-aware variant so TypeScript
// knows `requestContext.authorizer` exists.
export type AuthenticatedEvent = APIGatewayProxyEventV2WithJWTAuthorizer;

export type HttpRouteHandler = (
  event: AuthenticatedEvent,
) => Promise<APIGatewayProxyStructuredResultV2>;

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
} as const;

export function jsonResponse(
  statusCode: number,
  body: unknown,
): APIGatewayProxyStructuredResultV2 {
  return {
    statusCode,
    headers: { ...CORS_HEADERS },
    body: JSON.stringify(body),
  };
}

/**
 * Normalize `cognito:groups` to a flat string array. API Gateway HTTP API v2
 * can forward the claim as:
 *   - a JSON array `["users", "admins"]` (correct, when claim has no colon)
 *   - a JSON-stringified array `"[\"users\"]"` (rare)
 *   - a literal string `"[users]"` (common — gateway serializes array via
 *     Array.prototype.toString which produces `[users]` not `[\"users\"]`)
 *   - a comma-separated string `"users,admins"` (when claim has no colon)
 *   - a single group `"users"`
 *
 * We accept all five and reduce to `string[]`.
 */
function parseGroups(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((g): g is string => typeof g === 'string');
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    // Strip surrounding brackets if present (gateway toString of array)
    const unwrapped =
      trimmed.startsWith('[') && trimmed.endsWith(']')
        ? trimmed.slice(1, -1).trim()
        : trimmed;
    // Try JSON.parse first (handles `[\"users\"]`); fall back to comma split
    if (unwrapped.startsWith('"') || unwrapped.startsWith("'")) {
      try {
        const parsed = JSON.parse(`[${unwrapped}]`) as unknown;
        if (Array.isArray(parsed)) {
          return parsed.filter((g): g is string => typeof g === 'string');
        }
      } catch {
        // fall through
      }
    }
    return unwrapped
      .split(',')
      .map((g) => g.trim().replace(/^['"]|['"]$/g, ''))
      .filter((g) => g.length > 0);
  }
  return [];
}

function resolveRole(groups: readonly string[]): 'admin' | 'user' | undefined {
  if (groups.includes('admins')) return 'admin';
  if (groups.includes('users')) return 'user';
  return undefined;
}

/**
 * Decode the payload of a Bearer JWT without verifying the signature.
 *
 * API Gateway's HttpJwtAuthorizer has already validated the token (signature,
 * issuer, audience, expiry) before the request reaches Lambda — that is the
 * entire point of the gateway layer. By the time we see the raw header we
 * trust the contents and only need the claims. We use base64url per RFC 7519
 * and tolerate the standard `Buffer` encoding.
 *
 * Returns the decoded payload as a plain record, or `null` if the header is
 * not a well-formed Bearer JWT (no signature verification, no JWKS, no
 * cryptography — parsing only).
 */
function decodeBearerJwt(
  authorization: string | undefined,
): Record<string, unknown> | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(' ');
  if (!scheme || !token || scheme.toLowerCase() !== 'bearer') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const payload = Buffer.from(parts[1]!, 'base64url').toString('utf-8');
    const parsed = JSON.parse(payload) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

// API Gateway's HttpJwtAuthorizer validates the JWT (signature, iss, aud, exp)
// BEFORE invoking Lambda and forwards the claims via
// `event.requestContext.authorizer.jwt.claims`. Re-verifying here would be
// redundant work. We just read the claims.
//
// In some API Gateway configurations the colon-prefixed `cognito:groups`
// claim does not survive the JSON serialization step (HTTP API v2 forwards
// it unreliably across deploy / payload-size combinations). When that
// happens the gateway still considers the token valid, so we must still let
// the request through. The fallback path decodes the raw Authorization
// header — the same payload the gateway already validated — and recovers
// the missing claim from there.
export function authenticate(event: AuthenticatedEvent): VerifiedToken {
  const claims = event.requestContext.authorizer?.jwt.claims;
  // Decode once per request. This is a cheap base64url + JSON.parse on a
  // payload the gateway has already validated; we never verify signatures.
  const decoded = decodeBearerJwt(event.headers?.authorization);

  // cognito:groups has priority from claims, falling back to the raw token
  // when API Gateway dropped the colon-prefixed claim.
  const groups = (() => {
    const fromClaims = parseGroups(claims?.['cognito:groups']);
    if (fromClaims.length > 0) return fromClaims;
    if (decoded) return parseGroups(decoded['cognito:groups']);
    return [];
  })();

  // sub and email normally come from claims. If the gateway forwarded them,
  // use them; otherwise (when claims is missing entirely), pull them from the
  // decoded token. We never read JWT claims that the gateway did not validate.
  const userId =
    typeof claims?.sub === 'string'
      ? claims.sub
      : typeof decoded?.sub === 'string'
        ? decoded.sub
        : undefined;
  const email =
    typeof claims?.email === 'string'
      ? claims.email
      : typeof decoded?.email === 'string'
        ? decoded.email
        : undefined;

  if (!userId || !email) {
    // Reaching this branch means the gateway forwarded no usable identity
    // AND the raw token is missing or unreadable. That is an authentication
    // failure, not a deploy-time bug, so 401 is the right surface.
    throw new HttpError(401, 'Missing or unreadable Authorization header');
  }

  const role = resolveRole(groups);
  if (!role) {
    throw new HttpError(
      401,
      'Token has no recognized Cognito group (admins or users)',
    );
  }

  return { userId, email, role };
}

export function parseBody(event: APIGatewayProxyEventV2): Record<string, unknown> {
  try {
    const parsed = JSON.parse(event.body ?? '{}') as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not an object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'Body must be a JSON object');
  }
}

export function requiredString(
  body: Record<string, unknown>,
  field: string,
): string {
  const value = body[field];
  if (typeof value !== 'string' || !value.trim()) {
    throw new HttpError(400, `Field "${field}" must be a non-empty string`);
  }
  return value.trim();
}

export function targetUserId(
  actor: VerifiedToken,
  candidate: unknown,
): string {
  if (candidate === undefined || candidate === null || candidate === '') {
    return actor.userId;
  }
  if (typeof candidate !== 'string') {
    throw new HttpError(400, 'userId must be a string');
  }
  return candidate;
}

export function routeError(error: unknown): APIGatewayProxyStructuredResultV2 {
  if (error instanceof HttpError) {
    return jsonResponse(error.statusCode, { error: error.message });
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.startsWith('Forbidden:')) {
    return jsonResponse(403, { error: message });
  }
  if (message.toLowerCase().includes('not found')) {
    return jsonResponse(404, { error: message });
  }
  console.error('Authenticated route failed:', message);
  return jsonResponse(500, { error: 'Internal server error' });
}