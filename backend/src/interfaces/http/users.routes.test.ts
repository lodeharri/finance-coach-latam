import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createUsersRoutes } from './users.routes';
import type { CreateUserUseCase } from '../../application/use-cases/create-user.use-case';
import type { DeleteUserUseCase } from '../../application/use-cases/delete-user.use-case';
import type { ListUsersUseCase } from '../../application/use-cases/list-users.use-case';

type AuthorizerClaims = {
  sub: string;
  email: string;
  'cognito:groups': string[];
};

function makeEvent(
  body: Record<string, unknown> | string | null,
  method: 'GET' | 'POST' | 'DELETE',
  claims: Partial<AuthorizerClaims> = {},
  path = '/users',
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: path,
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      domainName: 'api.example.com',
      domainPrefix: 'api',
      http: {
        method,
        path,
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
    body: body === null ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    isBase64Encoded: false,
  };
}

function bodyOf(result: { body?: string }): unknown {
  return JSON.parse(result.body ?? '{}');
}

const adminClaims: AuthorizerClaims = {
  sub: 'admin-1',
  email: 'admin@example.com',
  'cognito:groups': ['admins'],
};

const userClaims: AuthorizerClaims = {
  sub: 'user-1',
  email: 'user@example.com',
  'cognito:groups': ['users'],
};

const targetUserId = '22222222-2222-4222-8222-222222222222';

describe('DELETE /users/{id} route handler', () => {
  let listUsersUseCase: ListUsersUseCase;
  let createUserUseCase: CreateUserUseCase;
  let deleteUserUseCase: DeleteUserUseCase;
  let handler: ReturnType<typeof createUsersRoutes>;

  beforeEach(() => {
    listUsersUseCase = { execute: vi.fn() } as unknown as ListUsersUseCase;
    createUserUseCase = { execute: vi.fn() } as unknown as CreateUserUseCase;
    deleteUserUseCase = { execute: vi.fn() } as unknown as DeleteUserUseCase;
    handler = createUsersRoutes({
      listUsersUseCase,
      createUserUseCase,
      deleteUserUseCase,
    });
  });

  it('returns 204 and calls DeleteUserUseCase when admin targets another user', async () => {
    vi.mocked(deleteUserUseCase.execute).mockResolvedValueOnce(undefined);

    const event = makeEvent(null, 'DELETE', adminClaims, `/users/${targetUserId}`);
    const result = await handler(event);

    expect(result.statusCode).toBe(204);
    expect(deleteUserUseCase.execute).toHaveBeenCalledWith({
      actor: { userId: 'admin-1', email: 'admin@example.com', role: 'admin' },
      id: targetUserId,
    });
  });

  it('returns 403 when a non-admin actor tries to delete', async () => {
    // The use case enforces admin via assertIsAdmin which throws a
    // 'Forbidden: admin role required' Error; routeError maps that prefix
    // to 403 (mirrors the categories PATCH/DELETE pattern).
    vi.mocked(deleteUserUseCase.execute).mockRejectedValueOnce(
      new Error('Forbidden: admin role required'),
    );

    const event = makeEvent(null, 'DELETE', userClaims, `/users/${targetUserId}`);
    const result = await handler(event);

    expect(result.statusCode).toBe(403);
    expect(bodyOf(result)).toEqual({ error: 'Forbidden: admin role required' });
    expect(deleteUserUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it('surfaces "Forbidden: cannot delete your own account" as 403', async () => {
    vi.mocked(deleteUserUseCase.execute).mockRejectedValueOnce(
      new Error('Forbidden: cannot delete your own account'),
    );

    const event = makeEvent(null, 'DELETE', adminClaims, `/users/${adminClaims.sub}`);
    const result = await handler(event);

    expect(result.statusCode).toBe(403);
    expect(bodyOf(result)).toEqual({
      error: 'Forbidden: cannot delete your own account',
    });
  });

  it('surfaces "User not found" as 404', async () => {
    vi.mocked(deleteUserUseCase.execute).mockRejectedValueOnce(new Error('User not found'));

    const event = makeEvent(null, 'DELETE', adminClaims, `/users/${targetUserId}`);
    const result = await handler(event);

    expect(result.statusCode).toBe(404);
    expect(bodyOf(result)).toEqual({ error: 'User not found' });
  });

  it('returns 405 when DELETE is sent to the collection root', async () => {
    const event = makeEvent(null, 'DELETE', adminClaims, '/users');
    const result = await handler(event);

    expect(result.statusCode).toBe(405);
    expect(deleteUserUseCase.execute).not.toHaveBeenCalled();
  });
});
