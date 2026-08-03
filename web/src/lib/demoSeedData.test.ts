import { describe, expect, it } from 'vitest';
import {
  applyAutoCategory,
  DEFAULT_CATEGORIES,
  UNCATEGORIZED,
  type Spending,
} from '@expenses/shared';
import { buildDemoCategories, generateDemoSpendings } from './demoSeedData';
import { addMonths, toDateString } from './date';

const TODAY = new Date(2026, 7, 1); // 2026-08-01, matches this repo's "current" date
// A second "today" early in January, covering the edge design.md D5 accepts:
// the current year holds only a few days of data.
const JAN_TODAY = new Date(2026, 0, 5);

const monthKey = (date: string) => date.slice(0, 7);

/** Every month key from January of the prior year through the month of `today`. */
function expectedMonths(today: Date): string[] {
  const last = monthKey(toDateString(today));
  const keys: string[] = [];
  for (let key = `${today.getFullYear() - 1}-01`; key <= last; key = addMonths(key, 1)) {
    keys.push(key);
  }
  return keys;
}

function groupByMonth(rows: Spending[]): Map<string, Spending[]> {
  const byMonth = new Map<string, Spending[]>();
  for (const row of rows) {
    const key = monthKey(row.date);
    const bucket = byMonth.get(key);
    if (bucket) bucket.push(row);
    else byMonth.set(key, [row]);
  }
  return byMonth;
}

/** Distinct dates per category within one month's rows — what the drilldown heatmap lights up. */
function distinctDaysByCategory(rows: Spending[]): number[] {
  const days = new Map<string, Set<string>>();
  for (const row of rows) {
    const key = String(row.category);
    const bucket = days.get(key);
    if (bucket) bucket.add(row.date);
    else days.set(key, new Set([row.date]));
  }
  return [...days.values()].map((s) => s.size);
}

/** Months excluding the partially-covered current one. */
function fullyCoveredMonths(rows: Spending[], today: Date): [string, Spending[]][] {
  const current = monthKey(toDateString(today));
  return [...groupByMonth(rows).entries()].filter(([key]) => key !== current);
}

describe('generateDemoSpendings', () => {
  it('is deterministic for the same "today"', () => {
    const a = generateDemoSpendings(TODAY);
    const b = generateDemoSpendings(TODAY);
    expect(b).toEqual(a);
  });

  describe.each([
    ['mid-year "today"', TODAY],
    ['early-January "today"', JAN_TODAY],
  ])('with a %s', (_label, today) => {
    const rows = generateDemoSpendings(today);
    const fullMonths = fullyCoveredMonths(rows, today);

    it('spans the full prior year and the current year to date', () => {
      const dates = rows.map((r) => r.date);
      const earliest = dates.reduce((a, b) => (a < b ? a : b));
      expect(monthKey(earliest)).toBe(`${today.getFullYear() - 1}-01`);

      const covered = new Set(dates.map(monthKey));
      expect([...covered].sort()).toEqual(expectedMonths(today));
    });

    it('dates no entry after "today"', () => {
      const todayStr = toDateString(today);
      expect(rows.every((r) => r.date <= todayStr)).toBe(true);
    });

    // Offending months are collected rather than asserted in a loop, so a
    // failure names the month(s) at fault instead of just the first one.
    it('gives every fully covered month a plausible volume', () => {
      const offenders = fullMonths
        .filter(([, monthRows]) => monthRows.length < 30 || monthRows.length > 45)
        .map(([key, monthRows]) => `${key}: ${monthRows.length}`);
      expect(offenders).toEqual([]);
    });

    it('fills the drilldown heatmap for at least two categories every month', () => {
      const offenders = fullMonths
        .filter(
          ([, monthRows]) =>
            distinctDaysByCategory(monthRows).filter((days) => days >= 8).length < 2,
        )
        .map(([key]) => key);
      expect(offenders).toEqual([]);
    });

    it('keeps at least one category at roughly one day per month', () => {
      const offenders = fullMonths
        .filter(([, monthRows]) => !distinctDaysByCategory(monthRows).some((days) => days <= 1))
        .map(([key]) => key);
      expect(offenders).toEqual([]);
    });
  });

  it('keeps the current month proportional to the elapsed days', () => {
    // "Today" is the 1st, so the current month holds only what the cadences
    // produced for that one day — not a full month's volume compressed onto it.
    const rows = generateDemoSpendings(TODAY);
    const current = rows.filter((r) => monthKey(r.date) === monthKey(toDateString(TODAY)));
    expect(current.length).toBeGreaterThan(0);
    expect(current.length).toBeLessThan(10);
  });

  it('includes the required mix', () => {
    const rows = generateDemoSpendings(TODAY);
    expect(rows.some((r) => r.category === UNCATEGORIZED)).toBe(true);
    expect(rows.some((r) => r.needsReview === true)).toBe(true);
    expect(rows.some((r) => r.date === toDateString(TODAY))).toBe(true);
  });

  it('uses source "web" for every entry', () => {
    const rows = generateDemoSpendings(TODAY);
    expect(rows.every((r) => r.source === 'web')).toBe(true);
  });

  it('does not mutate the shared DEFAULT_CATEGORIES export', () => {
    generateDemoSpendings(TODAY);
    const groceries = DEFAULT_CATEGORIES.find((c) => c.id === 'groceries');
    const utilities = DEFAULT_CATEGORIES.find((c) => c.id === 'utilities');
    expect(groceries?.terms).toEqual([]);
    expect(utilities?.terms).toEqual([]);
  });

  it('produces at least one entry matching what the real matcher returns for its comment', () => {
    const demoCategories = buildDemoCategories();
    const rows = generateDemoSpendings(TODAY, demoCategories);
    const autoMatched = rows.find((r) => r.autoMatchedTerm);
    expect(autoMatched).toBeDefined();

    const recomputed = applyAutoCategory(
      {
        amount: autoMatched!.amount,
        date: autoMatched!.date,
        comment: autoMatched!.comment,
        category: UNCATEGORIZED,
        needsReview: false,
      },
      demoCategories,
    );
    expect(recomputed.category).toBe(autoMatched!.category);
    expect(recomputed.autoMatchedTerm).toBe(autoMatched!.autoMatchedTerm);
  });
});
