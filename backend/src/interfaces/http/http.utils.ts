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
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
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

// API Gateway's HttpJwtAuthorizer validates the JWT (signature, iss, aud, exp)
// BEFORE invoking Lambda and forwards the claims via
// `event.requestContext.authorizer.jwt.claims`. Re-verifying here would be
// redundant work. We just read the claims.
export function authenticate(event: AuthenticatedEvent): VerifiedToken {
  const claims = event.requestContext.authorizer?.jwt.claims;
  if (!claims) {
    // Reaching this branch means the API Gateway authorizer was either
    // removed or the request reached Lambda without going through the
    // configured default authorizer. That is a deploy-level bug we want
    // to surface as 500 instead of letting the route silently run with an
    // anonymous actor.
    throw new HttpError(
      500,
      'Authenticated routes require the API Gateway JWT authorizer',
    );
  }

  const userId = claims.sub;
  const email = claims.email;
  if (typeof userId !== 'string' || typeof email !== 'string') {
    throw new HttpError(500, 'Token is missing sub or email claims');
  }

  // Cognito sets `cognito:groups` to an array in the JWT; API Gateway
  // passes that through as-is. We also tolerate a single string value
  // (some configurations normalize multi-value claims) and split on commas
  // for the same reason.
  const rawGroups = claims['cognito:groups'];
  const groups: string[] = Array.isArray(rawGroups)
    ? rawGroups.filter((g): g is string => typeof g === 'string')
    : typeof rawGroups === 'string'
      ? rawGroups.split(',').map((g) => g.trim()).filter((g) => g.length > 0)
      : [];
  const role = groups.includes('admins')
    ? 'admin'
    : groups.includes('users')
      ? 'user'
      : undefined;
  if (!role) {
    throw new HttpError(
      500,
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