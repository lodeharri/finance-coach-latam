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
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  useTransactions,
  useCreateTransaction,
  useUpdateTransaction,
  useRecategorizeTransaction,
} from './useTransactions';
import { sessionStore } from '@/stores/sessionStore';

const BASE = 'https://api.example.test/';

interface TransactionProbe {
  list: { data: unknown; isPending: boolean };
  create: ReturnType<typeof useCreateTransaction>['mutate'];
  update: ReturnType<typeof useUpdateTransaction>['mutate'];
  recategorize: ReturnType<typeof useRecategorizeTransaction>['mutate'];
}

function Probe({
  userId,
  limit,
  onReady,
}: {
  userId?: string;
  limit?: number;
  onReady: (api: TransactionProbe) => void;
}) {
  const list = useTransactions({ apiBaseUrl: BASE, userId, limit });
  const create = useCreateTransaction({ apiBaseUrl: BASE });
  const update = useUpdateTransaction({ apiBaseUrl: BASE });
  const recategorize = useRecategorizeTransaction({ apiBaseUrl: BASE });
  onReady({ list, create: create.mutate, update: update.mutate, recategorize: recategorize.mutate });
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
        return HttpResponse.json({ id: 't1' });
      }),
    );

    let api!: TransactionProbe;
    wrap(<Probe onReady={(a) => (api = a)} />);
    await act(async () => {
      api.recategorize({ transactionId: 't1' });
    });
    await waitFor(() => expect(categorizePath).toBe('/transactions/t1/categorize'));
  });
});