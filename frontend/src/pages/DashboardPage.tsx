/**
 * DashboardPage — Litografía del Sur.
 *
 * Editorial treatment:
 * - Kicker `TABLERO · ENERO 2026` in mono caps above the page title.
 * - Hero number at text-4xl (104 px) with cobalt 4 px left rule (signature).
 * - Mono ordinals `N.º 02`, `N.º 03`, `N.º 04` on compact stats cards.
 * - Asterism captions on the donut and sparkline charts (already in chart
 *   organisms).
 * - Section heads in mono caps tracking-2em.
 *
 * The big number stays the signature element. Skeletons replace spinners for
 * the chart + recent list during loading (REQ-FFC-DASH-LOADING). Charts are
 * React.lazy so the chart code splits into its own chunk.
 */
import { lazy, Suspense } from 'react';
import { useDashboardStats } from '@/hooks/useDashboardStats';
import { useCategories } from '@/hooks/useCategories';
import { useTransactions } from '@/hooks/useTransactions';
import { sessionStore } from '@/stores/sessionStore';
import { StatsCard } from '@/organisms/StatsCard';
import { RecentTransactionsList } from '@/organisms/RecentTransactionsList';
import { Spinner } from '@/atoms/Spinner';
import type { SpendDonutDatum } from '@/organisms/charts/SpendDonut';

const SpendDonut = lazy(() =>
  import('@/organisms/charts/SpendDonut').then((m) => ({ default: m.SpendDonut })),
);
const MonthlySparkline = lazy(() =>
  import('@/organisms/charts/MonthlySparkline').then((m) => ({ default: m.MonthlySparkline })),
);

function ChartSkeleton({ height = 240 }: { height?: number }) {
  return (
    <div
      role="status"
      aria-busy="true"
      data-testid="chart-skeleton"
      className="flex items-center justify-center rounded-sm border border-ink-paper-press bg-ink-paper-lift"
      style={{ height }}
    >
      <Spinner aria-label="Loading chart" />
    </div>
  );
}

function SectionHead({ kicker, children }: { kicker: string; children: React.ReactNode }) {
  return (
    <header className="mb-3 flex items-baseline justify-between">
      <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tinta-mute">
        {kicker}
      </span>
      <h2 className="font-display text-lg font-bold text-ink-tinta">{children}</h2>
    </header>
  );
}

export interface DashboardPageProps {
  apiBaseUrl: string;
}

const MONTHS_ES = [
  'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
  'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE',
];

export function DashboardPage({ apiBaseUrl }: DashboardPageProps) {
  const session = sessionStore.getState();
  const userId = session.userId;
  const stats = useDashboardStats({ apiBaseUrl, userId });
  const categories = useCategories({ apiBaseUrl });
  const transactions = useTransactions({ apiBaseUrl, userId, limit: 100 });

  const donutData: SpendDonutDatum[] = stats.topCategories.map((c) => ({
    categoryId: c.categoryId,
    name: c.name,
    color: c.color,
    totalCents: c.totalCents,
  }));

  // For sparkline we synthesize the last 6 months of MTD spend from the
  // loaded transactions. Include PENDING (real spend not yet labeled by the
  // categorizer) but exclude FAILED — same rule as the MTD hero number.
  const months: Array<{ month: string; totalCents: number }> = (() => {
    const monthsLabels = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const now = new Date();
    const out: Array<{ month: string; totalCents: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const next = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const total = (transactions.data ?? [])
        .filter((tx) => {
          if (tx.status === 'FAILED') return false;
          const occurred = new Date(tx.occurredAt);
          return occurred >= d && occurred < next;
        })
        .reduce((sum, tx) => sum + tx.amountCents, 0);
      out.push({ month: `${monthsLabels[d.getMonth()]} ${d.getFullYear()}`, totalCents: total });
    }
    return out;
  })();

  const top = stats.topCategories[0];
  const totalCategories = categories.data?.length ?? 0;
  const now = new Date();
  const kickerMonth = `${MONTHS_ES[now.getMonth()]} ${now.getFullYear()}`;

  return (
    <section className="flex flex-col gap-8">
      <header data-testid="dashboard-page-header" className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tinta-mute">
          TABLERO · {kickerMonth}
        </span>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-display text-2xl font-bold text-ink-tinta">Tu mes, en cifras</h1>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-ink-tinta-mute">
            {totalCategories} {totalCategories === 1 ? 'category' : 'categories'} configured
          </span>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-4">
        <StatsCard
          label="MTD spend"
          amountCents={stats.mtdSpendCents}
          variant="hero"
          ordinal="N.º 01 · HERO"
          ariaLabel={`Month to date spend: ${stats.mtdSpendCents} cents`}
          delta={
            stats.pendingCount + stats.failedCount > 0
              ? {
                  label: `${stats.pendingCount} pending · ${stats.failedCount} failed`,
                  tone: stats.failedCount > 0 ? 'fallo' : 'alerta',
                }
              : undefined
          }
        />
        <StatsCard
          label="Top category"
          amountCents={top?.totalCents ?? 0}
          variant="compact"
          ordinal="N.º 02"
          ariaLabel={top ? `Top category: ${top.name}` : 'Top category'}
          delta={top ? { label: top.name, tone: 'neutral' } : undefined}
        />
        <StatsCard
          label="Pending"
          variant="compact"
          ordinal="N.º 03"
          delta={{ label: `${stats.pendingCount} to categorize`, tone: 'alerta' }}
          ariaLabel={`${stats.pendingCount} pending`}
        >
          <span>{stats.pendingCount}</span>
        </StatsCard>
        <StatsCard
          label="Failed"
          variant="compact"
          ordinal="N.º 04"
          delta={{ label: `${stats.failedCount} need attention`, tone: 'fallo' }}
          ariaLabel={`${stats.failedCount} failed`}
        >
          <span>{stats.failedCount}</span>
        </StatsCard>
        <div className="col-span-12 md:col-span-6">
          <SectionHead kicker="* * *&nbsp;&nbsp;DISTRIBUCIÓN">Spend by category</SectionHead>
          <Suspense fallback={<ChartSkeleton />}>
            <SpendDonut data={donutData} />
          </Suspense>
        </div>
        <div className="col-span-12 md:col-span-6">
          <SectionHead kicker="* * *&nbsp;&nbsp;SERIE">Last 6 months</SectionHead>
          <Suspense fallback={<ChartSkeleton height={200} />}>
            <MonthlySparkline data={months} />
          </Suspense>
        </div>
        <div className="col-span-12">
          <SectionHead kicker="* * *&nbsp;&nbsp;ACTIVIDAD">Recent activity</SectionHead>
          <RecentTransactionsList apiBaseUrl={apiBaseUrl} userId={userId} />
        </div>
      </div>
    </section>
  );
}
