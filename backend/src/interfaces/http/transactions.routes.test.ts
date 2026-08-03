import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTransactionsRoutes } from './transactions.routes';
import type { CategorizeTransactionUseCase } from '../../application/use-cases/categorize-transaction.use-case';
import type { CreateTransactionUseCase } from '../../application/use-cases/create-transaction.use-case';
import type { GetTransactionByIdUseCase } from '../../application/use-cases/get-transaction-by-id.use-case';
import type { ListTransactionsByUserUseCase } from '../../application/use-cases/list-transactions-by-user.use-case';
import type { UpdateTransactionCategoryUseCase } from '../../application/use-cases/update-transaction.use-case';

type AuthorizerClaims = {
  sub: string;
  email: string;
  'cognito:groups': string[];
};

function makeEvent(
  body: Record<string, unknown> | string | null,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'POST',
  claims: Partial<AuthorizerClaims> = {},
  path = '/transactions',
  queryStringParameters: Record<string, string> | undefined = undefined,
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
    queryStringParameters,
  };
}

function bodyOf(result: { body?: string }): unknown {
  return JSON.parse(result.body ?? '{}');
}

const ownerClaims: AuthorizerClaims = {
  sub: 'user-1',
  email: 'user@example.com',
  'cognito:groups': ['users'],
};

const otherClaims: AuthorizerClaims = {
  sub: 'user-2',
  email: 'other@example.com',
  'cognito:groups': ['users'],
};

const adminClaims: AuthorizerClaims = {
  sub: 'admin-1',
  email: 'admin@example.com',
  'cognito:groups': ['admins'],
};

const ownerActor = { userId: 'user-1', email: 'user@example.com', role: 'user' as const };
const adminActor = { userId: 'admin-1', email: 'admin@example.com', role: 'admin' as const };
const transactionId = '30000000-0000-4000-8000-000000000001';
const categoryId = '40000000-0000-4000-8000-000000000001';

const updatedTransaction = {
  id: transactionId,
  userId: ownerActor.userId,
  accountId: '20000000-0000-4000-8000-000000000001',
  categoryId,
  merchant: 'PedidosYa',
  amount: 4200000,
  occurredAt: '2026-07-15T12:00:00.000Z',
  createdAt: '2026-07-15T12:01:00.000Z',
  status: 'CATEGORIZED',
  notes: null,
};

