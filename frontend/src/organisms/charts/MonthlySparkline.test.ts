/**
 * MonthlySparkline chart tests (REQ-FFC-DASH-SPARKLINE).
 */
import { describe, expect, it } from 'vitest';
import { __test__ } from './MonthlySparkline';

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