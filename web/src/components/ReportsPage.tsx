import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import { groupByCategory, type Category } from '@expenses/shared';
import { Button } from '@/components/ui/button';
import { TotalCard } from '@/components/TotalCard';
import { PeriodNav } from '@/components/PeriodNav';
import { CategoryBreakdownRows } from '@/components/CategoryBreakdownRows';
import { TrendBarChart } from '@/components/TrendBarChart';
import { useRangeSpendings } from '@/hooks/useRangeSpendings';
import { useMonthlyTrendPoints } from '@/hooks/useMonthlyTrendPoints';
import type { PeriodUnit } from '@/lib/date';

interface ReportsPageProps {
  ownerUid: string;
  /** The owner's live categories, for resolving breakdown row colors/names. */
  categories: Category[];
  unit: PeriodUnit;
  anchor: string;
  onPeriodChange: (unit: PeriodUnit, anchor: string) => void;
  onSelectCategory: (categoryId: string) => void;
  onBack: () => void;
}

/**
 * The Reports screen: period selection, the period total, the year-view
 * aggregate "Total, month by month" trend, and the category breakdown rows.
 * Owns its own live range subscription (`useRangeSpendings`), independent of
 * the dashboard's month subscription.
 */
export function ReportsPage({
  ownerUid,
  categories,
  unit,
  anchor,
  onPeriodChange,
  onSelectCategory,
  onBack,
}: ReportsPageProps) {
  const { spendings, loading } = useRangeSpendings(ownerUid, unit, anchor);

  const rows = React.useMemo(
    () => groupByCategory(spendings ?? [], categories),
    [spendings, categories],
  );
  // Sum the (few) category rows rather than re-reducing every spending —
  // groupByCategory already did that pass to compute each row's total.
  const total = React.useMemo(() => rows.reduce((sum, r) => sum + r.total, 0), [rows]);

  const monthlyPoints = useMonthlyTrendPoints(spendings ?? [], unit, anchor);

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-28 pt-6">
      <header className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <h1 className="text-xl font-semibold">Reports</h1>
      </header>

      <div className="mb-4">
        <PeriodNav unit={unit} anchor={anchor} onChange={onPeriodChange} />
      </div>

      <div className="mb-4">
        <TotalCard
          total={total}
          count={spendings?.length ?? 0}
          label={unit === 'year' ? 'Year total' : 'Month total'}
        />
      </div>

      {unit === 'year' && (
        <div className="mb-4 rounded-xl border p-4">
          <div className="mb-3 text-sm font-medium text-muted-foreground">
            Total, month by month
          </div>
          <TrendBarChart data={monthlyPoints} />
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Loading…
        </div>
      ) : (
        <CategoryBreakdownRows rows={rows} categories={categories} onSelect={onSelectCategory} />
      )}
    </div>
  );
}
