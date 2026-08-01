import { shortDate } from '@expenses/shared';
import { oklchForColorId } from '@/components/CategoryColorDot';
import { cn } from '@/lib/utils';

interface CalendarHeatmapProps {
  /** `YYYY-MM` of the month being shown. */
  monthKey: string;
  /** One entry per day (index 0 = day 1), from `aggregateByDay`. */
  dailyTotals: number[];
  colorId: string;
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LEGEND_STEPS = [0.15, 0.4, 0.65, 1];

const pad = (n: number) => String(n).padStart(2, '0');

/** Apply an alpha fraction to an OKLCH color string, e.g. for a 40% swatch. */
function withAlpha(color: string, fraction: number): string {
  return color.replace(')', ` / ${Math.round(fraction * 100)}%)`);
}

/**
 * Monday-first calendar heatmap of one category's daily spend for a month
 * (design.md D10): single-hue intensity from the category's own colour,
 * relative to that period's own peak day. A no-spend day is the lightest
 * (empty) shade; hovering any day shows its date and exact amount.
 */
export function CalendarHeatmap({ monthKey, dailyTotals, colorId }: CalendarHeatmapProps) {
  const [y, m] = monthKey.split('-').map(Number);
  // JS getDay(): 0=Sun..6=Sat; shift so 0=Mon..6=Sun (Monday-first weeks).
  const firstWeekday = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  const peak = Math.max(0, ...dailyTotals);
  const color = oklchForColorId(colorId);

  const cells: Array<{ day: number | null; total: number }> = [
    ...Array.from({ length: firstWeekday }, () => ({ day: null, total: 0 })),
    ...dailyTotals.map((total, i) => ({ day: i + 1, total })),
  ];
  while (cells.length % 7 !== 0) cells.push({ day: null, total: 0 });

  function cellStyle(total: number) {
    if (total <= 0 || peak <= 0) return undefined;
    const intensity = Math.max(total / peak, 0.15);
    return { backgroundColor: withAlpha(color, intensity) };
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground">
        {WEEKDAY_LABELS.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((c, i) =>
          c.day ? (
            <div
              key={i}
              title={`${shortDate(`${monthKey}-${pad(c.day)}`)}: ${c.total.toLocaleString()}`}
              className={cn('aspect-square rounded-sm', c.total <= 0 && 'bg-muted')}
              style={cellStyle(c.total)}
            />
          ) : (
            <div key={i} aria-hidden="true" />
          ),
        )}
      </div>
      <div className="mt-2 flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <span>Less</span>
        <div className="flex gap-0.5">
          {LEGEND_STEPS.map((v) => (
            <div
              key={v}
              className="size-3 rounded-sm"
              style={{ backgroundColor: withAlpha(color, v) }}
            />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
