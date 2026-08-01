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
import { render, screen } from '@/test/test-utils';
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
