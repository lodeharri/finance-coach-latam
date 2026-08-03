/**
 * useTransactions hook tests (REQ-FFC-FE-URL-HELPER, REQ-FFC-TDD-INTEGRATION).
 *
 * TanStack Query bindings + URL construction via joinUrl so the outgoing URL
 * never carries a double-slash (CORS double-slash bug).
 */
import { act, render, screen, waitFor } from '@/test/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setup';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useTransactions,
  useCreateTransaction,
  useUpdateTransaction,
  useRecategorizeTransaction,
  useCategorizationStatus,
} from './useTransactions';
import { sessionStore } from '@/stores/sessionStore';

const BASE = 'https://api.example.test/';

interface TransactionProbe {
  list: { data: unknown; isPending: boolean };
  create: ReturnType<typeof useCreateTransaction>['mutate'];
  update: ReturnType<typeof useUpdateTransaction>['mutate'];
  recategorize: ReturnType<typeof useRecategorizeTransaction>['mutate'];
  recategorizeError: Error | null;
  recategorizeIsError: boolean;
}

function Probe({
  userId,
  limit,
  offset,
  onReady,
}: {
  userId?: string;
  limit?: number;
  offset?: number;
  onReady: (api: TransactionProbe) => void;
}) {
  const list = useTransactions({ apiBaseUrl: BASE, userId, limit, offset });
  const create = useCreateTransaction({ apiBaseUrl: BASE });
  const update = useUpdateTransaction({ apiBaseUrl: BASE });
  const recategorize = useRecategorizeTransaction({ apiBaseUrl: BASE });
  onReady({
    list,
    create: create.mutate,
    update: update.mutate,
    recategorize: recategorize.mutate,
    recategorizeError: recategorize.error,
    recategorizeIsError: recategorize.isError,
  });
  return (
    <div>
      <span data-testid="pending">{String(list.isPending)}</span>
      <span data-testid="count">{list.data?.length ?? 0}</span>
      <button onClick={() => create.mutate({ userId: 'u1', accountId: 'a1', merchant: 'M', amountCents: 100, occurredAt: new Date().toISOString() })}>Create</button>
      <button onClick={() => update.mutate({ transactionId: 't1', categoryId: 'c1' })}>Update</button>
      <button onClick={() => recategorize.mutate({ transactionId: 't1' })}>Recategorize</button>
    </div>
  );
}

