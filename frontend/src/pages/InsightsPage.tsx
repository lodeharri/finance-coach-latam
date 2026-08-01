/**
 * InsightsPage — Litografía del Sur.
 *
 * Editorial treatment:
 * - Kicker `TENDENCIAS · 12 MESES` above the page title.
 * - Custom period selector as a strip of mono caps pills (signature: broadsheet
 *   nav, not a dropdown). Active state in cobalt-on-paper.
 * - Asterism captions between sections (already in chart organisms).
 * - Em-dash in the Δ% / Δ abs columns when not yet computed (editorial
 *   restraint: no fake number).
 * - Sortable column heads with `▲` / `▼` markers.
 * - Active-voice empty state with a cobalt underline CTA link to /transactions.
 *
 * 12-month line chart as the visual centerpiece. Sortable breakdown table
 * (total | Δ% | Δ absolute | count). Top 10 merchants (name + amount + count
 * + dominant category pill).
 */
import { useMemo, useState } from 'react';
import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { AmountText } from '@/molecules/AmountText';
import { CategoryPill } from '@/molecules/CategoryPill';
import { Spinner } from '@/atoms/Spinner';
import { sessionStore } from '@/stores/sessionStore';

const MonthlySparkline = lazy(() =>
  import('@/organisms/charts/MonthlySparkline').then((m) => ({ default: m.MonthlySparkline })),
);

import { buildTrendForPeriod } from '@/organisms/charts/MonthlySparkline';

type Period = 'this_month' | 'last_month' | 'last_3' | 'last_6' | 'last_12';
const PERIODS: Array<{ value: Period; label: string; monthCount: number }> = [
  { value: 'this_month', label: 'Este mes', monthCount: 1 },
  { value: 'last_month', label: 'Mes pasado', monthCount: 2 },
  { value: 'last_3', label: 'Últimos 3', monthCount: 3 },
  { value: 'last_6', label: 'Últimos 6', monthCount: 6 },
  { value: 'last_12', label: 'Últimos 12', monthCount: 12 },
];

function periodStart(period: Period, now: Date): Date {
  switch (period) {
    case 'this_month':
      return new Date(now.getFullYear(), now.getMonth(), 1);
    case 'last_month':
      return new Date(now.getFullYear(), now.getMonth() - 1, 1);
    case 'last_3':
      return new Date(now.getFullYear(), now.getMonth() - 2, 1);
    case 'last_6':
      return new Date(now.getFullYear(), now.getMonth() - 5, 1);
    case 'last_12':
      return new Date(now.getFullYear(), now.getMonth() - 11, 1);
  }
}

function periodMonthCount(period: Period): number {
  return PERIODS.find((p) => p.value === period)?.monthCount ?? 6;
}

function ChartSkeleton({ height = 280 }: { height?: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      data-testid="insights-chart-skeleton"
      className="flex items-center justify-center rounded-sm border border-ink-paper-press bg-ink-paper-lift"
      style={{ height }}
    >
      <Spinner aria-label="Loading chart" />
    </div>
  );
}

export interface InsightsPageProps {
  apiBaseUrl: string;
}

type SortKey = 'total' | 'deltaPct' | 'deltaAbs' | 'count';
type SortDir = 'asc' | 'desc';

