/**
 * SpendDonut chart tests (REQ-FFC-DASH-DONUT).
 */
import { describe, expect, it } from 'vitest';
import { __test__, fromCategoryTotals } from './SpendDonut';
import type { Category } from '@/services/types';

const cats: Category[] = [
  { id: 'c1', slug: 'transporte', name: 'Transporte', color: '#1F3FB8' },
  { id: 'c2', slug: 'alimentos', name: 'Alimentos', color: '#1F4D2C' },
  { id: 'c3', slug: 'salud', name: 'Salud', color: '#6E1F1F' },
];

describe('SpendDonut aggregation', () => {
  const { aggregateSmallSlices } = __test__;

  it('keeps slices that are at least 1% of the total', () => {
    const data = [
      { categoryId: 'c1', name: 'Transporte', color: '#1F3FB8', totalCents: 5000 },
      { categoryId: 'c2', name: 'Alimentos', color: '#1F4D2C', totalCents: 4500 },
    ];
    const aggregated = aggregateSmallSlices(data);
    expect(aggregated).toHaveLength(2);
  });

  it('aggregates slices below 1% into an "Otros" slice', () => {
    const data = [
      { categoryId: 'c1', name: 'Transporte', color: '#1F3FB8', totalCents: 9900 },
      { categoryId: 'c2', name: 'Alimentos', color: '#1F4D2C', totalCents: 50 }, // 0.5%
      { categoryId: 'c3', name: 'Salud', color: '#6E1F1F', totalCents: 50 }, // 0.5%
    ];
    const aggregated = aggregateSmallSlices(data);
    expect(aggregated).toHaveLength(2);
    const otros = aggregated.find((s) => s.categoryId === 'others');
    expect(otros).toBeDefined();
    expect(otros?.totalCents).toBe(100);
  });

  it('returns empty array when total is zero', () => {
    const aggregated = aggregateSmallSlices([
      { categoryId: 'c1', name: 'A', color: '#000', totalCents: 0 },
    ]);
    expect(aggregated).toEqual([]);
  });

  it('fromCategoryTotals joins totals with category metadata and sorts desc', () => {
    const totals = [
      { categoryId: 'c1', totalCents: 1000 },
      { categoryId: 'c2', totalCents: 5000 },
      { categoryId: 'missing', totalCents: 100 },
    ];
    const data = fromCategoryTotals(totals, cats);
    expect(data[0]?.categoryId).toBe('c2');
    expect(data[1]?.categoryId).toBe('c1');
    expect(data[2]?.name).toBe('Sin categoría');
    expect(data[2]?.color).toBe('#8a8678');
  });
});