describe('PATCH /transactions/{id} route handler', () => {
  let createTransactionUseCase: CreateTransactionUseCase;
  let categorizeTransactionUseCase: CategorizeTransactionUseCase;
  let listTransactionsByUserUseCase: ListTransactionsByUserUseCase;
  let updateTransactionCategoryUseCase: UpdateTransactionCategoryUseCase;
  let handler: ReturnType<typeof createTransactionsRoutes>;

  beforeEach(() => {
    createTransactionUseCase = {
      execute: vi.fn(),
    } as unknown as CreateTransactionUseCase;
    categorizeTransactionUseCase = {
      execute: vi.fn(),
    } as unknown as CategorizeTransactionUseCase;
    listTransactionsByUserUseCase = {
      execute: vi.fn(),
    } as unknown as ListTransactionsByUserUseCase;
    // Mirror the use case's contract for ownership: a non-owner non-admin
    // actor surfaces 'Forbidden: users can only act on their own resources';
    // admin always succeeds; the use case throws 'Transaction not found'
    // or 'Category not found' as appropriate.
    updateTransactionCategoryUseCase = {
      execute: vi.fn().mockImplementation(({ actor, transactionId: txId }) => {
        if (actor.role !== 'admin' && actor.userId !== ownerActor.userId) {
          throw new Error('Forbidden: users can only act on their own resources');
        }
        if (txId === 'missing-id') {
          throw new Error('Transaction not found');
        }
        return Promise.resolve(updatedTransaction);
      }),
    } as unknown as UpdateTransactionCategoryUseCase;
    handler = createTransactionsRoutes({
      createTransactionUseCase,
      categorizeTransactionUseCase,
      listTransactionsByUserUseCase,
      updateTransactionCategoryUseCase,
      getTransactionByIdUseCase: { execute: vi.fn() } as unknown as GetTransactionByIdUseCase,
    });
  });

  it('returns 200 for owner override', async () => {
    const result = await handler(
      makeEvent(
        { categoryId },
        'PATCH',
        ownerClaims,
        `/transactions/${transactionId}`,
      ),
    );

    expect(result.statusCode).toBe(200);
    expect(bodyOf(result)).toEqual(updatedTransaction);
    expect(updateTransactionCategoryUseCase.execute).toHaveBeenCalledWith({
      actor: ownerActor,
      transactionId,
      categoryId,
    });
  });

  it('returns 200 for admin override on another user\'s row', async () => {
    // The mock setup keeps ownership tied to ownerActor.userId, so for an
    // admin the use case resolves through and returns the updated row.
    const result = await handler(
      makeEvent(
        { categoryId },
        'PATCH',
        adminClaims,
        `/transactions/${transactionId}`,
      ),
    );

    expect(result.statusCode).toBe(200);
    expect(bodyOf(result)).toEqual(updatedTransaction);
    expect(updateTransactionCategoryUseCase.execute).toHaveBeenCalledWith({
      actor: adminActor,
      transactionId,
      categoryId,
    });
  });

  it('returns 403 for non-owner non-admin', async () => {
    const result = await handler(
      makeEvent(
        { categoryId },
        'PATCH',
        otherClaims,
        `/transactions/${transactionId}`,
      ),
    );

    expect(result.statusCode).toBe(403);
    expect(bodyOf(result)).toEqual({
      error: 'Forbidden: users can only act on their own resources',
    });
  });

  it('returns 404 for unknown transactionId', async () => {
    const result = await handler(
      makeEvent(
        { categoryId },
        'PATCH',
        ownerClaims,
        '/transactions/missing-id',
      ),
    );

    expect(result.statusCode).toBe(404);
    expect(bodyOf(result)).toEqual({ error: 'Transaction not found' });
  });

  it('returns 400 when categoryId is missing from body', async () => {
    const result = await handler(
      makeEvent(
        {},
        'PATCH',
        ownerClaims,
        `/transactions/${transactionId}`,
      ),
    );

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result)).toEqual({
      error: 'Field "categoryId" must be a non-empty string',
    });
    expect(updateTransactionCategoryUseCase.execute).not.toHaveBeenCalled();
  });

  it('returns 400 when categoryId is the empty string', async () => {
    const result = await handler(
      makeEvent(
        { categoryId: '' },
        'PATCH',
        ownerClaims,
        `/transactions/${transactionId}`,
      ),
    );

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result)).toEqual({
      error: 'Field "categoryId" must be a non-empty string',
    });
  });

  it('returns 400 when categoryId is non-string', async () => {
    const result = await handler(
      makeEvent(
        { categoryId: 42 },
        'PATCH',
        ownerClaims,
        `/transactions/${transactionId}`,
      ),
    );

    expect(result.statusCode).toBe(400);
    expect(bodyOf(result)).toEqual({
      error: 'Field "categoryId" must be a non-empty string',
    });
  });

  it('does not treat spoofed userId as authoritative: the route forwards but use case decides', async () => {
    // REQ-FFC-AUTH-TX-OWNER: the route forwards whatever the body says.
    // The use case is responsible for asserting against the row's real
    // userId. A non-owner actor spoofing userId=their-own-id in the body
    // must still be denied because the row belongs to someone else.
    updateTransactionCategoryUseCase.execute = vi
      .fn()
      .mockImplementationOnce(({ actor, transactionId: txId }) => {
        if (actor.role !== 'admin' && actor.userId !== ownerActor.userId) {
          throw new Error('Forbidden: users can only act on their own resources');
        }
        if (txId === 'missing-id') {
          throw new Error('Transaction not found');
        }
        return Promise.resolve(updatedTransaction);
      }) as unknown as UpdateTransactionCategoryUseCase['execute'];

    // Re-create the handler with the freshly-stubbed use case.
    handler = createTransactionsRoutes({
      createTransactionUseCase,
      categorizeTransactionUseCase,
      listTransactionsByUserUseCase,
      updateTransactionCategoryUseCase,
      getTransactionByIdUseCase: { execute: vi.fn() } as unknown as GetTransactionByIdUseCase,
    });

    const result = await handler(
      makeEvent(
        { categoryId, userId: 'user-2' },
        'PATCH',
        otherClaims,
        `/transactions/${transactionId}`,
      ),
    );

    expect(result.statusCode).toBe(403);
    expect(bodyOf(result)).toEqual({
      error: 'Forbidden: users can only act on their own resources',
    });
  });
});

