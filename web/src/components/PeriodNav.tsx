import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  addPeriods,
  isNextPeriodDisabled,
  periodLabel,
  type PeriodUnit,
} from '@/lib/date';

interface PeriodNavProps {
  unit: PeriodUnit;
  anchor: string;
  onChange: (unit: PeriodUnit, anchor: string) => void;
}

/**
 * Reports period control: a Month/Year unit toggle plus previous/next
 * navigation for the current anchor. The next control disables once the next
 * period's start is after today (design.md D4), for either unit.
 */
export function PeriodNav({ unit, anchor, onChange }: PeriodNavProps) {
  const nextDisabled = isNextPeriodDisabled(unit, anchor);

  function switchUnit(nextUnit: PeriodUnit) {
    if (nextUnit === unit) return;
    // Re-derive the anchor for the new unit from the current one, per spec:
    // switching Month→Year while viewing August 2026 shows the year 2026.
    const nextAnchor = nextUnit === 'year' ? anchor.slice(0, 4) : `${anchor}-01`;
    onChange(nextUnit, nextAnchor);
  }

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-1 rounded-md border p-0.5">
        <Button
          type="button"
          variant={unit === 'month' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 px-3"
          aria-pressed={unit === 'month'}
          onClick={() => switchUnit('month')}
        >
          Month
        </Button>
        <Button
          type="button"
          variant={unit === 'year' ? 'default' : 'ghost'}
          size="sm"
          className="h-7 px-3"
          aria-pressed={unit === 'year'}
          onClick={() => switchUnit('year')}
        >
          Year
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          aria-label={`Previous ${unit}`}
          onClick={() => onChange(unit, addPeriods(unit, anchor, -1))}
        >
          <ChevronLeft />
        </Button>
        <div className="min-w-24 text-center text-lg font-semibold tabular-nums">
          {periodLabel(unit, anchor)}
        </div>
        <Button
          variant="outline"
          size="icon"
          aria-label={`Next ${unit}`}
          onClick={() => onChange(unit, addPeriods(unit, anchor, 1))}
          disabled={nextDisabled}
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}
