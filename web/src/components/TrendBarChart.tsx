import { niceAxisMax } from '@expenses/shared';

export interface TrendBarChartPoint {
  key: string;
  /** Full label for the hover tooltip, e.g. `"July"`. */
  label: string;
  /** Short axis label, e.g. `"J"`. */
  shortLabel: string;
  total: number;
  /** False for a period that hasn't occurred yet — renders no bar at all. */
  occurred: boolean;
}

interface TrendBarChartProps {
  data: TrendBarChartPoint[];
  /** CSS color for the bars (e.g. an OKLCH string or a Tailwind class via `barClassName`). */
  color?: string;
  barClassName?: string;
}

const CHART_HEIGHT = 144; // px

/**
 * Bar chart with a "nice" rounded y-axis (3 ticks: max, mid, 0) and matching
 * gridlines (design.md D9). A point with `occurred: false` renders no bar at
 * all — not a zero-height one — so "hasn't happened" reads as absent rather
 * than "spent nothing". Hovering an occurred bar shows its label and total.
 */
export function TrendBarChart({ data, color, barClassName }: TrendBarChartProps) {
  const rawMax = Math.max(0, ...data.filter((d) => d.occurred).map((d) => d.total));
  const max = niceAxisMax(rawMax);
  const mid = max / 2;

  return (
    <div className="flex gap-3">
      <div
        className="flex w-10 shrink-0 flex-col justify-between text-right text-xs tabular-nums text-muted-foreground"
        style={{ height: CHART_HEIGHT }}
      >
        <span>{Math.round(max).toLocaleString()}</span>
        <span>{Math.round(mid).toLocaleString()}</span>
        <span>0</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="relative flex items-end gap-1" style={{ height: CHART_HEIGHT }}>
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border" />
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border"
            style={{ top: CHART_HEIGHT / 2 }}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 border-t border-border" />
          {data.map((d) => (
            <div key={d.key} className="flex h-full flex-1 items-end justify-center">
              {d.occurred && (
                <div
                  title={`${d.label}: ${d.total.toLocaleString()}`}
                  className={barClassName ?? 'w-full rounded-t-sm bg-primary'}
                  style={{
                    height: d.total > 0 ? `${Math.max((d.total / max) * 100, 2)}%` : 0,
                    backgroundColor: barClassName ? undefined : color,
                  }}
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-1">
          {data.map((d) => (
            <div key={d.key} className="flex-1 text-center text-[10px] text-muted-foreground">
              {d.shortLabel}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
