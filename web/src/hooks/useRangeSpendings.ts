import * as React from 'react';
import type { Spending } from '@expenses/shared';
import { useDataSource } from '@/lib/dataSource';
import { periodRange, type PeriodUnit } from '@/lib/date';

/**
 * Live subscription to the given period's spendings for the owner. Reset to
 * the loading state (`null`) whenever the unit or anchor changes. Shared by
 * the Reports screen and the category drill-down so both stay in sync with
 * the same live-listener pattern the dashboard already uses — an edit
 * anywhere updates every open screen with no extra refresh logic.
 */
export function useRangeSpendings(
  unit: PeriodUnit,
  anchor: string,
): { spendings: Spending[] | null; loading: boolean } {
  const dataSource = useDataSource();
  const [spendings, setSpendings] = React.useState<Spending[] | null>(null);

  React.useEffect(() => {
    setSpendings(null);
    const { start, end } = periodRange(unit, anchor);
    return dataSource.subscribeToRange(start, end, setSpendings);
  }, [dataSource, unit, anchor]);

  return { spendings, loading: spendings === null };
}
