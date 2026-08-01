import * as React from 'react';
import { aggregateByMonth, type Spending } from '@expenses/shared';
import { MONTH_FULL, MONTH_SHORT } from '@/lib/months';
import type { PeriodUnit } from '@/lib/date';
import type { TrendBarChartPoint } from '@/components/TrendBarChart';

/**
 * Year-view "month by month" trend points for the Reports and drill-down bar
 * charts — empty outside year view. A month renders `occurred: false` once
 * it's in the future, so the chart shows no bar rather than a zero one.
 */
export function useMonthlyTrendPoints(
  spendings: readonly Spending[],
  unit: PeriodUnit,
  anchor: string,
): TrendBarChartPoint[] {
  const year = Number(unit === 'year' ? anchor : anchor.slice(0, 4));
  return React.useMemo(() => {
    if (unit !== 'year') return [];
    const totals = aggregateByMonth(spendings, year);
    const now = new Date();
    return totals.map((t, i) => ({
      key: String(i),
      label: MONTH_FULL[i],
      shortLabel: MONTH_SHORT[i],
      total: t,
      occurred: year < now.getFullYear() || (year === now.getFullYear() && i <= now.getMonth()),
    }));
  }, [spendings, unit, year]);
}
