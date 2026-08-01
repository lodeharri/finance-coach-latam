/**
 * DashboardPage test — Litografía del Sur (REQ-FFC-DASH-*).
 *
 * Verifies the editorial header treatment: mono kicker, hero number on the
 * StatsCard, mono ordinals on the compact stats cards, asterism section
 * captions.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { MemoryRouter } from 'react-router-dom';
import { server } from '@/test/setup';
import { DashboardPage } from './DashboardPage';
import { sessionStore } from '@/stores/sessionStore';

const BASE = 'https://api.example.test';

function wrap(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/dashboard']}>{node}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardPage', () => {
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
      http.get(`${BASE}/stats/u1`, () =>
        HttpResponse.json({
          mtdSpendCents: 420000,
          topCategories: [
            { categoryId: 'c1', name: 'Alimentos', color: '#1F4D2C', totalCents: 220000 },
          ],
          pendingCount: 3,
          failedCount: 1,
        }),
      ),
      http.get(`${BASE}/categories`, () => HttpResponse.json([])),
      http.get(`${BASE}/transactions`, () => HttpResponse.json([])),
    );
  });

  afterEach(() => {
    sessionStore.getState().clear();
    localStorage.clear();
  });

  it('renders the editorial kicker above the page title', async () => {
    wrap(<DashboardPage apiBaseUrl={BASE} />);
    const header = screen.getByTestId('dashboard-page-header');
    expect(header.textContent).toMatch(/TABLERO/);
  });

  it('renders the hero stats card with text-4xl display font', async () => {
    wrap(<DashboardPage apiBaseUrl={BASE} />);
    await waitFor(() => expect(screen.getByTestId('stats-card-hero-number')).toBeInTheDocument());
    const hero = screen.getByTestId('stats-card-hero-number');
    expect(hero.className).toMatch(/text-4xl/);
    expect(hero.className).toMatch(/font-display/);
  });

  it('renders the cobalt left strip on every stats card (signature)', async () => {
    wrap(<DashboardPage apiBaseUrl={BASE} />);
    const cards = await screen.findAllByTestId('stats-card');
    cards.forEach((c) => {
      expect(c.className).toMatch(/border-l-4/);
      expect(c.className).toMatch(/border-ink-cobalto/);
    });
  });

  it('renders mono ordinals on the compact stats cards', async () => {
    wrap(<DashboardPage apiBaseUrl={BASE} />);
    const ordinals = await screen.findAllByTestId('stats-card-ordinal');
    expect(ordinals.length).toBeGreaterThanOrEqual(4);
    expect(ordinals.map((o) => o.textContent)).toEqual(
      expect.arrayContaining(['N.º 01 · HERO', 'N.º 02', 'N.º 03', 'N.º 04']),
    );
  });

  it('renders the Spanish labels: "Gasto del mes", "Categoría principal", "Pendientes", "Fallidos"', async () => {
    wrap(<DashboardPage apiBaseUrl={BASE} />);
    const cards = await screen.findAllByTestId('stats-card');
    expect(cards.length).toBeGreaterThanOrEqual(4);
    // The labels are rendered as the uppercased mono kicker on each card.
    expect(cards.some((c) => /gasto del mes/i.test(c.textContent ?? ''))).toBe(true);
    expect(cards.some((c) => /categoría principal/i.test(c.textContent ?? ''))).toBe(true);
    expect(cards.some((c) => /pendientes/i.test(c.textContent ?? ''))).toBe(true);
    expect(cards.some((c) => /fallidos/i.test(c.textContent ?? ''))).toBe(true);
  });

  it('renders asterism section captions for the chart sections', async () => {
    wrap(<DashboardPage apiBaseUrl={BASE} />);
    // The captions live in the chart organisms (SpendDonut / MonthlySparkline).
    // Wait for both charts to resolve.
    await waitFor(() => expect(screen.getByTestId('spend-donut-caption')).toBeInTheDocument());
    expect(screen.getByTestId('spend-donut-caption').textContent).toMatch(/POR CATEGORÍA/);
    await waitFor(() => expect(screen.getByTestId('sparkline-caption')).toBeInTheDocument());
    expect(screen.getByTestId('sparkline-caption').textContent).toMatch(/MESES/);
  });
});
