/**
 * MonthlySparkline chart tests (REQ-FFC-DASH-SPARKLINE).
 */
import { describe, expect, it } from 'vitest';
import { __test__, buildTrendForPeriod } from './MonthlySparkline';
import type { Transaction } from '@/services/types';

describe('MonthlySparkline trailingMonths', () => {
  it('produces 6 trailing months including the current month', () => {
    const months = __test__.trailingMonths(new Date('2026-07-15T00:00:00Z'), 6);
    expect(months).toEqual([
      'FEB 2026',
      'MAR 2026',
      'ABR 2026',
      'MAY 2026',
      'JUN 2026',
      'JUL 2026',
    ]);
  });

  it('handles year wrap correctly', () => {
    const months = __test__.trailingMonths(new Date('2026-02-01T00:00:00Z'), 3);
    expect(months).toEqual(['NOV 2025', 'DIC 2025', 'ENE 2026']);
  });
});

describe('MonthlySparkline buildTrendForPeriod', () => {
  // FAILED transactions are excluded; PENDING is real spend.
  function tx(overrides: Partial<Transaction> = {}): Transaction {
    return {
      id: 't1',
      userId: 'u1',
      accountId: 'a1',
      categoryId: 'c1',
      merchant: 'M',
      amountCents: 100000,
      occurredAt: '2026-07-10T12:00:00.000Z',
      createdAt: '2026-07-10T12:00:00.000Z',
      status: 'CATEGORIZED',
      notes: null,
      ...overrides,
    };
  }

  it('returns exactly the requested number of months (Last 6 → 6 buckets)', () => {
    const now = new Date('2026-07-15T12:00:00Z');
    const trend = buildTrendForPeriod([], 6, now);
    expect(trend).toHaveLength(6);
    expect(trend.map((b) => b.month)).toEqual([
      'FEB 2026',
      'MAR 2026',
      'ABR 2026',
      'MAY 2026',
      'JUN 2026',
      'JUL 2026',
    ]);
  });

  it('returns 12 months when count=12', () => {
    const now = new Date('2026-07-15T12:00:00Z');
    const trend = buildTrendForPeriod([], 12, now);
    expect(trend).toHaveLength(12);
  });

  it('returns 1 month for this_month', () => {
    const now = new Date('2026-07-15T12:00:00Z');
    const trend = buildTrendForPeriod([], 1, now);
    expect(trend).toHaveLength(1);
    expect(trend[0]?.month).toBe('JUL 2026');
  });

  it('fills empty months with 0 (no gap in the line)', () => {
    const now = new Date('2026-07-15T12:00:00Z');
    const trend = buildTrendForPeriod([], 6, now);
    expect(trend.every((b) => b.totalCents === 0)).toBe(true);
  });

  it('excludes FAILED transactions from the bucket totals', () => {
    const now = new Date('2026-07-15T12:00:00Z');
    const trend = buildTrendForPeriod(
      [
        tx({ id: 'a', amountCents: 50000, status: 'CATEGORIZED', occurredAt: '2026-07-10T00:00:00.000Z' }),
        tx({ id: 'b', amountCents: 999999, status: 'FAILED', occurredAt: '2026-07-10T00:00:00.000Z' }),
      ],
      6,
      now,
    );
    const jul = trend[5];
    expect(jul?.month).toBe('JUL 2026');
    expect(jul?.totalCents).toBe(50000);
  });

  it('includes CATEGORIZED + PENDING in the bucket totals (REL-001 parity)', () => {
    const now = new Date('2026-07-15T12:00:00Z');
    const trend = buildTrendForPeriod(
      [
        tx({ id: 'a', amountCents: 100000, status: 'CATEGORIZED', occurredAt: '2026-07-10T00:00:00.000Z' }),
        tx({ id: 'b', amountCents: 50000, status: 'PENDING', occurredAt: '2026-07-10T00:00:00.000Z' }),
      ],
      6,
      now,
    );
    expect(trend[5]?.totalCents).toBe(150000);
  });

  it('buckets each transaction into exactly one month by occurredAt', () => {
    const now = new Date('2026-07-15T12:00:00Z');
    const trend = buildTrendForPeriod(
      [
        tx({ id: 'a', amountCents: 1000, occurredAt: '2026-02-15T00:00:00.000Z' }),
        tx({ id: 'b', amountCents: 2000, occurredAt: '2026-03-15T00:00:00.000Z' }),
        tx({ id: 'c', amountCents: 3000, occurredAt: '2026-04-15T00:00:00.000Z' }),
      ],
      6,
      now,
    );
    expect(trend[0]?.totalCents).toBe(1000); // FEB
    expect(trend[1]?.totalCents).toBe(2000); // MAR
    expect(trend[2]?.totalCents).toBe(3000); // APR
    expect(trend[3]?.totalCents).toBe(0);
    expect(trend[4]?.totalCents).toBe(0);
    expect(trend[5]?.totalCents).toBe(0);
  });
});