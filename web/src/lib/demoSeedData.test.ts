import { describe, expect, it } from 'vitest';
import { applyAutoCategory, DEFAULT_CATEGORIES, UNCATEGORIZED } from '@expenses/shared';
import { buildDemoCategories, generateDemoSpendings } from './demoSeedData';
import { toDateString } from './date';

const TODAY = new Date(2026, 7, 1); // 2026-08-01, matches this repo's "current" date

describe('generateDemoSpendings', () => {
  it('is deterministic for the same "today"', () => {
    const a = generateDemoSpendings(TODAY);
    const b = generateDemoSpendings(TODAY);
    expect(b).toEqual(a);
  });

  it('spans the required range and volume', () => {
    const rows = generateDemoSpendings(TODAY);
    const dates = rows.map((r) => r.date);
    const earliest = dates.reduce((a, b) => (a < b ? a : b));
    const latest = dates.reduce((a, b) => (a > b ? a : b));

    // Prior-year window: 2025-01-01..2025-12-31.
    expect(earliest >= '2025-01-01' && earliest < '2026-01-01').toBe(true);
    // Current-year window, never past "today".
    expect(latest >= '2026-01-01' && latest <= '2026-08-01').toBe(true);

    // 4 current-year months + 3 prior-year months, ~30 entries each.
    expect(rows.length).toBe(210);
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
