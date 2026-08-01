/**
 * Reports domain: pure, unit-testable functions over an already-fetched range
 * of spendings (design.md D1/D2) — category grouping, percentage rounding,
 * and monthly/daily aggregation. Nothing here reads Firestore or touches time
 * zones beyond the `YYYY-MM-DD`/`YYYY-MM` string parsing shared elsewhere.
 */
import { resolveCategory, UNCATEGORIZED } from './categories.js';
import type { Category, Spending } from './types.js';

/** One row of the Reports category breakdown. */
export interface CategoryBreakdownRow {
  /** A category id, or `UNCATEGORIZED` for the always-present bucket. */
  categoryId: string;
  /** Resolved display name, or `"Uncategorised"` for that bucket. */
  name: string;
  total: number;
  /** Exact fraction of the period's grand total (0 when the period is empty). */
  share: number;
  count: number;
}

/**
 * Group a period's spendings into one row per category present, plus the
 * `uncategorized` bucket which is ALWAYS included — even at zero — and always
 * sorted last regardless of its total (design.md D6). Every other row is
 * sorted by total descending.
 */
export function groupByCategory(
  spendings: readonly Spending[],
  categories: readonly Category[],
): CategoryBreakdownRow[] {
  const grandTotal = spendings.reduce((sum, s) => sum + (s.amount || 0), 0);
  const buckets = new Map<string, { name: string; total: number; count: number }>();
  buckets.set(UNCATEGORIZED, { name: 'Uncategorised', total: 0, count: 0 });

  for (const s of spendings) {
    const resolved = resolveCategory(s.category, categories);
    const key = resolved ? resolved.id : UNCATEGORIZED;
    const name = resolved ? resolved.name : 'Uncategorised';
    const bucket = buckets.get(key) ?? { name, total: 0, count: 0 };
    bucket.total += s.amount || 0;
    bucket.count += 1;
    buckets.set(key, bucket);
  }

  const rows = Array.from(buckets.entries()).map(([categoryId, b]) => ({
    categoryId,
    name: b.name,
    total: b.total,
    share: grandTotal > 0 ? b.total / grandTotal : 0,
    count: b.count,
  }));

  rows.sort((a, b) => {
    if (a.categoryId === UNCATEGORIZED) return 1;
    if (b.categoryId === UNCATEGORIZED) return -1;
    return b.total - a.total;
  });
  return rows;
}

/**
 * Largest-remainder rounding (design.md D7): floor each exact share (0..1) to
 * a percentage, then hand the remaining points (100 minus the sum of floors)
 * one each to the largest fractional remainders, so the result always sums to
 * exactly 100. Returns all zeros when the shares sum to 0 (nothing to
 * distribute — an empty period shouldn't read as "100% of nothing").
 */
export function largestRemainderRound(shares: readonly number[]): number[] {
  if (shares.length === 0) return [];
  const total = shares.reduce((sum, s) => sum + s, 0);
  if (total <= 0) return shares.map(() => 0);

  const scaled = shares.map((s) => s * 100);
  const floors = scaled.map(Math.floor);
  const remainder = 100 - floors.reduce((sum, f) => sum + f, 0);

  const order = scaled
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  const result = [...floors];
  for (let k = 0; k < remainder && k < order.length; k++) {
    result[order[k].i] += 1;
  }
  return result;
}

/**
 * Total spend per month for `year`, across whatever `spendings` are passed —
 * 12 entries (Jan..Dec). Used directly for the aggregate trend chart; for a
 * single category's bars, pre-filter `spendings` to that category first (the
 * function itself doesn't need to know about categories).
 */
export function aggregateByMonth(spendings: readonly Spending[], year: number): number[] {
  const totals = new Array(12).fill(0) as number[];
  const prefix = `${year}-`;
  for (const s of spendings) {
    if (!s.date.startsWith(prefix)) continue;
    const monthIdx = Number(s.date.slice(5, 7)) - 1;
    if (monthIdx >= 0 && monthIdx < 12) totals[monthIdx] += s.amount || 0;
  }
  return totals;
}

/**
 * Total spend per day of `monthKey` (`YYYY-MM`) across whatever `spendings`
 * are passed — one entry per day of that month. Used by the drill-down's
 * month-view heatmap after pre-filtering `spendings` to one category.
 */
export function aggregateByDay(spendings: readonly Spending[], monthKey: string): number[] {
  const [y, m] = monthKey.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const totals = new Array(daysInMonth).fill(0) as number[];
  const prefix = `${monthKey}-`;
  for (const s of spendings) {
    if (!s.date.startsWith(prefix)) continue;
    const day = Number(s.date.slice(8, 10));
    if (day >= 1 && day <= daysInMonth) totals[day - 1] += s.amount || 0;
  }
  return totals;
}

/**
 * Round `rawMax` up to a "nice" axis maximum: the smallest 1/2/5/10 × 10^n
 * step at or above it, so gridlines land on round values and bars never look
 * cropped at an arbitrary maximum (design.md D9). `0` maps to `1` (an axis
 * needs a positive span even with no data).
 */
export function niceAxisMax(rawMax: number): number {
  if (rawMax <= 0) return 1;
  const exponent = Math.floor(Math.log10(rawMax));
  const magnitude = 10 ** exponent;
  const residual = rawMax / magnitude;
  const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  return niceResidual * magnitude;
}
