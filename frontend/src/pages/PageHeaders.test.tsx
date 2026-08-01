/**
 * Page header editorial treatment tests.
 *
 * Pages don't have their own colocated test files (they're tested via
 * integration in the e2e layer), but the editorial header treatment
 * (mono kicker, row count strip, asterism captions, period selector strip)
 * is the signature. Each page renders these via small header subtrees, so
 * we test them here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@/test/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { server } from '@/test/setup';
import { TransactionsPage } from './TransactionsPage';
import { AccountsPage } from './AccountsPage';
import { UsersAdminPage } from './UsersAdminPage';
import { InsightsPage } from './InsightsPage';
import { sessionStore } from '@/stores/sessionStore';

const BASE = 'https://api.example.test';

function wrap(node: React.ReactNode, initialPath = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialPath]}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Editorial page headers', () => {
  beforeEach(() => {
    sessionStore.getState().setSession({
      idToken: 'jwt',
      refreshToken: 'r',
      expiresAt: Date.now() + 600_000,
      userId: 'u1',
      email: 'a@b.com',
      role: 'admin',
    });
    server.resetHandlers();
    server.use(
      http.get(`${BASE}/transactions`, () => HttpResponse.json([])),
      http.get(`${BASE}/categories`, () => HttpResponse.json([])),
      http.get(`${BASE}/accounts`, () => HttpResponse.json([])),
      http.get(`${BASE}/users`, () => HttpResponse.json([])),
      http.get(`${BASE}/stats/u1`, () => HttpResponse.json({ mtdSpendCents: 0, topCategories: [], pendingCount: 0, failedCount: 0 })),
    );
  });

  afterEach(() => {
    sessionStore.getState().clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('TransactionsPage renders the LIBRO DIARIO kicker', async () => {
    wrap(<TransactionsPage apiBaseUrl={BASE} />, '/transactions');
    const header = await screen.findByTestId('transactions-page-header');
    expect(header.textContent).toMatch(/LIBRO DIARIO/);
  });

  it('TransactionsPage renders the row count strip in mono', async () => {
    wrap(<TransactionsPage apiBaseUrl={BASE} />, '/transactions');
    const count = await screen.findByTestId('row-count');
    expect(count.textContent).toMatch(/MOVIMIENTOS/);
  });

  it('TransactionsPage renders the Spanish "Mis transacciones" heading', async () => {
    wrap(<TransactionsPage apiBaseUrl={BASE} />, '/transactions');
    const header = await screen.findByTestId('transactions-page-header');
    expect(header.textContent).toMatch(/Mis transacciones/);
  });

  it('TransactionsPage renders a pagination control below the table', async () => {
    wrap(<TransactionsPage apiBaseUrl={BASE} />, '/transactions');
    const pagination = await screen.findByTestId('pagination');
    expect(pagination).toBeInTheDocument();
  });

  it('TransactionsPage shows "Mostrando N · PÁGINA X" range indicator', async () => {
    server.use(
      http.get(`${BASE}/transactions`, () =>
        HttpResponse.json(
          Array.from({ length: 25 }).map((_, i) => ({
            id: `t${i}`,
            userId: 'u1',
            accountId: 'a1',
            categoryId: 'c1',
            merchant: `M${i}`,
            amountCents: 1000 * (i + 1),
            occurredAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            status: 'CATEGORIZED',
            notes: null,
          })),
        ),
      ),
    );
    wrap(<TransactionsPage apiBaseUrl={BASE} />, '/transactions');
    await screen.findByTestId('pagination');
    const range = await screen.findByTestId('transactions-range');
    await waitFor(() => {
      expect(range.textContent).toMatch(/Mostrando/);
      expect(range.textContent).toMatch(/1–25/);
    });
  });

  it('clicking Next re-fetches the next page with the new offset', async () => {
    const seenOffsets = new Set<string>();
    server.use(
      http.get(`${BASE}/transactions`, ({ request }) => {
        seenOffsets.add(new URL(request.url).searchParams.get('offset') ?? '');
        return HttpResponse.json(
          Array.from({ length: 25 }).map((_, i) => ({
            id: `t${seenOffsets.size}-${i}`,
            userId: 'u1',
            accountId: 'a1',
            categoryId: 'c1',
            merchant: `M${i}`,
            amountCents: 1000 * (i + 1),
            occurredAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            status: 'CATEGORIZED',
            notes: null,
          })),
        );
      }),
    );
    wrap(<TransactionsPage apiBaseUrl={BASE} />, '/transactions');
    await waitFor(() => {
      const range = screen.getByTestId('transactions-range');
      expect(range.textContent).toMatch(/1–25/);
    });
    const next = screen.getByTestId('pagination-next') as HTMLButtonElement;
    expect(next).not.toBeDisabled();
    await act(async () => {
      next.click();
    });
    await waitFor(() => {
      const offsets = [...seenOffsets];
      expect(offsets).toContain('0');
      expect(offsets).toContain('25');
    });
  });

  it('AccountsPage renders the RELACIÓN DE CUENTAS kicker', async () => {
    wrap(<AccountsPage apiBaseUrl={BASE} />, '/accounts');
    const header = await screen.findByTestId('accounts-page-header');
    expect(header.textContent).toMatch(/RELACIÓN DE CUENTAS/);
  });

  it('AccountsPage renders N.º xxx · CUENTAS row count strip', async () => {
    wrap(<AccountsPage apiBaseUrl={BASE} />, '/accounts');
    const count = await screen.findByTestId('row-count');
    expect(count.textContent).toMatch(/N.º \d+ · CUENTAS/);
  });

  it('AccountsPage renders the Spanish "Mis cuentas" heading', async () => {
    wrap(<AccountsPage apiBaseUrl={BASE} />, '/accounts');
    const header = await screen.findByTestId('accounts-page-header');
    expect(header.textContent).toMatch(/Mis cuentas/);
  });

  it('UsersAdminPage renders the DIRECTORIO kicker', async () => {
    wrap(<UsersAdminPage apiBaseUrl={BASE} />, '/admin/users');
    const header = await screen.findByTestId('users-page-header');
    expect(header.textContent).toMatch(/DIRECTORIO/);
  });

  it('InsightsPage renders the TENDENCIAS kicker', async () => {
    wrap(<InsightsPage apiBaseUrl={BASE} />, '/insights');
    const header = await screen.findByTestId('insights-page-header');
    expect(header.textContent).toMatch(/TENDENCIAS/);
  });

  it('InsightsPage renders the period selector as a mono caps strip (signature)', async () => {
    wrap(<InsightsPage apiBaseUrl={BASE} />, '/insights');
    const strip = await screen.findByTestId('insights-period');
    // The strip is a role=group with 5 buttons.
    expect(strip.getAttribute('role')).toBe('group');
    expect(screen.getByTestId('period-this_month').textContent).toMatch(/Este mes/);
    expect(screen.getByTestId('period-last_12').textContent).toMatch(/Últimos 12/);
    // Active period (default last_6) shows in cobalt.
    const active = screen.getByTestId('period-last_6');
    expect(active).toHaveAttribute('aria-pressed', 'true');
    expect(active.className).toMatch(/bg-ink-cobalto/);
  });
});
