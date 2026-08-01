/**
 * MonthlySparkline chart — Litografía del Sur.
 *
 * Editorial treatment:
 * - Asterism caption `* * *  ÚLTIMOS 6 MESES  * * *` in mono caps (signature).
 * - 6-month trailing window. Recharts LineChart with a cobalt dot at the
 *   current month. JetBrains Mono month labels. Empty state when fewer than
 *   2 data points (no chart, no zero).
 */
import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot } from 'recharts';

export interface MonthlySparklinePoint {
  readonly month: string; // e.g. 'ENE 2026'
  readonly totalCents: number;
}

export interface MonthlySparklineProps {
  data: ReadonlyArray<MonthlySparklinePoint>;
  width?: number;
  height?: number;
}

export function MonthlySparkline({ data, width = 320, height = 200 }: MonthlySparklineProps) {
  // ResponsiveContainer in jsdom does not size correctly; defer render until
  // the component is mounted in a real DOM with a measurable parent.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (data.length < 2) {
    return (
      <div
        data-testid="sparkline-empty"
        className="font-body text-sm text-ink-tinta-soft"
        style={{ width, height }}
      >
        Not enough history yet.
      </div>
    );
  }

  if (!mounted) {
    return <div data-testid="sparkline-placeholder" style={{ width, height }} />;
  }

  const last = data[data.length - 1];

  return (
    <figure className="flex flex-col gap-3">
      <figcaption
        aria-hidden="true"
        data-testid="sparkline-caption"
        className="text-center font-mono text-[10px] uppercase tracking-[0.3em] text-ink-tinta-mute"
      >
        * * *&nbsp;&nbsp;ÚLTIMOS {data.length} MESES&nbsp;&nbsp;* * *
      </figcaption>
      <div data-testid="monthly-sparkline" style={{ width, height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={[...data]}>
            <XAxis
              dataKey="month"
              tick={{ fill: '#4a4f5a', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}
              stroke="#8a8678"
            />
            <YAxis hide />
            <Tooltip
              formatter={(value) => Number(value ?? 0).toLocaleString('es-AR')}
              labelStyle={{ fontFamily: 'JetBrains Mono, monospace' }}
            />
            <Line
              type="monotone"
              dataKey="totalCents"
              stroke="#1f3fb8"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: '#1f3fb8' }}
            />
            {last ? (
              <ReferenceDot x={last.month} y={last.totalCents} r={4} fill="#1f3fb8" />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

// Pure helper for tests.
// eslint-disable-next-line react-refresh/only-export-components
export function trailingMonths(now: Date, count: number): string[] {
  const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push(`${months[d.getMonth()]} ${d.getFullYear()}`);
  }
  return out;
}

// eslint-disable-next-line react-refresh/only-export-components
export const __test__ = { trailingMonths };