describe('GET /transactions list limit validation', () => {
  let listTransactionsByUserUseCase: ListTransactionsByUserUseCase;
  let handler: ReturnType<typeof createTransactionsRoutes>;

  beforeEach(() => {
    listTransactionsByUserUseCase = {
      execute: vi.fn().mockResolvedValue([]),
    } as unknown as ListTransactionsByUserUseCase;
    handler = createTransactionsRoutes({
      createTransactionUseCase: { execute: vi.fn() } as unknown as CreateTransactionUseCase,
      categorizeTransactionUseCase: { execute: vi.fn() } as unknown as CategorizeTransactionUseCase,
      listTransactionsByUserUseCase,
      updateTransactionCategoryUseCase: { execute: vi.fn() } as unknown as UpdateTransactionCategoryUseCase,
      getTransactionByIdUseCase: { execute: vi.fn() } as unknown as GetTransactionByIdUseCase,
    });
  });

  it('accepts limit=50 (default-ish)', async () => {
    const result = await handler(
      makeEvent(null, 'GET', ownerClaims, '/transactions', { limit: '50', userId: 'user-1' }),
    );
    expect(result.statusCode).toBe(200);
    expect(listTransactionsByUserUseCase.execute).toHaveBeenCalledWith({
      actor: ownerActor,
      userId: 'user-1',
      limit: 50,
    });
  });

  it('accepts limit=100 (legacy boundary, still supported)', async () => {
    const result = await handler(
      makeEvent(null, 'GET', ownerClaims, '/transactions', { limit: '100', userId: 'user-1' }),
    );
    expect(result.statusCode).toBe(200);
  });

  // Regression for the InsightsPage 400 bug: InsightsPage.tsx asks for
  // limit=200 to render a 12-month trend. The backend used to cap at 100,
  // which returned 400 and broke the Insights view entirely.
  it('accepts limit=200 (InsightsPage 12-month trend — bug fix)', async () => {
    const result = await handler(
      makeEvent(null, 'GET', ownerClaims, '/transactions', { limit: '200', userId: 'user-1' }),
    );
    expect(result.statusCode).toBe(200);
    expect(listTransactionsByUserUseCase.execute).toHaveBeenCalledWith({
      actor: ownerActor,
      userId: 'user-1',
      limit: 200,
    });
  });

  it('rejects limit=201 (just above MAX_LIST_LIMIT)', async () => {
    const result = await handler(
      makeEvent(null, 'GET', ownerClaims, '/transactions', { limit: '201', userId: 'user-1' }),
    );
    expect(result.statusCode).toBe(400);
    expect(bodyOf(result)).toEqual({
      error: 'limit must be an integer between 1 and 200',
    });
  });

  it('rejects limit=0 (below minimum)', async () => {
    const result = await handler(
      makeEvent(null, 'GET', ownerClaims, '/transactions', { limit: '0', userId: 'user-1' }),
    );
    expect(result.statusCode).toBe(400);
  });

  it('rejects non-integer limit', async () => {
    const result = await handler(
      makeEvent(null, 'GET', ownerClaims, '/transactions', { limit: 'abc', userId: 'user-1' }),
    );
    expect(result.statusCode).toBe(400);
  });

  it('omitting limit passes through as undefined (use case default)', async () => {
    const result = await handler(
      makeEvent(null, 'GET', ownerClaims, '/transactions', { userId: 'user-1' }),
    );
    expect(result.statusCode).toBe(200);
    expect(listTransactionsByUserUseCase.execute).toHaveBeenCalledWith({
      actor: ownerActor,
      userId: 'user-1',
      limit: undefined,
    });
  });
});

