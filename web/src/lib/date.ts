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

/** Current year as a `YYYY` key (local). */
export function currentYearKey(): string {
  return String(new Date().getFullYear());
}

/** Shift a `YYYY` key by `delta` years (e.g. -1 previous, +1 next). */
export function addYears(yearKey: string, delta: number): string {
  return String(Number(yearKey) + delta);
}

/** Human label for a year key — the year itself, e.g. `"2026"`. */
export function yearLabel(yearKey: string): string {
  return yearKey;
}

/**
 * Inclusive-start / exclusive-end `YYYY-MM-DD` bounds for a year, mirroring
 * `monthRange`.
 */
export function yearRange(year: number): { start: string; end: string } {
  return { start: `${year}-01-01`, end: `${year + 1}-01-01` };
}

/** A Reports period unit: exactly Month or Year (design.md D3). */
export type PeriodUnit = 'month' | 'year';

/** Dispatch to `monthRange`/`yearRange` by unit, so callers don't branch. */
export function periodRange(unit: PeriodUnit, anchor: string): { start: string; end: string } {
  return unit === 'year' ? yearRange(Number(anchor)) : monthRange(anchor);
}

/** Shift an anchor (`YYYY-MM` or `YYYY`) by one period, by unit. */
export function addPeriods(unit: PeriodUnit, anchor: string, delta: number): string {
  return unit === 'year' ? addYears(anchor, delta) : addMonths(anchor, delta);
}

/** Human label for an anchor, by unit. */
export function periodLabel(unit: PeriodUnit, anchor: string): string {
  return unit === 'year' ? yearLabel(anchor) : monthLabel(anchor);
}

/** The current anchor for a unit (`YYYY-MM` or `YYYY`), by unit. */
export function currentPeriodAnchor(unit: PeriodUnit): string {
  return unit === 'year' ? currentYearKey() : currentMonthKey();
}

/**
 * Re-derive an anchor for a new unit from the current one, on a Month↔Year
 * switch: Month→Year keeps the year; Year→Month anchors to January (e.g.
 * switching Month→Year while viewing August 2026 shows the year 2026).
 */
export function convertAnchorUnit(anchor: string, toUnit: PeriodUnit): string {
  return toUnit === 'year' ? anchor.slice(0, 4) : `${anchor}-01`;
}

/**
 * True when the NEXT period's start date is after today — one rule for both
 * units (design.md D4). Disables arrowing into a guaranteed-empty future period.
 */
export function isNextPeriodDisabled(unit: PeriodUnit, anchor: string): boolean {
  const nextAnchor = addPeriods(unit, anchor, 1);
  const { start } = periodRange(unit, nextAnchor);
  return start > todayString();
}
