import type { APIGatewayProxyEventV2, APIGatewayProxyHandlerV2 } from 'aws-lambda';
import type { RecordHealthCheckUseCase } from '../../application/use-cases/record-health-check.use-case';
import type { ListHealthChecksUseCase } from '../../application/use-cases/list-health-checks.use-case';
import { getConfig } from '../../infrastructure/config/env.config';

interface HealthDeps {
  recordHealthCheckUseCase: RecordHealthCheckUseCase;
  listHealthChecksUseCase: ListHealthChecksUseCase;
}

const STATIC_CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
} as const;

function readOrigin(headers: APIGatewayProxyEventV2['headers']): string | undefined {
  if (!headers) return undefined;
  const direct = headers['origin'] ?? headers['Origin'];
  if (typeof direct === 'string' && direct.length > 0) return direct;
  return undefined;
}

function corsHeadersFor(
  headers: APIGatewayProxyEventV2['headers'],
): Record<string, string> {
  const base: Record<string, string> = {
    ...STATIC_CORS_HEADERS,
    Vary: 'Origin',
  };
  const origin = readOrigin(headers);
  if (!origin) return base;
  const { allowedOrigins } = getConfig().cors;
  if (allowedOrigins.includes(origin)) {
    base['Access-Control-Allow-Origin'] = origin;
  }
  return base;
}

function jsonResponse(
  statusCode: number,
  body: unknown,
  headers: APIGatewayProxyEventV2['headers'] = {},
): {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
} {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeadersFor(headers),
    },
    body: JSON.stringify(body),
  };
}

export function healthHandler(deps: HealthDeps): APIGatewayProxyHandlerV2 {
  return async (event) => {
    const method = event.requestContext.http.method;
    const path = event.rawPath;
    const headers = event.headers;

    if (method === 'OPTIONS') {
      return jsonResponse(204, null, headers);
    }

    if (path !== '/health') {
      return jsonResponse(
        404,
        { error: 'NotFound', message: `Route ${method} ${path} not found` },
        headers,
      );
    }

    try {
      if (method === 'POST') {
        const rawBody = event.body ?? '{}';
        const payload = JSON.parse(rawBody) as { name?: unknown };

        if (typeof payload.name !== 'string') {
          return jsonResponse(
            400,
            {
              error: 'BadRequest',
              message: 'Body must be JSON with a string field "name".',
            },
            headers,
          );
        }

        const created = await deps.recordHealthCheckUseCase.execute({ name: payload.name });
        return jsonResponse(201, created, headers);
      }

      if (method === 'GET') {
        const items = await deps.listHealthChecksUseCase.execute();
        return jsonResponse(200, items, headers);
      }

      return jsonResponse(
        405,
        { error: 'MethodNotAllowed', message: `Method ${method} not allowed on ${path}` },
        headers,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('healthHandler error:', { method, path, message });
      return jsonResponse(
        500,
        { error: 'InternalServerError', message },
        headers,
      );
    }
  };
}
