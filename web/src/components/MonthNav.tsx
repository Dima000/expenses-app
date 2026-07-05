import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { addMonths, monthLabel } from '@/lib/date';

interface MonthNavProps {
  monthKey: string;
  onChange: (monthKey: string) => void;
}

/** Previous/next month navigation with the current month label. */
export function MonthNav({ monthKey, onChange }: MonthNavProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous month"
        onClick={() => onChange(addMonths(monthKey, -1))}
      >
        <ChevronLeft />
      </Button>
      <div className="text-lg font-semibold tabular-nums">{monthLabel(monthKey)}</div>
      <Button
        variant="outline"
        size="icon"
        aria-label="Next month"
        onClick={() => onChange(addMonths(monthKey, 1))}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
