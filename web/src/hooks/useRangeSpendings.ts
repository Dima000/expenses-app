import * as React from 'react';
import type { Spending } from '@expenses/shared';
import { subscribeToRange } from '@/lib/spendings';
import { periodRange, type PeriodUnit } from '@/lib/date';

/**
 * Live subscription to the given period's spendings for the owner. Reset to
 * the loading state (`null`) whenever the owner, unit, or anchor changes.
 * Shared by the Reports screen and the category drill-down so both stay in
 * sync with the same Firestore listener pattern the dashboard already uses —
 * an edit anywhere updates every open screen with no extra refresh logic.
 */
export function useRangeSpendings(
  ownerUid: string | undefined,
  unit: PeriodUnit,
  anchor: string,
): { spendings: Spending[] | null; loading: boolean } {
  const [spendings, setSpendings] = React.useState<Spending[] | null>(null);

  React.useEffect(() => {
    setSpendings(null);
    if (!ownerUid) return;
    const { start, end } = periodRange(unit, anchor);
    return subscribeToRange(ownerUid, start, end, setSpendings);
  }, [ownerUid, unit, anchor]);

  return { spendings, loading: spendings === null };
}
