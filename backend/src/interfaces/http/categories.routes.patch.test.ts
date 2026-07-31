// RED tests for T8 (categories.routes PATCH/DELETE handlers). These
// scenarios cover the happy path and the role gate for both new
// methods. Other edge cases (empty body, invalid color, FK conflict)
// land in T10 alongside the makeEvent generalization. Each scenario
// here asserts that `createCategoriesRoutes` accepts the new deps
// (CategoriesRoutesDeps) and reaches the use case. Before T8 lands,
// the route falls through to a 405 'Method not allowed' or returns a
// compile-time error because CategoriesRoutesDeps lacks the new
// fields.
import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCategoriesRoutes } from './categories.routes';
import type { CreateCategoryUseCase } from '../../application/use-cases/create-category.use-case';
import type { DeleteCategoryUseCase } from '../../application/use-cases/delete-category.use-case';
import type { ListCategoriesUseCase } from '../../application/use-cases/list-categories.use-case';
import type { UpdateCategoryUseCase } from '../../application/use-cases/update-category.use-case';

type AuthorizerClaims = {
  sub: string;
  email: string;
  'cognito:groups': string[];
};

function makeEvent(
  body: Record<string, unknown> | string | null,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'POST',
  claims: Partial<AuthorizerClaims> = {},
  path = '/categories',
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

const insertedCategory = {
  id: '50000000-0000-4000-8000-000000000001',
  slug: 'transporte',
  name: 'Transporte',
  color: '#1E40AF',
};

const updatedCategory = {
  ...insertedCategory,
  name: 'Transporte público',
};

describe('PATCH /categories/{id} route handler', () => {
  let listCategoriesUseCase: ListCategoriesUseCase;
  let createCategoryUseCase: CreateCategoryUseCase;
  let updateCategoryUseCase: UpdateCategoryUseCase;
  let deleteCategoryUseCase: DeleteCategoryUseCase;
  let handler: ReturnType<typeof createCategoriesRoutes>;

  beforeEach(() => {
    listCategoriesUseCase = {
      execute: vi.fn(),
    } as unknown as ListCategoriesUseCase;
    createCategoryUseCase = {
      execute: vi.fn(),
    } as unknown as CreateCategoryUseCase;
    updateCategoryUseCase = {
      execute: vi.fn().mockImplementation(({ actor }) => {
        if (actor.role !== 'admin') {
          throw new Error('Forbidden: admin role required');
        }
        return Promise.resolve(updatedCategory);
      }),
    } as unknown as UpdateCategoryUseCase;
    deleteCategoryUseCase = {
      execute: vi.fn().mockImplementation(({ actor }) => {
        if (actor.role !== 'admin') {
          throw new Error('Forbidden: admin role required');
        }
        return Promise.resolve(undefined);
      }),
    } as unknown as DeleteCategoryUseCase;
    handler = createCategoriesRoutes({
      listCategoriesUseCase,
      createCategoryUseCase,
      updateCategoryUseCase,
      deleteCategoryUseCase,
    });
  });

  it('PATCH /categories/{id} admin + name returns 200 with the updated row', async () => {
    const result = await handler(
      makeEvent(
        { name: 'Transporte público' },
        'PATCH',
        adminClaims,
        '/categories/50000000-0000-4000-8000-000000000001',
      ),
    );

    expect(result.statusCode).toBe(200);
    expect(bodyOf(result)).toEqual(updatedCategory);
    expect(updateCategoryUseCase.execute).toHaveBeenCalledWith({
      actor: { userId: 'admin-1', email: 'admin@example.com', role: 'admin' },
      id: '50000000-0000-4000-8000-000000000001',
      patch: { name: 'Transporte público' },
    });
  });

  it('PATCH /categories/{id} non-admin returns 403', async () => {
    const result = await handler(
      makeEvent(
        { name: 'X' },
        'PATCH',
        userClaims,
        '/categories/50000000-0000-4000-8000-000000000001',
      ),
    );

    expect(result.statusCode).toBe(403);
    expect(bodyOf(result)).toEqual({ error: 'Forbidden: admin role required' });
  });
});

describe('DELETE /categories/{id} route handler', () => {
  let listCategoriesUseCase: ListCategoriesUseCase;
  let createCategoryUseCase: CreateCategoryUseCase;
  let updateCategoryUseCase: UpdateCategoryUseCase;
  let deleteCategoryUseCase: DeleteCategoryUseCase;
  let handler: ReturnType<typeof createCategoriesRoutes>;

  beforeEach(() => {
    listCategoriesUseCase = {
      execute: vi.fn(),
    } as unknown as ListCategoriesUseCase;
    createCategoryUseCase = {
      execute: vi.fn(),
    } as unknown as CreateCategoryUseCase;
    updateCategoryUseCase = {
      execute: vi.fn(),
    } as unknown as UpdateCategoryUseCase;
    deleteCategoryUseCase = {
      execute: vi.fn().mockImplementation(({ actor }) => {
        if (actor.role !== 'admin') {
          throw new Error('Forbidden: admin role required');
        }
        return Promise.resolve(undefined);
      }),
    } as unknown as DeleteCategoryUseCase;
    handler = createCategoriesRoutes({
      listCategoriesUseCase,
      createCategoryUseCase,
      updateCategoryUseCase,
      deleteCategoryUseCase,
    });
  });

  it('DELETE /categories/{id} admin returns 204', async () => {
    const result = await handler(
      makeEvent(
        null,
        'DELETE',
        adminClaims,
        '/categories/50000000-0000-4000-8000-000000000001',
      ),
    );

    expect(result.statusCode).toBe(204);
    expect(deleteCategoryUseCase.execute).toHaveBeenCalledWith({
      actor: { userId: 'admin-1', email: 'admin@example.com', role: 'admin' },
      id: '50000000-0000-4000-8000-000000000001',
    });
  });

  it('DELETE /categories/{id} non-admin returns 403', async () => {
    const result = await handler(
      makeEvent(
        null,
        'DELETE',
        userClaims,
        '/categories/50000000-0000-4000-8000-000000000001',
      ),
    );

    expect(result.statusCode).toBe(403);
    expect(bodyOf(result)).toEqual({ error: 'Forbidden: admin role required' });
  });
});