describe('GET /transactions offset query param', () => {
  let listTransactionsByUserUseCase: ListTransactionsByUserUseCase;
  let handler: ReturnType<typeof createTransactionsRoutes>;

  beforeEach(() => {
    listTransactionsByUserUseCase = {
      execute: vi.fn().mockResolvedValue([]),
    } as unknown as ListTransactionsByUserUseCase;
    handler = createTransactionsRoutes({
      createTransactionUseCase: { execute: vi.fn() } as unknown as CreateTransactionUseCase,
      categorizeTransactionUseCase: { execute: vi.fn() } as unknown as CategorizeTransactionUseCase,
      listTransactionsByUserUseCase,
      updateTransactionCategoryUseCase: { execute: vi.fn() } as unknown as UpdateTransactionCategoryUseCase,
      getTransactionByIdUseCase: { execute: vi.fn() } as unknown as GetTransactionByIdUseCase,
    });
  });

  it('forwards offset=0 to the use case when limit is provided', async () => {
    const result = await handler(
      makeEvent(null, 'GET', ownerClaims, '/transactions', {
        limit: '25',
        offset: '0',
        userId: 'user-1',
      }),
    );
    expect(result.statusCode).toBe(200);
    expect(listTransactionsByUserUseCase.execute).toHaveBeenCalledWith({
      actor: ownerActor,
      userId: 'user-1',
      limit: 25,
      offset: 0,
    });
  });

  it('forwards offset=50 to the use case (second page with PAGE_SIZE=25)', async () => {
    const result = await handler(
      makeEvent(null, 'GET', ownerClaims, '/transactions', {
        limit: '25',
        offset: '50',
        userId: 'user-1',
      }),
    );
    expect(result.statusCode).toBe(200);
    expect(listTransactionsByUserUseCase.execute).toHaveBeenCalledWith({
      actor: ownerActor,
      userId: 'user-1',
      limit: 25,
      offset: 50,
    });
  });

  it('passes offset as undefined when omitted (back-compat with existing callers)', async () => {
    const result = await handler(
      makeEvent(null, 'GET', ownerClaims, '/transactions', { limit: '50', userId: 'user-1' }),
    );
    expect(result.statusCode).toBe(200);
    expect(listTransactionsByUserUseCase.execute).toHaveBeenCalledWith({
      actor: ownerActor,
      userId: 'user-1',
      limit: 50,
      offset: undefined,
    });
  });

  it('rejects a negative offset', async () => {
    const result = await handler(
      makeEvent(null, 'GET', ownerClaims, '/transactions', {
        limit: '25',
        offset: '-1',
        userId: 'user-1',
      }),
    );
    expect(result.statusCode).toBe(400);
    expect(bodyOf(result)).toEqual({
      error: 'offset must be a non-negative integer',
    });
  });

  it('rejects a non-integer offset', async () => {
    const result = await handler(
      makeEvent(null, 'GET', ownerClaims, '/transactions', {
        limit: '25',
        offset: 'abc',
        userId: 'user-1',
      }),
    );
    expect(result.statusCode).toBe(400);
    expect(bodyOf(result)).toEqual({
      error: 'offset must be a non-negative integer',
    });
  });
});

