import { CATEGORY_PALETTE } from '@expenses/shared';
import { cn } from '@/lib/utils';

const OKLCH_BY_ID = new Map(CATEGORY_PALETTE.map((p) => [p.id, p.oklch]));

/** The raw OKLCH color string for a palette id, for callers that need the
 *  color itself rather than a rendered dot (e.g. chart bars, heatmap cells). */
export function oklchForColorId(colorId: string): string {
  return OKLCH_BY_ID.get(colorId) ?? CATEGORY_PALETTE[0].oklch;
}

interface CategoryColorDotProps {
  /** A `CATEGORY_PALETTE` id (typically from `colorIdFor`). */
  colorId: string;
  className?: string;
}

/** A small colored dot for a palette id, shared by every place a category is shown. */
export function CategoryColorDot({ colorId, className }: CategoryColorDotProps) {
  const oklch = OKLCH_BY_ID.get(colorId) ?? CATEGORY_PALETTE[0].oklch;
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-2.5 shrink-0 rounded-full', className)}
      style={{ backgroundColor: oklch }}
    />
  );
}
