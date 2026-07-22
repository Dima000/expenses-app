/** Month helpers built on `YYYY-MM` keys and `YYYY-MM-DD` dates (design.md D8). */

const pad = (n: number) => String(n).padStart(2, '0');

/** `YYYY-MM-DD` for a Date, in local time. */
export function toDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Today as `YYYY-MM-DD` (local). */
export function todayString(): string {
  return toDateString(new Date());
}

/** Yesterday as `YYYY-MM-DD` (local); `setDate` handles month/year rollover. */
export function yesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateString(d);
}

/** Current month as `YYYY-MM` (local). */
export function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Shift a `YYYY-MM` key by `delta` months (e.g. -1 previous, +1 next). */
export function addMonths(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Human label for a month key, e.g. `"July 2026"`. */
export function monthLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Inclusive-start / exclusive-end `YYYY-MM-DD` bounds for a month key, for
 * lexicographic Firestore range queries on the fixed-width `date` string.
 */
export function monthRange(monthKey: string): { start: string; end: string } {
  return { start: `${monthKey}-01`, end: `${addMonths(monthKey, 1)}-01` };
}
