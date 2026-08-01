/**
 * useAccounts hook tests (REQ-FFC-ACC-LIST, REQ-FFC-TDD-INTEGRATION).
 *
 * TanStack Query bindings + joinUrl URL construction.
 */
import { act, render, screen, waitFor } from '@/test/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setup';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useAccounts, useCreateAccount } from './useAccounts';
import { sessionStore } from '@/stores/sessionStore';

const BASE = 'https://api.example.test/';

interface AccountProbe {
  list: { data: unknown; isPending: boolean };
  create: ReturnType<typeof useCreateAccount>['mutate'];
}

function Probe({
  userId,
  onReady,
}: {
  userId?: string;
  onReady: (api: AccountProbe) => void;
}) {
  const list = useAccounts({ apiBaseUrl: BASE, userId });
  const create = useCreateAccount({ apiBaseUrl: BASE });
  onReady({ list, create: create.mutate });
  return (
    <div>
      <span data-testid="pending">{String(list.isPending)}</span>
      <span data-testid="count">{list.data?.length ?? 0}</span>
      <button onClick={() => create.mutate({ userId: 'u1', name: 'Checking', type: 'BANK' })}>Create</button>
    </div>
  );
}

function wrap(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

describe('useAccounts', () => {
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

  it('fetches accounts with single-slash URL', async () => {
    let hit = '';
    server.use(
      http.get('https://api.example.test/accounts', ({ request }) => {
        hit = request.url;
        return HttpResponse.json([]);
      }),
    );

    wrap(<Probe onReady={() => {}} />);
    await waitFor(() => expect(hit).toBe('https://api.example.test/accounts'));
    expect(hit).not.toContain('//accounts');
  });

  it('appends userId query parameter on the admin path', async () => {
    let hit = '';
    server.use(
      http.get('https://api.example.test/accounts', ({ request }) => {
        hit = request.url;
        return HttpResponse.json([]);
      }),
    );

    wrap(<Probe userId="other" onReady={() => {}} />);
    await waitFor(() => expect(hit).toContain('userId=other'));
  });

  it('returns rows when the API returns them', async () => {
    server.use(
      http.get('https://api.example.test/accounts', () =>
        HttpResponse.json([
          { id: 'a1', userId: 'u1', name: 'Checking', type: 'BANK', createdAt: new Date().toISOString() },
        ]),
      ),
    );

    wrap(<Probe onReady={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
  });

  it('useCreateAccount POSTs to the API and invalidates the list', async () => {
    let created = false;
    server.use(
      http.get('https://api.example.test/accounts', () =>
        HttpResponse.json(
          created
            ? [{ id: 'a-new', userId: 'u1', name: 'Checking', type: 'BANK', createdAt: new Date().toISOString() }]
            : [],
        ),
      ),
      http.post('https://api.example.test/accounts', () => {
        created = true;
        return HttpResponse.json(
          { id: 'a-new', userId: 'u1', name: 'Checking', type: 'BANK', createdAt: new Date().toISOString() },
          { status: 201 },
        );
      }),
    );

    let api!: AccountProbe;
    wrap(<Probe onReady={(a) => (api = a)} />);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('0'));
    await act(async () => {
      api.create({ userId: 'u1', name: 'Checking', type: 'BANK' });
    });
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('1'));
  });
});