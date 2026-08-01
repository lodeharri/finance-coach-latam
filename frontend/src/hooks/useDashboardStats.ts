/**
 * useDashboardStats — derives dashboard metrics from useTransactions cache.
 *
 * Pure derivation — extracted to dashboard-stats.ts so the math is testable
 * without React. This hook just wires the live data through.
 */
import { useMemo } from 'react';
import { useTransactions } from './useTransactions';
import { useCategories } from './useCategories';
import { computeDashboardStats } from './dashboard-stats';
import type { DashboardStats } from './dashboard-stats';

export interface UseDashboardStatsArgs {
  apiBaseUrl: string;
  userId?: string | undefined;
}

const EMPTY: DashboardStats = {
  mtdSpendCents: 0,
  topCategories: [],
  pendingCount: 0,
  failedCount: 0,
};

export function useDashboardStats({ apiBaseUrl, userId }: UseDashboardStatsArgs): DashboardStats {
  const transactions = useTransactions({ apiBaseUrl, userId, limit: 100 });
  const categories = useCategories({ apiBaseUrl });

  return useMemo(() => {
    if (!transactions.data || !categories.data) return EMPTY;
    return computeDashboardStats(transactions.data, categories.data);
  }, [transactions.data, categories.data]);
}