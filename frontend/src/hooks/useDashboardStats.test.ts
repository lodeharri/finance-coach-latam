/**
 * useDashboardStats hook + pure computeDashboardStats unit tests (REQ-FFC-DASH-STATS).
 */
import { describe, expect, it } from 'vitest';
import { computeDashboardStats } from './dashboard-stats';
import type { Transaction } from '@/services/types';
import type { Category } from '@/services/types';

const NOW = new Date('2026-07-15T12:00:00Z');

const categories: Category[] = [
  { id: 'c1', slug: 'transporte', name: 'Transporte', color: '#1F3FB8' },
  { id: 'c2', slug: 'alimentos', name: 'Alimentos', color: '#1F4D2C' },
];

function tx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: 't1',
    userId: 'u1',
    accountId: 'a1',
    categoryId: 'c1',
    merchant: 'Shell',
    amountCents: 420000,
    occurredAt: '2026-07-10T12:00:00.000Z',
    createdAt: '2026-07-10T12:00:00.000Z',
    status: 'CATEGORIZED',
    notes: null,
    ...overrides,
  };
}

describe('computeDashboardStats', () => {
  it('returns zero-filled stats when there are no transactions', () => {
    const stats = computeDashboardStats([], categories, NOW);
    expect(stats).toEqual({
      mtdSpendCents: 0,
      topCategories: [],
      pendingCount: 0,
      failedCount: 0,
    });
  });

  it('sums CATEGORIZED MTD spend (excludes prior month)', () => {
    const stats = computeDashboardStats(
      [
        tx({ id: 'a', amountCents: 100000, occurredAt: '2026-07-10T00:00:00.000Z', status: 'CATEGORIZED' }),
        tx({ id: 'b', amountCents: 50000, occurredAt: '2026-07-12T00:00:00.000Z', status: 'CATEGORIZED' }),
        tx({ id: 'c', amountCents: 999999, occurredAt: '2026-06-30T00:00:00.000Z', status: 'CATEGORIZED' }), // prior month
      ],
      categories,
      NOW,
    );
    expect(stats.mtdSpendCents).toBe(150000);
  });

  it('excludes PENDING and FAILED transactions from the spend total', () => {
    const stats = computeDashboardStats(
      [
        tx({ id: 'a', amountCents: 100000, status: 'CATEGORIZED' }),
        tx({ id: 'b', amountCents: 50000, status: 'PENDING' }),
        tx({ id: 'c', amountCents: 75000, status: 'FAILED' }),
      ],
      categories,
      NOW,
    );
    expect(stats.mtdSpendCents).toBe(150000);
    expect(stats.pendingCount).toBe(1);
    expect(stats.failedCount).toBe(1);
  });

  it('includes PENDING transactions in mtdSpendCents (the user already spent it)', () => {
    const stats = computeDashboardStats(
      [
        tx({ id: 'a', amountCents: 100000, status: 'CATEGORIZED' }),
        tx({ id: 'b', amountCents: 50000, status: 'PENDING' }),
      ],
      categories,
      NOW,
    );
    expect(stats.mtdSpendCents).toBe(150000);
    expect(stats.pendingCount).toBe(1);
  });

  it('excludes FAILED transactions from mtdSpendCents', () => {
    const stats = computeDashboardStats(
      [
        tx({ id: 'a', amountCents: 100000, status: 'CATEGORIZED' }),
        tx({ id: 'b', amountCents: 75000, status: 'FAILED' }),
      ],
      categories,
      NOW,
    );
    expect(stats.mtdSpendCents).toBe(100000);
    expect(stats.failedCount).toBe(1);
  });

  it('counts PENDING spend toward topCategories when categoryId is set', () => {
    const stats = computeDashboardStats(
      [
        tx({ id: 'a', amountCents: 100000, status: 'CATEGORIZED', categoryId: 'c1' }),
        tx({ id: 'b', amountCents: 80000, status: 'PENDING', categoryId: 'c2' }),
      ],
      categories,
      NOW,
    );
    const top = stats.topCategories;
    expect(top).toHaveLength(2);
    const byId = Object.fromEntries(top.map((c) => [c.categoryId, c.totalCents]));
    expect(byId['c1']).toBe(100000);
    expect(byId['c2']).toBe(80000);
  });

  it('produces top-3 categories sorted by total spend', () => {
    const stats = computeDashboardStats(
      [
        tx({ id: 'a', amountCents: 100000, categoryId: 'c1' }),
        tx({ id: 'b', amountCents: 200000, categoryId: 'c2' }),
        tx({ id: 'c', amountCents: 50000, categoryId: 'c1' }),
      ],
      categories,
      NOW,
    );
    expect(stats.topCategories).toHaveLength(2);
    expect(stats.topCategories[0]?.categoryId).toBe('c2');
    expect(stats.topCategories[0]?.totalCents).toBe(200000);
    expect(stats.topCategories[1]?.categoryId).toBe('c1');
    expect(stats.topCategories[1]?.totalCents).toBe(150000);
  });

  it('caps the top list at three entries', () => {
    const cats = [
      ...categories,
      { id: 'c3', slug: 'salud', name: 'Salud', color: '#6E1F1F' },
      { id: 'c4', slug: 'ocio', name: 'Ocio', color: '#C58A14' },
    ];
    const stats = computeDashboardStats(
      [
        tx({ id: 'a', amountCents: 100000, categoryId: 'c1' }),
        tx({ id: 'b', amountCents: 200000, categoryId: 'c2' }),
        tx({ id: 'c', amountCents: 50000, categoryId: 'c3' }),
        tx({ id: 'd', amountCents: 25000, categoryId: 'c4' }),
      ],
      cats,
      NOW,
    );
    expect(stats.topCategories).toHaveLength(3);
  });

  it('falls back to a placeholder when a category is missing', () => {
    const stats = computeDashboardStats(
      [tx({ id: 'a', amountCents: 100000, categoryId: 'missing' })],
      categories,
      NOW,
    );
    expect(stats.topCategories[0]?.name).toBe('Sin categoría');
  });

  it('locale-aware: returns cents so the consumer can format (no locale coupling)', () => {
    const stats = computeDashboardStats(
      [tx({ id: 'a', amountCents: 123456, status: 'CATEGORIZED' })],
      categories,
      NOW,
    );
    expect(stats.mtdSpendCents).toBe(123456);
  });
});