import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyStructuredResultV2,
} from 'aws-lambda';
import type { VerifiedToken, TokenVerifierPort } from '../../domain/ports/auth.port';

export type HttpRouteHandler = (
  event: APIGatewayProxyEventV2,
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

export async function authenticate(
  event: APIGatewayProxyEventV2,
  verifier: TokenVerifierPort,
): Promise<VerifiedToken> {
  const authorization = event.headers.authorization ?? event.headers.Authorization;
  if (!authorization?.startsWith('Bearer ')) {
    throw new HttpError(401, 'A Bearer token is required');
  }

  try {
    return await verifier.verifyJwt(authorization.slice(7).trim());
  } catch {
    throw new HttpError(401, 'The Bearer token is invalid or expired');
  }
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
