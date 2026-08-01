/**
 * SpendDonut chart — Litografía del Sur.
 *
 * Recharts PieChart with category hex colors. Slices < 1% of the total
 * aggregate into an "Otros" slice with a tooltip explanation. Renders inside
 * ResponsiveContainer.
 */
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { Category } from '@/services/types';

export interface SpendDonutDatum {
  readonly categoryId: string;
  readonly name: string;
  readonly color: string;
  readonly totalCents: number;
}

export interface SpendDonutProps {
  data: ReadonlyArray<SpendDonutDatum>;
  /** Width in pixels for the chart viewBox. */
  width?: number;
  /** Height in pixels for the chart viewBox. */
  height?: number;
}

const OTHERS_COLOR = '#8a8678'; // --ink-tinta-mute
const MIN_PERCENT = 0.01; // 1% threshold for aggregation

function aggregateSmallSlices(data: ReadonlyArray<SpendDonutDatum>): SpendDonutDatum[] {
  const total = data.reduce((s, d) => s + d.totalCents, 0);
  if (total === 0) return [];
  const big: SpendDonutDatum[] = [];
  let othersTotal = 0;
  for (const slice of data) {
    if (slice.totalCents / total >= MIN_PERCENT) {
      big.push(slice);
    } else {
      othersTotal += slice.totalCents;
    }
  }
  if (othersTotal > 0) {
    big.push({
      categoryId: 'others',
      name: 'Otros',
      color: OTHERS_COLOR,
      totalCents: othersTotal,
    });
  }
  return big;
}

export function SpendDonut({ data, width = 320, height = 240 }: SpendDonutProps) {
  const aggregated = aggregateSmallSlices(data);
  return (
    <div data-testid="spend-donut" style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={[...aggregated]}
            dataKey="totalCents"
            nameKey="name"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={1}
          >
            {aggregated.map((slice) => (
              <Cell key={slice.categoryId} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => Number(value ?? 0).toLocaleString('es-AR')}
            separator=" — "
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

// Pure helper exposed for testing.
// eslint-disable-next-line react-refresh/only-export-components
export const __test__ = { aggregateSmallSlices };

// Helper to derive SpendDonut data from raw totals.
// eslint-disable-next-line react-refresh/only-export-components
export function fromCategoryTotals(
  totals: ReadonlyArray<{ categoryId: string; totalCents: number }>,
  categories: ReadonlyArray<Category>,
): SpendDonutDatum[] {
  return totals
    .map(({ categoryId, totalCents }) => {
      const cat = categories.find((c) => c.id === categoryId);
      return {
        categoryId,
        name: cat?.name ?? 'Sin categoría',
        color: cat?.color ?? OTHERS_COLOR,
        totalCents,
      };
    })
    .sort((a, b) => b.totalCents - a.totalCents);
}