import type { APIGatewayProxyEventV2 } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCategoriesRoutes } from './categories.routes';
import type { CreateCategoryUseCase } from '../../application/use-cases/create-category.use-case';
import type { ListCategoriesUseCase } from '../../application/use-cases/list-categories.use-case';
import type { TokenVerifierPort } from '../../domain/ports/auth.port';

function makeEvent(
  body: Record<string, unknown> | string | null,
  method: 'GET' | 'POST' = 'POST',
): APIGatewayProxyEventV2 {
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: '/categories',
    rawQueryString: '',
    headers: { authorization: 'Bearer admin-token' },
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
    },
    body: body === null ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
    isBase64Encoded: false,
  };
}

function bodyOf(result: { body?: string }): unknown {
  return JSON.parse(result.body ?? '{}');
}

const adminToken = {
  userId: 'admin-1',
  role: 'admin' as const,
  email: 'admin@example.com',
};

const userToken = {
  userId: 'user-1',
  role: 'user' as const,
  email: 'user@example.com',
};

const insertedCategory = {
  id: '50000000-0000-4000-8000-000000000001',
  slug: 'transporte',
  name: 'Transporte',
  color: '#1E40AF',
};

describe('POST /categories route handler', () => {
  let tokenVerifier: TokenVerifierPort;
  let listCategoriesUseCase: ListCategoriesUseCase;
  let createCategoryUseCase: CreateCategoryUseCase;
  let handler: ReturnType<typeof createCategoriesRoutes>;

  beforeEach(() => {
    tokenVerifier = {
      verifyJwt: vi.fn(),
    };
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
      tokenVerifier,
      listCategoriesUseCase,
      createCategoryUseCase,
    });
  });

  it('GET /categories returns 200 with the list', async () => {
    vi.mocked(tokenVerifier.verifyJwt).mockResolvedValueOnce(userToken);
    vi.mocked(listCategoriesUseCase.execute).mockResolvedValueOnce([insertedCategory]);

    const result = await handler(makeEvent(null, 'GET'));

    expect(result.statusCode).toBe(200);
    expect(bodyOf(result)).toEqual([insertedCategory]);
    expect(createCategoryUseCase.execute).not.toHaveBeenCalled();
  });

  it('POST /categories with admin returns 201 and the inserted category', async () => {
    vi.mocked(tokenVerifier.verifyJwt).mockResolvedValueOnce(adminToken);

    const result = await handler(
      makeEvent({
        slug: insertedCategory.slug,
        name: insertedCategory.name,
        color: insertedCategory.color,
      }),
    );

    expect(result.statusCode).toBe(201);
    expect(bodyOf(result)).toEqual(insertedCategory);
    expect(createCategoryUseCase.execute).toHaveBeenCalledWith({
      actor: adminToken,
      slug: insertedCategory.slug,
      name: insertedCategory.name,
      color: insertedCategory.color,
    });
  });

  it('POST /categories with non-admin returns 403 with the forbidden message', async () => {
    vi.mocked(tokenVerifier.verifyJwt).mockResolvedValueOnce(userToken);

    const result = await handler(
      makeEvent({
        slug: insertedCategory.slug,
        name: insertedCategory.name,
        color: insertedCategory.color,
      }),
    );

    expect(result.statusCode).toBe(403);
    expect(bodyOf(result)).toEqual({
      error: 'Forbidden: admin role required',
    });
    expect(createCategoryUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it('POST /categories with duplicate slug returns 409', async () => {
    vi.mocked(tokenVerifier.verifyJwt).mockResolvedValueOnce(adminToken);
    vi.mocked(createCategoryUseCase.execute).mockRejectedValueOnce(
      new Error('Category slug already exists: transporte'),
    );

    const result = await handler(
      makeEvent({
        slug: 'transporte',
        name: 'Otra categoria',
        color: '#10B981',
      }),
    );

    expect(result.statusCode).toBe(409);
    expect(bodyOf(result)).toEqual({
      error: 'Category slug already exists: transporte',
    });
  });

  it('POST /categories with missing slug returns 400', async () => {
    vi.mocked(tokenVerifier.verifyJwt).mockResolvedValueOnce(adminToken);

    const result = await handler(
      makeEvent({
        name: 'Transporte',
        color: '#1E40AF',
      }),
    );

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result)).toEqual({
      error: 'Field "slug" must be a non-empty string',
    });
    expect(createCategoryUseCase.execute).not.toHaveBeenCalled();
  });

  it('POST /categories with missing color returns 400', async () => {
    vi.mocked(tokenVerifier.verifyJwt).mockResolvedValueOnce(adminToken);

    const result = await handler(
      makeEvent({
        slug: 'transporte',
        name: 'Transporte',
      }),
    );

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result)).toEqual({
      error: 'Field "color" must be a non-empty string',
    });
  });

  it('POST /categories rejects an invalid hex color at the route with 400 (pre-validation)', async () => {
    vi.mocked(tokenVerifier.verifyJwt).mockResolvedValueOnce(adminToken);

    const result = await handler(
      makeEvent({
        slug: 'transporte',
        name: 'Transporte',
        color: 'red',
      }),
    );

    expect(result.statusCode).toBe(400);
    expect((bodyOf(result) as { error: string }).error).toMatch(/color/);
    expect(createCategoryUseCase.execute).not.toHaveBeenCalled();
  });

  it('POST /categories rejects a short hex code at the route with 400', async () => {
    vi.mocked(tokenVerifier.verifyJwt).mockResolvedValueOnce(adminToken);

    const result = await handler(
      makeEvent({
        slug: 'transporte',
        name: 'Transporte',
        color: '#FFF',
      }),
    );

    expect(result.statusCode).toBe(400);
    expect((bodyOf(result) as { error: string }).error).toMatch(/color/);
  });

  it('returns 401 when the bearer token is missing', async () => {
    const event = makeEvent({ slug: 'x', name: 'X', color: '#AABBCC' });
    const headers = event.headers as Record<string, string>;
    delete headers.authorization;

    const result = await handler(event);

    expect(result.statusCode).toBe(401);
    expect(createCategoryUseCase.execute).not.toHaveBeenCalled();
  });
});