describe('GET /transactions/{id} route handler', () => {
  let createTransactionUseCase: CreateTransactionUseCase;
  let categorizeTransactionUseCase: CategorizeTransactionUseCase;
  let listTransactionsByUserUseCase: ListTransactionsByUserUseCase;
  let updateTransactionCategoryUseCase: UpdateTransactionCategoryUseCase;
  let getTransactionByIdUseCase: GetTransactionByIdUseCase;
  let handler: ReturnType<typeof createTransactionsRoutes>;

  const fetchedTransaction = {
    id: transactionId,
    userId: ownerActor.userId,
    accountId: '20000000-0000-4000-8000-000000000001',
    categoryId: null,
    merchant: 'PedidosYa',
    amount: 4200000,
    occurredAt: '2026-07-15T12:00:00.000Z',
    createdAt: '2026-07-15T12:01:00.000Z',
    status: 'PENDING',
    notes: null,
  };

  beforeEach(() => {
    createTransactionUseCase = { execute: vi.fn() } as unknown as CreateTransactionUseCase;
    categorizeTransactionUseCase = { execute: vi.fn() } as unknown as CategorizeTransactionUseCase;
    listTransactionsByUserUseCase = { execute: vi.fn() } as unknown as ListTransactionsByUserUseCase;
    updateTransactionCategoryUseCase = { execute: vi.fn() } as unknown as UpdateTransactionCategoryUseCase;
    // Mirror the use case contract: owner can read, admin can read any,
    // non-owner non-admin is forbidden, missing id is not found.
    getTransactionByIdUseCase = {
      execute: vi.fn().mockImplementation(({ actor, id }) => {
        if (id === 'missing-id') {
          throw new Error('Transaction not found');
        }
        if (actor.role !== 'admin' && actor.userId !== ownerActor.userId) {
          throw new Error('Forbidden: users can only act on their own resources');
        }
        return Promise.resolve(fetchedTransaction);
      }),
    } as unknown as GetTransactionByIdUseCase;
    handler = createTransactionsRoutes({
      createTransactionUseCase,
      categorizeTransactionUseCase,
      listTransactionsByUserUseCase,
      updateTransactionCategoryUseCase,
      getTransactionByIdUseCase,
    });
  });

  it('returns 200 for owner reading their own transaction', async () => {
    const result = await handler(
      makeEvent(null, 'GET', ownerClaims, `/transactions/${transactionId}`),
    );

    expect(result.statusCode).toBe(200);
    expect(bodyOf(result)).toEqual(fetchedTransaction);
    expect(getTransactionByIdUseCase.execute).toHaveBeenCalledWith({
      actor: ownerActor,
      id: transactionId,
    });
  });

  it('returns 200 for admin reading another user\'s transaction', async () => {
    const result = await handler(
      makeEvent(null, 'GET', adminClaims, `/transactions/${transactionId}`),
    );

    expect(result.statusCode).toBe(200);
    expect(bodyOf(result)).toEqual(fetchedTransaction);
    expect(getTransactionByIdUseCase.execute).toHaveBeenCalledWith({
      actor: adminActor,
      id: transactionId,
    });
  });

  it('returns 403 for non-owner non-admin reading another user\'s row', async () => {
    const result = await handler(
      makeEvent(null, 'GET', otherClaims, `/transactions/${transactionId}`),
    );

    expect(result.statusCode).toBe(403);
    expect(bodyOf(result)).toEqual({
      error: 'Forbidden: users can only act on their own resources',
    });
  });

  it('returns 404 for a non-existent transaction id', async () => {
    const result = await handler(
      makeEvent(null, 'GET', ownerClaims, '/transactions/missing-id'),
    );

    expect(result.statusCode).toBe(404);
    expect(bodyOf(result)).toEqual({ error: 'Transaction not found' });
  });
});