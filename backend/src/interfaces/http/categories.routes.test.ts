import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCategoriesRoutes } from './categories.routes';
import type { CreateCategoryUseCase } from '../../application/use-cases/create-category.use-case';
import type { ListCategoriesUseCase } from '../../application/use-cases/list-categories.use-case';

// Convenience shape for the subset of Cognito claims this module cares
// about. Tests use `Partial` to exercise the "missing claim" branches.
type AuthorizerClaims = {
  sub: string;
  email: string;
  'cognito:groups': string[];
};

function makeEvent(
  body: Record<string, unknown> | string | null,
  method: 'GET' | 'POST' = 'POST',
  claims: Partial<AuthorizerClaims> = {},
): APIGatewayProxyEventV2WithJWTAuthorizer {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: '/categories',
    rawQueryString: '',
    headers: {},
    requestContext: {
      accountId: '123456789012',
      apiId: 'api-id',
      domainName: 'api.example.com',
      domainPrefix: 'api',
      http: {
        method,
        path: '/categories',
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

describe('POST /categories route handler', () => {
  let listCategoriesUseCase: ListCategoriesUseCase;
  let createCategoryUseCase: CreateCategoryUseCase;
  let handler: ReturnType<typeof createCategoriesRoutes>;

  beforeEach(() => {
    listCategoriesUseCase = {
      execute: vi.fn(),
    } as unknown as ListCategoriesUseCase;
    // The use case enforces the admin gate internally (assertIsAdmin). The
    // mock mirrors that contract: a non-admin actor surfaces the same
    // forbidden error the production use case would throw, so the route
    // handler's routeError mapping stays realistic.
    createCategoryUseCase = {
      execute: vi.fn().mockImplementation(({ actor }) => {
        if (actor.role !== 'admin') {
          throw new Error('Forbidden: admin role required');
        }
        return Promise.resolve(insertedCategory);
      }),
    } as unknown as CreateCategoryUseCase;
    handler = createCategoriesRoutes({
      listCategoriesUseCase,
      createCategoryUseCase,
    });
  });

  it('GET /categories returns 200 with the list', async () => {
    vi.mocked(listCategoriesUseCase.execute).mockResolvedValueOnce([insertedCategory]);

    const result = await handler(makeEvent(null, 'GET', userClaims));

    expect(result.statusCode).toBe(200);
    expect(bodyOf(result)).toEqual([insertedCategory]);
    expect(createCategoryUseCase.execute).not.toHaveBeenCalled();
  });

  it('POST /categories with admin returns 201 and the inserted category', async () => {
    const result = await handler(
      makeEvent(
        {
          slug: insertedCategory.slug,
          name: insertedCategory.name,
          color: insertedCategory.color,
        },
        'POST',
        adminClaims,
      ),
    );

    expect(result.statusCode).toBe(201);
    expect(bodyOf(result)).toEqual(insertedCategory);
    expect(createCategoryUseCase.execute).toHaveBeenCalledWith({
      actor: { userId: 'admin-1', email: 'admin@example.com', role: 'admin' },
      slug: insertedCategory.slug,
      name: insertedCategory.name,
      color: insertedCategory.color,
    });
  });

  it('POST /categories with non-admin returns 403 with the forbidden message', async () => {
    const result = await handler(
      makeEvent(
        {
          slug: insertedCategory.slug,
          name: insertedCategory.name,
          color: insertedCategory.color,
        },
        'POST',
        userClaims,
      ),
    );

    expect(result.statusCode).toBe(403);
    expect(bodyOf(result)).toEqual({
      error: 'Forbidden: admin role required',
    });
    expect(createCategoryUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it('POST /categories with duplicate slug returns 409', async () => {
    vi.mocked(createCategoryUseCase.execute).mockRejectedValueOnce(
      new Error('Category slug already exists: transporte'),
    );

    const result = await handler(
      makeEvent(
        {
          slug: 'transporte',
          name: 'Otra categoria',
          color: '#10B981',
        },
        'POST',
        adminClaims,
      ),
    );

    expect(result.statusCode).toBe(409);
    expect(bodyOf(result)).toEqual({
      error: 'Category slug already exists: transporte',
    });
  });

  it('POST /categories with missing slug returns 400', async () => {
    const result = await handler(
      makeEvent(
        {
          name: 'Transporte',
          color: '#1E40AF',
        },
        'POST',
        adminClaims,
      ),
    );

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result)).toEqual({
      error: 'Field "slug" must be a non-empty string',
    });
    expect(createCategoryUseCase.execute).not.toHaveBeenCalled();
  });

  it('POST /categories with missing color returns 400', async () => {
    const result = await handler(
      makeEvent(
        {
          slug: 'transporte',
          name: 'Transporte',
        },
        'POST',
        adminClaims,
      ),
    );

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result)).toEqual({
      error: 'Field "color" must be a non-empty string',
    });
  });

  it('POST /categories rejects an invalid hex color at the route with 400 (pre-validation)', async () => {
    const result = await handler(
      makeEvent(
        {
          slug: 'transporte',
          name: 'Transporte',
          color: 'red',
        },
        'POST',
        adminClaims,
      ),
    );

    expect(result.statusCode).toBe(400);
    expect((bodyOf(result) as { error: string }).error).toMatch(/color/);
    expect(createCategoryUseCase.execute).not.toHaveBeenCalled();
  });

  it('POST /categories rejects a short hex code at the route with 400', async () => {
    const result = await handler(
      makeEvent(
        {
          slug: 'transporte',
          name: 'Transporte',
          color: '#FFF',
        },
        'POST',
        adminClaims,
      ),
    );

    expect(result.statusCode).toBe(400);
    expect((bodyOf(result) as { error: string }).error).toMatch(/color/);
  });

  it('returns 401 when claims are missing and no Authorization header is present (no identity can be recovered)', async () => {
    // The route relies on `authenticate()` to derive a verified identity. When
    // claims are not forwarded AND the raw header is absent, there is no token
    // to decode and the request is unauthenticated → 401, not 500. A missing
    // token is a client-side auth failure, not a deploy-time bug.
    const result = await handler(
      makeEvent(
        { slug: 'x', name: 'X', color: '#AABBCC' },
        'POST',
        {},
      ),
    );

    expect(result.statusCode).toBe(401);
    expect(createCategoryUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 401 when cognito:groups claim is absent and no Authorization header is present', async () => {
    // API Gateway may forward sub + email but not the colon-prefixed group
    // claim (the production bug behind this test). With no raw header to
    // decode either, the request is unauthenticated → 401.
    const result = await handler(
      makeEvent(
        { slug: 'x', name: 'X', color: '#AABBCC' },
        'POST',
        {
          sub: 'admin-1',
          email: 'admin@example.com',
        },
      ),
    );

    expect(result.statusCode).toBe(401);
    expect(createCategoryUseCase.execute).not.toHaveBeenCalled();
  });
});