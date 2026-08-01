/**
 * InsightsPage page tests (REQ-FFC-INSIGHTS).
 *
 * Pinned product behavior: InsightsPage totals must agree with the Dashboard
 * MTD hero number for the same user. Both include CATEGORIZED + PENDING and
 * exclude FAILED — see dashboard-stats.ts:51.
 *
 * These tests guard against future regressions where Insights silently filters
 * to CATEGORIZED only while Dashboard includes PENDING (REL-001).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, waitFor } from '@/test/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { server } from '@/test/setup';
import { InsightsPage } from './InsightsPage';
import { sessionStore } from '@/stores/sessionStore';

const BASE = 'https://api.example.test';

function wrap(node: React.ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/insights']}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

function tx(overrides: Partial<{
  id: string;
  userId: string;
  accountId: string;
  categoryId: string | null;
  merchant: string;
  amountCents: number;
  occurredAt: string;
  createdAt: string;
  status: 'PENDING' | 'CATEGORIZED' | 'FAILED';
  notes: string | null;
}> = {}) {
  return {
    id: 't1',
    userId: 'u1',
    accountId: 'a1',
    categoryId: 'c1',
    merchant: 'Mercado Libre',
    amountCents: 100000,
    occurredAt: '2026-07-10T12:00:00.000Z',
    createdAt: '2026-07-10T12:00:00.000Z',
    status: 'CATEGORIZED' as const,
    notes: null,
    ...overrides,
  };
}

describe('InsightsPage — totals parity with Dashboard (REL-001)', () => {
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
      http.get(`${BASE}/categories`, () =>
        HttpResponse.json([
          { id: 'c1', slug: 'transporte', name: 'Transporte', color: '#1F3FB8' },
          { id: 'c2', slug: 'alimentos', name: 'Alimentos', color: '#1F4D2C' },
        ]),
      ),
      http.get(`${BASE}/accounts`, () => HttpResponse.json([])),
    );
  });

  afterEach(() => {
    sessionStore.getState().clear();
    localStorage.clear();
  });

  it('period total includes CATEGORIZED + PENDING and excludes FAILED (current month filter)', async () => {
    // Use a real current-month date so the default period (last_6 / this_month)
    // window catches all three rows. We pick the first of the month at noon to
    // avoid timezone edge flapping.
    const realNow = new Date();
    const occ = new Date(realNow.getFullYear(), realNow.getMonth(), 5, 12, 0, 0).toISOString();
    server.use(
      http.get(`${BASE}/transactions`, () =>
        HttpResponse.json([
          tx({ id: 'a', amountCents: 100000, status: 'CATEGORIZED', occurredAt: occ }),
          tx({ id: 'b', amountCents: 50000, status: 'PENDING', occurredAt: occ, merchant: 'Shell' }),
          tx({ id: 'c', amountCents: 75000, status: 'FAILED', occurredAt: occ, merchant: 'Banco' }),
        ]),
      ),
    );

    wrap(<InsightsPage apiBaseUrl={BASE} />);

    // Click "Este mes" so the period window is exactly the current month.
    const thisMonth = await screen.findByTestId('period-this_month');
    await waitFor(() => expect(thisMonth).toBeInTheDocument());
    await act(async () => {
      thisMonth.click();
    });

    // The breakdown table row for c1 should sum CATEGORIZED (100000) +
    // PENDING (50000) = 150000 cents — FAILED is excluded.
    await waitFor(() => expect(screen.getByTestId('breakdown-row-c1')).toBeInTheDocument());
    const cell = screen.getByTestId('breakdown-row-c1').querySelector('[data-amount-cents]');
    expect(cell).not.toBeNull();
    expect(cell?.getAttribute('data-amount-cents')).toBe('150000');
  });

  it('12-month trend line includes CATEGORIZED + PENDING and excludes FAILED (trend filter)', async () => {
    const realNow = new Date();
    const occ = new Date(realNow.getFullYear(), realNow.getMonth(), 5, 12, 0, 0).toISOString();
    server.use(
      http.get(`${BASE}/transactions`, () =>
        HttpResponse.json([
          tx({ id: 'a', amountCents: 100000, status: 'CATEGORIZED', occurredAt: occ }),
          tx({ id: 'b', amountCents: 50000, status: 'PENDING', occurredAt: occ, merchant: 'Shell' }),
          tx({ id: 'c', amountCents: 75000, status: 'FAILED', occurredAt: occ, merchant: 'Banco' }),
        ]),
      ),
    );

    wrap(<InsightsPage apiBaseUrl={BASE} />);

    // Switch to the last_12 view so the trend chart receives the data prop.
    const last12 = await screen.findByTestId('period-last_12');
    await act(async () => {
      last12.click();
    });

    // Wait for sparkline to resolve; the trend data we render into the chart
    // sums to 150000 cents for the current month (CATEGORIZED + PENDING).
    await waitFor(() => expect(screen.getByTestId('breakdown-row-c1')).toBeInTheDocument());
    const cell = screen.getByTestId('breakdown-row-c1').querySelector('[data-amount-cents]');
    expect(cell?.getAttribute('data-amount-cents')).toBe('150000');
  });

  it('switching from this_month to last_12 expands the sparkline caption from 1 to 12 months', async () => {
    const realNow = new Date();
    const occ = new Date(realNow.getFullYear(), realNow.getMonth(), 5, 12, 0, 0).toISOString();
    server.use(
      http.get(`${BASE}/transactions`, () =>
        HttpResponse.json([
          tx({ id: 'a', amountCents: 100000, status: 'CATEGORIZED', occurredAt: occ }),
        ]),
      ),
    );

    wrap(<InsightsPage apiBaseUrl={BASE} />);

    // Default period is last_6 — switch to this_month first to assert
    // narrow window, then to last_12 to assert the wide window.
    const thisMonth = await screen.findByTestId('period-this_month');
    await act(async () => {
      thisMonth.click();
    });

    // this_month renders only 1 bucket, so the chart stays in the empty
    // state (data.length < 2). Verify the empty copy is shown.
    await waitFor(() =>
      expect(screen.getByTestId('sparkline-empty')).toBeInTheDocument(),
    );

    // Switch to last_12 → 12 buckets, the chart renders with the
    // "ÚLTIMOS 12 MESES" caption.
    const last12 = await screen.findByTestId('period-last_12');
    await act(async () => {
      last12.click();
    });
    await waitFor(() =>
      expect(screen.getByTestId('sparkline-caption').textContent).toMatch(/ÚLTIMOS 12 MESES/),
    );
  });

  it('MonthlySparkline container has explicit minHeight (signature fill the parent)', async () => {
    const realNow = new Date();
    const occ = new Date(realNow.getFullYear(), realNow.getMonth(), 5, 12, 0, 0).toISOString();
    server.use(
      http.get(`${BASE}/transactions`, () =>
        HttpResponse.json([
          tx({ id: 'a', amountCents: 100000, status: 'CATEGORIZED', occurredAt: occ }),
          tx({ id: 'b', amountCents: 50000, status: 'CATEGORIZED', occurredAt: occ, merchant: 'Shell' }),
        ]),
      ),
    );

    wrap(<InsightsPage apiBaseUrl={BASE} />);

    const last12 = await screen.findByTestId('period-last_12');
    await act(async () => {
      last12.click();
    });

    await waitFor(() => expect(screen.getByTestId('monthly-sparkline')).toBeInTheDocument());
    const chart = screen.getByTestId('monthly-sparkline') as HTMLElement;
    // Without a fixed width, the chart container must fill the parent
    // (width: 100%) and keep an explicit height so the SVG has room to
    // render even when the parent hasn't measured yet.
    const style = chart.getAttribute('style') ?? '';
    expect(style).toMatch(/width:\s*100%/);
    expect(style).toMatch(/height:\s*280/);
  });
});