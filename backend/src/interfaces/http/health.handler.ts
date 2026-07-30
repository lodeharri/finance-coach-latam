import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import type { RecordHealthCheckUseCase } from '../../application/use-cases/record-health-check.use-case';
import type { ListHealthChecksUseCase } from '../../application/use-cases/list-health-checks.use-case';

interface HealthDeps {
  recordHealthCheckUseCase: RecordHealthCheckUseCase;
  listHealthChecksUseCase: ListHealthChecksUseCase;
}

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
} as const;

function jsonResponse(statusCode: number, body: unknown): {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
} {
  return {
    statusCode,
    headers: { ...CORS_HEADERS },
    body: JSON.stringify(body),
  };
}

export function healthHandler(deps: HealthDeps): APIGatewayProxyHandlerV2 {
  return async (event) => {
    const method = event.requestContext.http.method;
    const path = event.rawPath;

    if (method === 'OPTIONS') {
      return jsonResponse(204, null);
    }

    if (path !== '/health') {
      return jsonResponse(404, { error: 'NotFound', message: `Route ${method} ${path} not found` });
    }

    try {
      if (method === 'POST') {
        const rawBody = event.body ?? '{}';
        const payload = JSON.parse(rawBody) as { name?: unknown };

        if (typeof payload.name !== 'string') {
          return jsonResponse(400, {
            error: 'BadRequest',
            message: 'Body must be JSON with a string field "name".',
          });
        }

        const created = await deps.recordHealthCheckUseCase.execute({ name: payload.name });
        return jsonResponse(201, created);
      }

      if (method === 'GET') {
        const items = await deps.listHealthChecksUseCase.execute();
        return jsonResponse(200, items);
      }

      return jsonResponse(405, { error: 'MethodNotAllowed', message: `Method ${method} not allowed on ${path}` });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('healthHandler error:', { method, path, message });
      return jsonResponse(500, { error: 'InternalServerError', message });
    }
  };
}
