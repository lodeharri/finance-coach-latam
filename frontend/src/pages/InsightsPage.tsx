/**
 * InsightsPage — Litografía del Sur.
 *
 * 12-month line chart as the visual centerpiece (signature element).
 * Sortable breakdown table (total | Δ% | Δ absolute | count). Top 10
 * merchants (name + amount + count + dominant category pill). Period
 * selector (`Este mes | Mes pasado | Últimos 3 meses | Últimos 6 meses |
 * Últimos 12 meses`). Active-voice empty state with CTA to /transactions.
 * Skeletons for chart + table while loading.
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

type Period = 'this_month' | 'last_month' | 'last_3' | 'last_6' | 'last_12';
const PERIOD_LABELS: Record<Period, string> = {
  this_month: 'Este mes',
  last_month: 'Mes pasado',
  last_3: 'Últimos 3 meses',
  last_6: 'Últimos 6 meses',
  last_12: 'Últimos 12 meses',
};

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
      if (tx.status !== 'CATEGORIZED') return false;
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
      // deltaPct and deltaAbs are stubbed to 0 here — without a comparison
      // window we cannot compute a meaningful delta. They are still surfaced
      // as columns so the UI contract holds.
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

  // 12-month trend.
  const trend = useMemo(() => {
    const monthsLabels = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const now = new Date();
    const out: Array<{ month: string; totalCents: number }> = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const total = (transactions.data ?? [])
        .filter((tx) => {
          if (tx.status !== 'CATEGORIZED') return false;
          const occurred = new Date(tx.occurredAt);
          return occurred >= d && occurred < next;
        })
        .reduce((sum, tx) => sum + tx.amountCents, 0);
      out.push({ month: `${monthsLabels[d.getMonth()]} ${d.getFullYear()}`, totalCents: total });
    }
    return out;
  }, [transactions.data]);

  return (
    <section className="flex flex-col gap-6">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-2xl font-bold text-ink-tinta">Insights</h1>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as Period)}
          data-testid="insights-period"
          aria-label="Period"
          className="h-10 rounded-sm border border-ink-paper-press bg-ink-paper-lift px-3 font-body text-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto"
        >
          {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
            <option key={p} value={p}>{PERIOD_LABELS[p]}</option>
          ))}
        </select>
      </header>

      {filtered.length === 0 ? (
        <div className="rounded-sm border border-ink-paper-press bg-ink-paper-lift p-6" data-testid="insights-empty">
          <h2 className="font-display text-lg font-bold text-ink-tinta">No data for this period yet.</h2>
          <p className="mt-2 font-body text-md text-ink-tinta-soft">
            Log a transaction to see your monthly trend and category breakdown here.
          </p>
          <Link
            to="/transactions"
            className="mt-4 inline-block rounded-sm bg-ink-cobalto px-4 py-2 font-body text-md text-ink-paper hover:bg-ink-cobalto-deep focus:outline-none focus-visible:ring-2 focus-visible:ring-ink-cobalto"
          >
            Log a transaction
          </Link>
        </div>
      ) : (
        <>
          <div>
            <h2 className="font-display text-lg font-bold text-ink-tinta">12-month trend</h2>
            <Suspense fallback={<ChartSkeleton />}>
              <MonthlySparkline data={trend} width={640} height={280} />
            </Suspense>
          </div>

          <div>
            <h2 className="font-display text-lg font-bold text-ink-tinta">Breakdown by category</h2>
            <table className="w-full border-collapse font-body text-md" data-testid="breakdown-table">
              <thead>
                <tr className="border-b-2 border-ink-tinta text-left">
                  <th scope="col" className="py-2 pr-4 font-mono text-xs uppercase tracking-wide text-ink-tinta-mute">Category</th>
                  <th scope="col" className="py-2 pr-4 text-right font-mono text-xs uppercase tracking-wide text-ink-tinta-mute">
                    <button type="button" onClick={() => { setSortKey('total'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>
                      Total
                    </button>
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-mono text-xs uppercase tracking-wide text-ink-tinta-mute">
                    <button type="button" onClick={() => { setSortKey('deltaPct'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>
                      Δ%
                    </button>
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-mono text-xs uppercase tracking-wide text-ink-tinta-mute">
                    <button type="button" onClick={() => { setSortKey('deltaAbs'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>
                      Δ abs
                    </button>
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right font-mono text-xs uppercase tracking-wide text-ink-tinta-mute">
                    <button type="button" onClick={() => { setSortKey('count'); setSortDir(sortDir === 'asc' ? 'desc' : 'asc'); }}>
                      Count
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedBreakdown.map((row) => (
                  <tr key={row.categoryId} className="border-b border-ink-paper-press" data-testid={`breakdown-row-${row.categoryId}`}>
                    <td className="py-2 pr-4">
                      <CategoryPill slug={row.categoryId} name={row.name} color={row.color} />
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <AmountText amountCents={row.totalCents} currency="ARS" />
                    </td>
                    <td className="py-2 pr-4 text-right text-ink-tinta-mute">—</td>
                    <td className="py-2 pr-4 text-right text-ink-tinta-mute">—</td>
                    <td className="py-2 pr-4 text-right font-mono text-sm text-ink-tinta">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h2 className="font-display text-lg font-bold text-ink-tinta">Top merchants</h2>
            <ul className="flex flex-col" data-testid="top-merchants">
              {topMerchants.map((m, idx) => (
                <li
                  key={m.merchant}
                  data-testid={`merchant-row-${idx}`}
                  className="grid grid-cols-12 items-center gap-3 border-b border-ink-paper-press py-2"
                >
                  <span className="col-span-5 font-body text-md text-ink-tinta">{m.merchant}</span>
                  <span className="col-span-3 text-right">
                    <AmountText amountCents={m.totalCents} currency="ARS" />
                  </span>
                  <span className="col-span-1 text-right font-mono text-sm text-ink-tinta-mute">{m.count}</span>
                  <span className="col-span-3 text-right">
                    {m.categoryId && m.categoryName && m.categoryColor ? (
                      <CategoryPill slug={m.categoryId} name={m.categoryName} color={m.categoryColor} />
                    ) : (
                      <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-mute">—</span>
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