/**
 * RecentTransactionsList organism tests (REQ-FFC-DASH-RECENT-LIST).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { server } from '@/test/setup';
import { RecentTransactionsList } from './RecentTransactionsList';
import { sessionStore } from '@/stores/sessionStore';

const BASE = 'https://api.example.test';

function wrap(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/dashboard" element={node} />
          <Route path="/transactions" element={<div data-testid="transactions-page">Tx page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function tx(overrides: Record<string, unknown>) {
  return {
    id: overrides.id ?? 't1',
    userId: 'u1',
    accountId: 'a1',
    categoryId: 'c1',
    merchant: overrides.merchant ?? 'PedidosYa',
    amountCents: overrides.amountCents ?? 420000,
    occurredAt: overrides.occurredAt ?? '2026-07-15T12:00:00.000Z',
    createdAt: '2026-07-15T12:01:00.000Z',
    status: overrides.status ?? 'CATEGORIZED',
    notes: null,
  };
}

describe('RecentTransactionsList', () => {
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

  it('renders up to 5 rows with ledger "N.º 0001" prefix', async () => {
    server.use(
      http.get(`${BASE}/transactions`, () =>
        HttpResponse.json([
          tx({ id: 'a', merchant: 'Shell' }),
          tx({ id: 'b', merchant: 'YPF' }),
          tx({ id: 'c', merchant: 'Spotify' }),
        ]),
      ),
    );

    wrap(<RecentTransactionsList apiBaseUrl={BASE} />);
    await waitFor(() => expect(screen.getByTestId('recent-list')).toBeInTheDocument());
    expect(screen.getByText(/N.º 0001/)).toBeInTheDocument();
    expect(screen.getByText(/N.º 0002/)).toBeInTheDocument();
    expect(screen.getByText(/N.º 0003/)).toBeInTheDocument();
  });

  it('shows empty state when there are no transactions', async () => {
    server.use(http.get(`${BASE}/transactions`, () => HttpResponse.json([])));
    wrap(<RecentTransactionsList apiBaseUrl={BASE} />);
    await waitFor(() => expect(screen.getByTestId('recent-empty')).toBeInTheDocument());
  });

  it('renders the editorial kicker above the list (signature)', async () => {
    server.use(
      http.get(`${BASE}/transactions`, () => HttpResponse.json([tx({ id: 'a' })])),
    );
    wrap(<RecentTransactionsList apiBaseUrl={BASE} />);
    await waitFor(() => expect(screen.getByTestId('recent-kicker')).toBeInTheDocument());
    expect(screen.getByTestId('recent-kicker').textContent).toMatch(/ACTIVIDAD/);
  });

  it('navigates to /transactions when a row is clicked', async () => {
    server.use(
      http.get(`${BASE}/transactions`, () => HttpResponse.json([tx({ id: 'a' })])),
    );

    wrap(<RecentTransactionsList apiBaseUrl={BASE} />);
    await waitFor(() => expect(screen.getByTestId('recent-row-a')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('recent-row-a').querySelector('button')!);
    expect(screen.getByTestId('transactions-page')).toBeInTheDocument();
  });
});