export function InsightsPage({ apiBaseUrl }: InsightsPageProps) {
  const [period, setPeriod] = useState<Period>('last_6');
  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const session = sessionStore.getState();
  const userId = session.userId;
  const transactions = useTransactions({ apiBaseUrl, userId, limit: 200 });
  const categories = useCategories({ apiBaseUrl });

  const filtered = useMemo(() => {
    const rows = transactions.data ?? [];
    if (rows.length === 0) return rows;
    const start = periodStart(period, new Date());
    return rows.filter((tx) => {
      // Exclude only FAILED — PENDING is real spend the categorizer hasn't
      // labeled yet. Same rule as dashboard-stats.ts so Dashboard MTD and
      // Insights totals never disagree for the same user (REL-001).
      if (tx.status === 'FAILED') return false;
      const occurred = new Date(tx.occurredAt);
      return occurred >= start;
    });
  }, [transactions.data, period]);

  // Breakdown by category.
  const breakdown = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    for (const tx of filtered) {
      const key = tx.categoryId ?? 'uncategorized';
      const cur = map.get(key) ?? { total: 0, count: 0 };
      cur.total += tx.amountCents;
      cur.count += 1;
      map.set(key, cur);
    }
    return [...map.entries()].map(([categoryId, { total, count }]) => {
      const cat = categories.data?.find((c) => c.id === categoryId);
      return {
        categoryId,
        name: cat?.name ?? 'Sin categoría',
        color: cat?.color ?? '#8a8678',
        totalCents: total,
        count,
      };
    });
  }, [filtered, categories.data]);

  const sortedBreakdown = useMemo(() => {
    const arr = [...breakdown];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'total') cmp = a.totalCents - b.totalCents;
      else if (sortKey === 'count') cmp = a.count - b.count;
      cmp = sortDir === 'asc' ? cmp : -cmp;
      return cmp;
    });
    return arr;
  }, [breakdown, sortKey, sortDir]);

  // Top merchants.
  const topMerchants = useMemo(() => {
    const map = new Map<string, { total: number; count: number; categoryIds: Map<string, number> }>();
    for (const tx of filtered) {
      const key = tx.merchant.toLowerCase().trim();
      const cur = map.get(key) ?? { total: 0, count: 0, categoryIds: new Map() };
      cur.total += tx.amountCents;
      cur.count += 1;
      if (tx.categoryId) {
        cur.categoryIds.set(tx.categoryId, (cur.categoryIds.get(tx.categoryId) ?? 0) + 1);
      }
      map.set(key, cur);
    }
    return [...map.entries()]
      .map(([merchant, v]) => {
        const dominantCategoryId = [...v.categoryIds.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const dominant = categories.data?.find((c) => c.id === dominantCategoryId);
        return {
          merchant,
          totalCents: v.total,
          count: v.count,
          categoryId: dominantCategoryId ?? null,
          categoryName: dominant?.name ?? null,
          categoryColor: dominant?.color ?? null,
        };
      })
      .sort((a, b) => b.totalCents - a.totalCents)
      .slice(0, 10);
  }, [filtered, categories.data]);

  // Trailing-window trend, sized to match the selected period so the chart
  // matches what the user picked (Last 6 → 6 buckets, Last 12 → 12, etc.).
  // Same FAILED-excluded / PENDING-included rule as the period filter above
  // and the Dashboard MTD hero (REL-001).
  const trend = useMemo(() => {
    const count = periodMonthCount(period);
    return buildTrendForPeriod(transactions.data ?? [], count, new Date());
  }, [transactions.data, period]);

  return (
    <section className="flex flex-col gap-8">
      <header className="flex flex-col gap-3" data-testid="insights-page-header">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tinta-mute">
          TENDENCIAS · 12 MESES
        </span>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-display text-2xl font-bold text-ink-tinta">Análisis</h1>
        </div>
        <div
          className="flex flex-wrap items-stretch gap-px overflow-hidden rounded-sm border border-ink-paper-press bg-ink-paper-press"
          role="group"
          aria-label="Period"
          data-testid="insights-period"
        >
          {PERIODS.map((p) => {
            const active = period === p.value;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setPeriod(p.value)}
                aria-pressed={active}
                className={
                  'inline-flex flex-1 items-center justify-center px-3 py-2 font-mono text-xs uppercase tracking-[0.2em] ' +
                  'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto ' +
                  (active
                    ? 'bg-ink-cobalto text-ink-paper'
                    : 'bg-ink-paper-lift text-ink-tinta hover:bg-ink-paper')
                }
                data-testid={`period-${p.value}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </header>

      {filtered.length === 0 ? (
        <section
          className="rounded-sm border border-dashed border-ink-paper-press bg-ink-paper-lift p-10 text-center"
          data-testid="insights-empty"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tinta-mute">
            SIN DATOS PARA ESTE PERÍODO
          </p>
          <p className="mt-4 font-display text-2xl italic text-ink-tinta">
            Aún no hay suficiente historia.
          </p>
          <p className="mt-2 font-body text-md text-ink-tinta-soft">
            Registra una transacción para ver aquí la tendencia mensual y el desglose por categoría.
          </p>
          <Link
            to="/transactions"
            className="mt-4 inline-block font-display text-md text-ink-cobalto underline-offset-4 hover:underline"
          >
            Registrar transacción →
          </Link>
        </section>
      ) : (
        <>
          <div>
            <header className="mb-4 flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tinta-mute">
                * * *&nbsp;&nbsp;EJE TEMPORAL · 12 MESES
              </span>
              <h2 className="font-display text-lg font-bold text-ink-tinta">Tendencia de 12 meses</h2>
            </header>
            <Suspense fallback={<ChartSkeleton />}>
              <MonthlySparkline data={trend} height={280} />
            </Suspense>
          </div>

          <div>
            <header className="mb-4 flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tinta-mute">
                * * *&nbsp;&nbsp;DESGLOSE
              </span>
              <h2 className="font-display text-lg font-bold text-ink-tinta">Desglose por categoría</h2>
            </header>
            <table className="w-full border-collapse font-body text-md" data-testid="breakdown-table">
              <thead>
                <tr className="border-b-2 border-ink-tinta text-left">
                  <th
                    scope="col"
                    className="py-2 pr-4 font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta"
                  >
                    Categoría
                  </th>
                  <th
                    scope="col"
                    className="py-2 pr-4 text-right font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta"
                  >
                      <button
                      type="button"
                      onClick={() => {
                        setSortKey('total');
                        setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                      }}
                      className="font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta hover:text-ink-cobalto"
                    >
                      Total {sortKey === 'total' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="py-2 pr-4 text-right font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSortKey('deltaPct');
                        setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                      }}
                      className="font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta hover:text-ink-cobalto"
                    >
                      Δ% {sortKey === 'deltaPct' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="py-2 pr-4 text-right font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSortKey('deltaAbs');
                        setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                      }}
                      className="font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta hover:text-ink-cobalto"
                    >
                      Δ abs {sortKey === 'deltaAbs' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                  <th
                    scope="col"
                    className="py-2 pr-4 text-right font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSortKey('count');
                        setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                      }}
                      className="font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta hover:text-ink-cobalto"
                    >
                      Cantidad {sortKey === 'count' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedBreakdown.map((row) => (
                  <tr
                    key={row.categoryId}
                    className="border-b border-ink-hairline"
                    data-testid={`breakdown-row-${row.categoryId}`}
                  >
                    <td className="py-2 pr-4">
                      <span
                        className="inline-block border-l-4 pl-3"
                        style={{ borderLeftColor: row.color }}
                      >
                        <CategoryPill slug={row.categoryId} name={row.name} color={row.color} />
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <AmountText amountCents={row.totalCents} currency="COP" />
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-sm text-ink-tinta-mute">
                      —
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-sm text-ink-tinta-mute">
                      —
                    </td>
                    <td className="py-2 pr-4 text-right font-mono text-sm text-ink-tinta">
                      {row.count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <header className="mb-4 flex items-baseline justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tinta-mute">
                * * *&nbsp;&nbsp;COMERCIOS TOP
              </span>
              <h2 className="font-display text-lg font-bold text-ink-tinta">Comercios principales</h2>
            </header>
            <ul className="flex flex-col" data-testid="top-merchants">
              {topMerchants.map((m, idx) => (
                <li
                  key={m.merchant}
                  data-testid={`merchant-row-${idx}`}
                  className="grid grid-cols-12 items-center gap-3 border-b border-ink-hairline py-3"
                >
                  <span className="col-span-1 font-mono text-xs text-ink-cobalto">
                    N.º {String(idx + 1).padStart(3, '0')}
                  </span>
                  <span className="col-span-4 font-display text-md text-ink-tinta">{m.merchant}</span>
                  <span className="col-span-3 text-right">
                    <AmountText amountCents={m.totalCents} currency="COP" />
                  </span>
                  <span className="col-span-1 text-right font-mono text-sm text-ink-tinta-mute">
                    {m.count}
                  </span>
                  <span className="col-span-3 text-right">
                    {m.categoryId && m.categoryName && m.categoryColor ? (
                      <CategoryPill slug={m.categoryId} name={m.categoryName} color={m.categoryColor} />
                    ) : (
                      <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-mute">
                        —
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
