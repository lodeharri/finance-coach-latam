/**
 * Pure dashboard-stat derivation.
 *
 * Lives in a non-hook module so the derivation is testable without React
 * (per strict-tdd: extract before mock). The hook in useDashboardStats
 * composes this with useTransactions to get the live data.
 */
import type { Transaction } from '@/services/types';
import type { Category } from '@/services/types';

export interface DashboardStats {
  /** Month-to-date spend in cents (only CATEGORIZED transactions). */
  mtdSpendCents: number;
  /** Top categories by spend this month (capped). */
  topCategories: ReadonlyArray<{ categoryId: string; name: string; color: string; totalCents: number }>;
  /** Count of PENDING transactions (categorization still running). */
  pendingCount: number;
  /** Count of FAILED transactions. */
  failedCount: number;
}

const EMPTY_STATS: DashboardStats = {
  mtdSpendCents: 0,
  topCategories: [],
  pendingCount: 0,
  failedCount: 0,
};

export function computeDashboardStats(
  transactions: ReadonlyArray<Transaction>,
  categories: ReadonlyArray<Category>,
  now: Date = new Date(),
): DashboardStats {
  if (transactions.length === 0) return EMPTY_STATS;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let mtdSpendCents = 0;
  let pendingCount = 0;
  let failedCount = 0;
  const byCategory = new Map<string, number>();

  for (const tx of transactions) {
    if (tx.status === 'PENDING') pendingCount += 1;
    if (tx.status === 'FAILED') failedCount += 1;
    const occurred = new Date(tx.occurredAt);
    if (Number.isNaN(occurred.getTime())) continue;
    if (occurred < monthStart) continue;
    if (tx.status !== 'CATEGORIZED') continue;
    // Treat negative amounts (refunds) as reducing spend; positive amounts as spend.
    const cents = tx.amountCents;
    mtdSpendCents += cents;
    if (tx.categoryId) {
      byCategory.set(tx.categoryId, (byCategory.get(tx.categoryId) ?? 0) + cents);
    }
  }

  const top = [...byCategory.entries()]
    .map(([categoryId, totalCents]) => {
      const cat = categories.find((c) => c.id === categoryId);
      return {
        categoryId,
        name: cat?.name ?? 'Sin categoría',
        color: cat?.color ?? '#8a8678',
        totalCents,
      };
    })
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 3);

  return {
    mtdSpendCents,
    topCategories: top,
    pendingCount,
    failedCount,
  };
}