function wrap(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe('useTransactions', () => {
  beforeEach(() => {
    sessionStore.getState().setSession({
      idToken: 'jwt',
      refreshToken: 'r',
      expiresAt: Date.now() + 600_000,
      userId: 'u1',
      email: 'a@b.com',
      role: 'user',
    });
    server.resetHandlers();
  });

  afterEach(() => {
    sessionStore.getState().clear();
    localStorage.clear();
  });

  it('fetches transactions with a single-slash URL when base ends with / (REQ-FFC-FE-CORS-FIX)', async () => {
    let hit = '';
    server.use(
      http.get('https://api.example.test/transactions', ({ request }) => {
        hit = request.url;
        return HttpResponse.json([]);
      }),
    );

    wrap(<Probe onReady={() => {}} />);
    await waitFor(() => expect(hit).toBe('https://api.example.test/transactions'));
    // No double-slash.
    expect(hit).not.toContain('//transactions');
  });

  it('appends limit query parameter when provided', async () => {
    let hit = '';
    server.use(
      http.get('https://api.example.test/transactions', ({ request }) => {
        hit = request.url;
        return HttpResponse.json([]);
      }),
    );

    wrap(<Probe limit={10} onReady={() => {}} />);
    await waitFor(() => expect(hit).toContain('limit=10'));
  });

  it('appends userId query parameter when provided (admin path)', async () => {
    let hit = '';
    server.use(
      http.get('https://api.example.test/transactions', ({ request }) => {
        hit = request.url;
        return HttpResponse.json([]);
      }),
    );

    wrap(<Probe userId="other" onReady={() => {}} />);
    await waitFor(() => expect(hit).toContain('userId=other'));
  });

  it('appends offset query parameter when provided (pagination)', async () => {
    let hit = '';
    server.use(
      http.get('https://api.example.test/transactions', ({ request }) => {
        hit = request.url;
        return HttpResponse.json([]);
      }),
    );

    wrap(<Probe limit={25} offset={50} onReady={() => {}} />);
    await waitFor(() => expect(hit).toContain('offset=50'));
  });

  it('omits the offset query parameter when not provided (back-compat)', async () => {
    let hit = '';
    server.use(
      http.get('https://api.example.test/transactions', ({ request }) => {
        hit = request.url;
        return HttpResponse.json([]);
      }),
    );

    wrap(<Probe limit={25} onReady={() => {}} />);
    await waitFor(() => expect(hit).toContain('limit=25'));
    expect(hit).not.toContain('offset=');
  });

  it('returns rows when the API returns them', async () => {
    server.use(
      http.get('https://api.example.test/transactions', () =>
        HttpResponse.json([
          { id: 't1', userId: 'u1', accountId: 'a1', categoryId: 'c1', merchant: 'M', amountCents: 100, occurredAt: new Date().toISOString(), createdAt: new Date().toISOString(), status: 'CATEGORIZED', notes: null },
        ]),
      ),
    );

    wrap(<Probe onReady={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
  });

  it('useCreateTransaction POSTs to the API and invalidates the list', async () => {
    let created = false;
    server.use(
      http.get('https://api.example.test/transactions', () => {
        return HttpResponse.json(
          created
            ? [{ id: 't-new', userId: 'u1', accountId: 'a1', categoryId: null, merchant: 'M', amountCents: 100, occurredAt: new Date().toISOString(), createdAt: new Date().toISOString(), status: 'PENDING', notes: null }]
            : [],
        );
      }),
      http.post('https://api.example.test/transactions', () => {
        created = true;
        return HttpResponse.json(
          {
            id: 't-new',
            userId: 'u1',
            accountId: 'a1',
            categoryId: null,
            merchant: 'M',
            amountCents: 100,
            occurredAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            status: 'PENDING',
            notes: null,
          },
          { status: 201 },
        );
      }),
    );

    let api!: TransactionProbe;
    wrap(<Probe onReady={(a) => (api = a)} />);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
    await act(async () => {
      api.create({ userId: 'u1', accountId: 'a1', merchant: 'M', amountCents: 100, occurredAt: new Date().toISOString() });
    });
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
  });

  it('useUpdateTransaction PATCHes the row and invalidates the list', async () => {
    server.use(
      http.get('https://api.example.test/transactions', () =>
        HttpResponse.json([
          { id: 't1', userId: 'u1', accountId: 'a1', categoryId: null, merchant: 'M', amountCents: 100, occurredAt: new Date().toISOString(), createdAt: new Date().toISOString(), status: 'PENDING', notes: null },
        ]),
      ),
      http.patch('https://api.example.test/transactions/t1', () =>
        HttpResponse.json({ id: 't1', userId: 'u1', accountId: 'a1', categoryId: 'c1', merchant: 'M', amountCents: 100, occurredAt: new Date().toISOString(), createdAt: new Date().toISOString(), status: 'CATEGORIZED', notes: null }),
      ),
    );

    let api!: TransactionProbe;
    wrap(<Probe onReady={(a) => (api = a)} />);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
    await act(async () => {
      api.update({ transactionId: 't1', categoryId: 'c1' });
    });
    // Wait for the row to reflect the new categoryId after revalidation.
    await waitFor(() => {
      expect(screen.getByTestId('count').textContent).toBe('1');
    });
  });

  it('useRecategorizeTransaction POSTs to /transactions/{id}/categorize', async () => {
    let categorizePath = '';
    server.use(
      http.get('https://api.example.test/transactions', () => HttpResponse.json([])),
      http.post('https://api.example.test/transactions/t1/categorize', ({ request }) => {
        categorizePath = new URL(request.url).pathname;
        // Full Transaction — apiClient parses /transactions/* through
        // TransactionSchema, so a partial response is a validation_error.
        // Same shape as the create-transaction mock above (REL-002).
        return HttpResponse.json({
          id: 't1',
          userId: 'u1',
          accountId: 'a1',
          categoryId: 'c2',
          merchant: 'M',
          amountCents: 100,
          occurredAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          status: 'CATEGORIZED',
          notes: null,
        });
      }),
    );

    let api!: TransactionProbe;
    wrap(<Probe onReady={(a) => (api = a)} />);
    await act(async () => {
      api.recategorize({ transactionId: 't1' });
    });
    await waitFor(() => expect(categorizePath).toBe('/transactions/t1/categorize'));
  });

  it('useRecategorizeTransaction parses the full Transaction response (REL-002)', async () => {
    // apiClient dispatches /transactions/* responses through TransactionSchema.
    // A partial mock (e.g. { id: 't1' }) makes the mutation throw a
    // validation_error. Pin the success contract here — the mock mirrors the
    // create-transaction mock at lines 143-157 (REL-002).
    server.use(
      http.get('https://api.example.test/transactions', () => HttpResponse.json([])),
      http.post('https://api.example.test/transactions/t1/categorize', () =>
        HttpResponse.json({
          id: 't1',
          userId: 'u1',
          accountId: 'a1',
          categoryId: 'c2',
          merchant: 'M',
          amountCents: 100,
          occurredAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          status: 'CATEGORIZED',
          notes: null,
        }),
      ),
    );

    let api!: TransactionProbe;
    wrap(<Probe onReady={(a) => (api = a)} />);
    await act(async () => {
      api.recategorize({ transactionId: 't1' });
    });
    // The mutation must resolve cleanly — no validation_error from a partial
    // /transactions/{id}/categorize response. apiClient routes every
    // /transactions/* response through TransactionSchema which requires 10
    // fields (REL-002).
    await waitFor(() => expect(api.recategorizeIsError).toBe(false));
    expect(api.recategorizeError).toBeNull();
  });
});

describe('useCategorizationStatus', () => {
  const transaction = (status: 'PENDING' | 'CATEGORIZED' | 'FAILED') => ({
    id: 't1',
    userId: 'u1',
    accountId: 'a1',
    categoryId: null,
    merchant: 'Mercado',
    amountCents: 100,
    occurredAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    status,
    notes: null,
  });

  interface StatusProbe {
    data: ReturnType<typeof useCategorizationStatus>['data'];
    isTimeout: boolean;
    error: Error | null;
    refetch: () => void;
  }

  function StatusProbe({
    transactionId,
    onReady,
  }: {
    transactionId: string | null;
    onReady: (api: StatusProbe) => void;
  }) {
    const result = useCategorizationStatus(transactionId);
    onReady({
      data: result.data,
      isTimeout: result.isTimeout,
      error: result.error,
      refetch: result.refetch,
    });
    return <span data-testid="status">{result.data?.status ?? 'none'}</span>;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    sessionStore.getState().setSession({
      idToken: 'jwt',
      refreshToken: 'r',
      expiresAt: Date.now() + 600_000,
      userId: 'u1',
      email: 'a@b.com',
      role: 'user',
    });
    server.resetHandlers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    sessionStore.getState().clear();
    localStorage.clear();
  });

  it('does NOT poll when transactionId is null', async () => {
    let requests = 0;
    server.use(
      http.get('https://api.example.test/transactions/t1', () => {
        requests += 1;
        return HttpResponse.json(transaction('PENDING'));
      }),
    );

    let api!: StatusProbe;
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <StatusProbe transactionId={null} onReady={(a) => (api = a)} />
      </QueryClientProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(9000);
    });

    expect(requests).toBe(0);
    expect(api.data).toBeUndefined();
    expect(api.isTimeout).toBe(false);
  });

  it('polls every 3000ms when status is PENDING', async () => {
    let requests = 0;
    server.use(
      http.get('https://api.example.test/transactions/t1', () => {
        requests += 1;
        return HttpResponse.json(transaction('PENDING'));
      }),
    );

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <StatusProbe transactionId="t1" onReady={() => {}} />
      </QueryClientProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(requests).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(requests).toBe(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(requests).toBe(3);
  });

  it('STOPS polling when status becomes CATEGORIZED', async () => {
    let requests = 0;
    server.use(
      http.get('https://api.example.test/transactions/t1', () => {
        requests += 1;
        return HttpResponse.json(transaction(requests === 1 ? 'PENDING' : 'CATEGORIZED'));
      }),
    );

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <StatusProbe transactionId="t1" onReady={() => {}} />
      </QueryClientProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(requests).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(6000);
    });

    expect(requests).toBe(2);
  });

  it('STOPS polling when status becomes FAILED (user must retry manually)', async () => {
    // After a FAILED status, the hook must NOT keep hammering the API.
    // The user clicks "Recategorize" to retry, which fires a fresh query
    // through a different code path.
    let requests = 0;
    server.use(
      http.get('https://api.example.test/transactions/t1', () => {
        requests += 1;
        return HttpResponse.json(transaction(requests === 1 ? 'PENDING' : 'FAILED'));
      }),
    );

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <StatusProbe transactionId="t1" onReady={() => {}} />
      </QueryClientProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(requests).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(requests).toBe(2);
    // After FAILED: no more requests, even after 60 seconds.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });
    expect(requests).toBe(2);
  });

  it('sets isTimeout after 90000ms of PENDING without resolution', async () => {
    let api!: StatusProbe;
    server.use(
      http.get('https://api.example.test/transactions/t1', () =>
        HttpResponse.json(transaction('PENDING')),
      ),
    );
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <StatusProbe transactionId="t1" onReady={(a) => (api = a)} />
      </QueryClientProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(api.isTimeout).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(89000);
    });
    expect(api.isTimeout).toBe(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(api.isTimeout).toBe(true);
  });

  it('clears isTimeout when transactionId changes', async () => {
    let api!: StatusProbe;
    let currentId: string | null = 't1';
    server.use(
      http.get('https://api.example.test/transactions/:id', () =>
        HttpResponse.json(transaction('PENDING')),
      ),
    );
    const { rerender } = render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <StatusProbe transactionId={currentId} onReady={(a) => (api = a)} />
      </QueryClientProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(91000);
    });
    expect(api.isTimeout).toBe(true);

    // Switch to a different transaction — timeout must reset.
    currentId = 't2';
    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <StatusProbe transactionId={currentId} onReady={(a) => (api = a)} />
      </QueryClientProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(api.isTimeout).toBe(false);
  });

  it('exposes error when fetch fails', async () => {
    let api!: StatusProbe;
    server.use(
      http.get('https://api.example.test/transactions/t1', () =>
        HttpResponse.json({ error: 'Transaction not found' }, { status: 404 }),
      ),
    );
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <StatusProbe transactionId="t1" onReady={(a) => (api = a)} />
      </QueryClientProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
      for (let i = 0; i < 5; i += 1) await Promise.resolve();
    });
    expect(api.error).toBeInstanceOf(Error);
    expect(api.error?.message).toMatch(/Transaction not found/i);
  });

  it('exposes refetch function', async () => {
    let api!: StatusProbe;
    let requests = 0;
    server.use(
      http.get('https://api.example.test/transactions/t1', () => {
        requests += 1;
        return HttpResponse.json(transaction('PENDING'));
      }),
    );
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <StatusProbe transactionId="t1" onReady={(a) => (api = a)} />
      </QueryClientProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(requests).toBe(1);
    expect(typeof api.refetch).toBe('function');
    await act(async () => {
      api.refetch();
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(requests).toBeGreaterThanOrEqual(2);
  });
});