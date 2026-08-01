import * as React from 'react';
import { ArrowLeft } from 'lucide-react';
import {
  aggregateByDay,
  resolveCategoryDisplay,
  spendingsForCategory,
  type Category,
  type Spending,
} from '@expenses/shared';
import { Button } from '@/components/ui/button';
import { CategoryColorDot, oklchForColorId } from '@/components/CategoryColorDot';
import { TotalCard } from '@/components/TotalCard';
import { PeriodNav } from '@/components/PeriodNav';
import { TrendBarChart } from '@/components/TrendBarChart';
import { CalendarHeatmap } from '@/components/CalendarHeatmap';
import { DrilldownTransactionsTable } from '@/components/DrilldownTransactionsTable';
import { SpendingForm } from '@/components/SpendingForm';
import { useRangeSpendings } from '@/hooks/useRangeSpendings';
import { useMonthlyTrendPoints } from '@/hooks/useMonthlyTrendPoints';
import type { PeriodUnit } from '@/lib/date';

interface CategoryDrilldownPageProps {
  ownerUid: string;
  /** The owner's live categories, for resolving this category's name/color
   *  and for filtering + save-time auto-categorisation in the edit form. */
  categories: Category[];
  /** A category id, or `uncategorized` for the Uncategorised bucket. */
  categoryId: string;
  unit: PeriodUnit;
  anchor: string;
  onPeriodChange: (unit: PeriodUnit, anchor: string) => void;
  onBack: () => void;
}

/**
 * The category drill-down: header, period total for just this category, a
 * trend visualization (year-view bars or month-view heatmap), and a sortable
 * transactions table with an Edit action. Owns its own live range
 * subscription for the same period as the Reports screen, so a saved edit
 * updates both automatically with no separate refresh logic (design.md D2).
 */
export function CategoryDrilldownPage({
  ownerUid,
  categories,
  categoryId,
  unit,
  anchor,
  onPeriodChange,
  onBack,
}: CategoryDrilldownPageProps) {
  const { spendings, loading } = useRangeSpendings(ownerUid, unit, anchor);
  const [editing, setEditing] = React.useState<Spending | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);

  const { name: categoryName, colorId } = resolveCategoryDisplay(categoryId, categories);

  const filtered = React.useMemo(
    () => spendingsForCategory(spendings ?? [], categoryId, categories),
    [spendings, categories, categoryId],
  );

  const total = React.useMemo(
    () => filtered.reduce((sum, s) => sum + (s.amount || 0), 0),
    [filtered],
  );

  const monthlyPoints = useMonthlyTrendPoints(filtered, unit, anchor);

  const dailyTotals = React.useMemo(
    () => (unit === 'month' ? aggregateByDay(filtered, anchor) : []),
    [filtered, unit, anchor],
  );

  function openEdit(s: Spending) {
    setEditing(s);
    setFormOpen(true);
  }

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-28 pt-6">
      <header className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Back to Reports" onClick={onBack}>
          <ArrowLeft />
        </Button>
        <CategoryColorDot colorId={colorId} className="size-3" />
        <h1 className="truncate text-xl font-semibold">{categoryName}</h1>
      </header>

      <div className="mb-4">
        <PeriodNav unit={unit} anchor={anchor} onChange={onPeriodChange} />
      </div>

      <div className="mb-4">
        <TotalCard
          total={total}
          count={filtered.length}
          label={unit === 'year' ? 'Year total' : 'Month total'}
        />
      </div>

      <div className="mb-4 rounded-xl border p-4">
        {unit === 'year' ? (
          <TrendBarChart data={monthlyPoints} color={oklchForColorId(colorId)} />
        ) : (
          <CalendarHeatmap monthKey={anchor} dailyTotals={dailyTotals} colorId={colorId} />
        )}
      </div>

      {loading ? (
        <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          Loading…
        </div>
      ) : (
        <DrilldownTransactionsTable spendings={filtered} onEdit={openEdit} />
      )}

      <SpendingForm
        open={formOpen}
        onOpenChange={setFormOpen}
        ownerUid={ownerUid}
        categories={categories}
        editing={editing}
      />
    </div>
  );
}
