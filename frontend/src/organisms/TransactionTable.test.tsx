/**
 * TransactionTable organism tests (REQ-FFC-TX-LIST, REQ-FFC-TX-OVERRIDE,
 * REQ-FFC-TX-CATEGORIZE-BUTTON, REQ-FFC-TX-AMOUNT-DISPLAY).
 *
 * Colocated because the organism has rendering + interaction logic
 * (signature ledger line numbers, status chip, override dropdown,
 * recategorize button, optimistic update plumbing).
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/setup';
import { TransactionTable } from './TransactionTable';
import { sessionStore } from '@/stores/sessionStore';

const BASE = 'https://api.example.test';

function wrap(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
}

const categories = [
  { id: 'c1', slug: 'transporte', name: 'Transporte', color: '#1F3FB8' },
  { id: 'c2', slug: 'alimentos', name: 'Alimentos', color: '#1F4D2C' },
];

function tx(overrides: Partial<{ id: string; merchant: string; amountCents: number; categoryId: string | null; status: 'PENDING' | 'CATEGORIZED' | 'FAILED'; occurredAt: string }> = {}) {
  return {
    id: overrides.id ?? 't1',
    userId: 'u1',
    accountId: 'a1',
    categoryId: overrides.categoryId !== undefined ? overrides.categoryId : 'c1',
    merchant: overrides.merchant ?? 'PedidosYa',
    amountCents: overrides.amountCents ?? 420000,
    occurredAt: overrides.occurredAt ?? '2026-07-15T12:00:00.000Z',
    createdAt: '2026-07-15T12:01:00.000Z',
    status: overrides.status ?? 'CATEGORIZED',
    notes: null,
  };
}

describe('TransactionTable', () => {
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
    server.use(
      http.get(`${BASE}/categories`, () => HttpResponse.json(categories)),
    );
  });

  afterEach(() => {
    sessionStore.getState().clear();
    localStorage.clear();
  });

  it('renders the ledger "N.º 0042" prefix on each row (signature element)', async () => {
    wrap(
      <TransactionTable
        apiBaseUrl={BASE}
        rows={[tx({ id: 't1' }), tx({ id: 't2' }), tx({ id: 't3' })]}
        categories={categories}
        onOverride={() => {}}
        onRecategorize={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('transaction-table')).toBeInTheDocument());
    expect(screen.getByText(/N.º 0001/)).toBeInTheDocument();
    expect(screen.getByText(/N.º 0002/)).toBeInTheDocument();
    expect(screen.getByText(/N.º 0003/)).toBeInTheDocument();
  });

  it('renders an empty state when there are no rows', () => {
    wrap(
      <TransactionTable
        apiBaseUrl={BASE}
        rows={[]}
        categories={categories}
        onOverride={() => {}}
        onRecategorize={() => {}}
      />,
    );
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('renders a status chip for CATEGORIZED, PENDING, FAILED rows', async () => {
    wrap(
      <TransactionTable
        apiBaseUrl={BASE}
        rows={[
          tx({ id: 'a', status: 'CATEGORIZED' }),
          tx({ id: 'b', status: 'PENDING', categoryId: null }),
          tx({ id: 'c', status: 'FAILED', categoryId: null }),
        ]}
        categories={categories}
        onOverride={() => {}}
        onRecategorize={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('transaction-table')).toBeInTheDocument());
    expect(screen.getByText('CATEGORIZADO')).toBeInTheDocument();
    expect(screen.getByText('PENDIENTE')).toBeInTheDocument();
    expect(screen.getByText('FALLIDO')).toBeInTheDocument();
  });

  it('renders the Recategorizar button only for PENDING|FAILED rows', async () => {
    wrap(
      <TransactionTable
        apiBaseUrl={BASE}
        rows={[tx({ id: 'a', status: 'CATEGORIZED' }), tx({ id: 'b', status: 'PENDING', categoryId: null })]}
        categories={categories}
        onOverride={() => {}}
        onRecategorize={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('transaction-table')).toBeInTheDocument());
    const buttons = screen.getAllByRole('button', { name: /recategorizar/i });
    expect(buttons).toHaveLength(1);
  });

  it('renders currency-formatted amount via AmountText (es-CO COP)', async () => {
    wrap(
      <TransactionTable
        apiBaseUrl={BASE}
        rows={[tx({ amountCents: 420000 })]}
        categories={categories}
        onOverride={() => {}}
        onRecategorize={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('transaction-table')).toBeInTheDocument());
    // 420000 cents = $ 4.200 in es-CO COP (Intl auto-formats with or without trailing decimals).
    expect(screen.getByText(/4\.200/)).toBeInTheDocument();
  });

  it('clicking the category pill opens the override dropdown', async () => {
    wrap(
      <TransactionTable
        apiBaseUrl={BASE}
        rows={[tx({ id: 't1' })]}
        categories={categories}
        onOverride={() => {}}
        onRecategorize={() => {}}
      />,
    );
    await waitFor(() => expect(screen.getByText('Transporte')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /cambiar categoría de pedidosya/i }));
    await waitFor(() => expect(screen.getByRole('listbox')).toBeInTheDocument());
  });

  it('clicking Recategorizar invokes onRecategorize with the row id', async () => {
    let captured: string | undefined;
    wrap(
      <TransactionTable
        apiBaseUrl={BASE}
        rows={[tx({ id: 't1', status: 'PENDING', categoryId: null })]}
        categories={categories}
        onOverride={() => {}}
        onRecategorize={(id) => (captured = id)}
      />,
    );
    await waitFor(() => expect(screen.getByTestId('transaction-table')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /recategorizar/i }));
    expect(captured).toBe('t1');
  });

  it('renders loading state when isLoading=true', () => {
    wrap(
      <TransactionTable
        apiBaseUrl={BASE}
        rows={[]}
        categories={categories}
        onOverride={() => {}}
        onRecategorize={() => {}}
        isLoading
      />,
    );
    expect(screen.getByRole('status')).toHaveAttribute('aria-busy', 'true');
  });
});