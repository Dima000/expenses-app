import * as React from 'react';
import {
  UNCATEGORIZED,
  colorIdFor,
  largestRemainderRound,
  type Category,
  type CategoryBreakdownRow,
} from '@expenses/shared';
import { CategoryColorDot, oklchForColorId } from '@/components/CategoryColorDot';
import { cn } from '@/lib/utils';

interface CategoryBreakdownRowsProps {
  rows: CategoryBreakdownRow[];
  /** The owner's live categories, for resolving each row's color/name. */
  categories: Category[];
  onSelect: (categoryId: string) => void;
}

/**
 * The Reports category breakdown: one row per category (swatch, proportion
 * bar, percentage, total), sorted by total descending with Uncategorised
 * always last and dimmed rather than hidden — same row height whether or not
 * it has data (design.md D6). Percentages come from `largestRemainderRound`
 * so they always sum to 100 (design.md D7). Activating a row opens that
 * category's drill-down.
 */
export function CategoryBreakdownRows({ rows, categories, onSelect }: CategoryBreakdownRowsProps) {
  const displayPcts = React.useMemo(
    () => largestRemainderRound(rows.map((r) => r.share)),
    [rows],
  );

  return (
    <div className="rounded-xl border">
      {rows.map((row, i) => {
        const isUncategorized = row.categoryId === UNCATEGORIZED;
        const category = isUncategorized
          ? null
          : (categories.find((c) => c.id === row.categoryId) ?? null);
        const colorId = category ? colorIdFor(category, categories.indexOf(category)) : 'gray';
        return (
          <button
            key={row.categoryId}
            type="button"
            onClick={() => onSelect(row.categoryId)}
            className={cn(
              'flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0 hover:bg-muted/50',
              isUncategorized && 'opacity-50',
            )}
          >
            <CategoryColorDot colorId={colorId} />
            <span className="w-28 shrink-0 truncate font-medium">{row.name}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{ width: `${row.share * 100}%`, backgroundColor: oklchForColorId(colorId) }}
              />
            </div>
            <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
              {displayPcts[i]}%
            </span>
            <span className="w-16 shrink-0 text-right font-medium tabular-nums">
              {row.total.toLocaleString()}
            </span>
          </button>
        );
      })}
    </div>
  );
}
