import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAmountFromTranscript,
  roundUpAmount,
  validateSpending,
  isAllowedCategory,
  shortDate,
  categorize,
  resolveCategory,
  findCategoryOwningTerm,
  findCategoryByName,
  slugify,
  DEFAULT_CATEGORIES,
  CATEGORY_PALETTE,
  nextAvailableColorId,
  colorIdFor,
  withCategoryColorChanged,
  sortCategoriesByName,
  groupByCategory,
  largestRemainderRound,
  aggregateByMonth,
  aggregateByDay,
  niceAxisMax,
} from '@expenses/shared';

// A small owner category set used across the matcher/uniqueness tests.
const CATS = [
  { id: 'groceries', name: 'Groceries', terms: ['market', 'aldi'] },
  { id: 'pet', name: 'Pet', terms: ['vet', 'pet'] },
  { id: 'health', name: 'Health', terms: [] },
];

test('roundUpAmount ceilings fractional, keeps integers', () => {
  assert.equal(roundUpAmount(12.34), 13);
  assert.equal(roundUpAmount(12.5), 13);
  assert.equal(roundUpAmount(12), 12);
  assert.equal(roundUpAmount(Number.NaN), null);
});

test('parser: amount and comment are separated', () => {
  const r = parseAmountFromTranscript('12 lunch');
  assert.equal(r.amount, 12);
  assert.equal(r.comment, 'lunch');
  assert.equal(r.needsReview, false);
});

test('parser: currency symbol ignored, decimal rounded up', () => {
  const r = parseAmountFromTranscript('£12.50 lunch');
  assert.equal(r.amount, 13);
  assert.equal(r.comment, 'lunch');
});

test('parser: first number wins, taken literally', () => {
  const r = parseAmountFromTranscript('1250 rent');
  assert.equal(r.amount, 1250);
  assert.equal(r.comment, 'rent');
});

test('parser: no number is flagged for review, raw text kept', () => {
  const r = parseAmountFromTranscript('coffee');
  assert.equal(r.amount, null);
  assert.equal(r.needsReview, true);
  assert.equal(r.comment, 'coffee');
});

test('parser: free-text add — first number is the amount, rest is the comment', () => {
  // Mirrors the quick-entry spec scenario: "coffee 4 for 2 people".
  const r = parseAmountFromTranscript('coffee 4 for 2 people');
  assert.equal(r.amount, 4);
  assert.equal(r.comment, 'coffee for 2 people');
});

test('shortDate: renders day-then-abbreviated-month, no UTC off-by-one', () => {
  assert.equal(shortDate('2026-06-07'), '7 Jun');
  assert.equal(shortDate('2026-01-01'), '1 Jan');
  assert.equal(shortDate('2026-12-31'), '31 Dec');
});

test('shortDate: malformed input is returned unchanged', () => {
  assert.equal(shortDate('not-a-date'), 'not-a-date');
});

test('validation: positive integer + non-empty category required', () => {
  assert.equal(validateSpending({ amount: 12, date: '2026-07-04', comment: 'x', category: 'Groceries' }).ok, true);
  assert.equal(validateSpending({ amount: 0, date: '2026-07-04', comment: '', category: 'Groceries' }).ok, false);
  assert.equal(validateSpending({ amount: 1.5, date: '2026-07-04', comment: '', category: 'Groceries' }).ok, false);
  // Category membership is no longer enforced, but it must be a non-empty string.
  assert.equal(validateSpending({ amount: 5, date: '2026-07-04', comment: '', category: '' }).ok, false);
  assert.equal(validateSpending({ amount: 5, date: 'bad', comment: '', category: 'Other' }).ok, false);
});

test('validation: uncategorized allowed; needsReview permits amount 0', () => {
  assert.equal(isAllowedCategory('uncategorized'), true);
  assert.equal(
    validateSpending({ amount: 0, date: '2026-07-04', comment: 'x', category: 'uncategorized', needsReview: true }).ok,
    true,
  );
});

// --- 2.1 auto-categorisation matcher ---

test('matcher: whole-word, case-insensitive', () => {
  // "Market" matches case-insensitively...
  assert.deepEqual(categorize('weekly Market run', CATS), { categoryId: 'groceries', matchedTerm: 'market' });
  // ...but a term must not match inside a larger word.
  assert.equal(categorize('bought a supermarket sandwich', CATS), null);
});

test('matcher: exactly one distinct category assigns and reports the term', () => {
  assert.deepEqual(categorize('trip to the vet', CATS), { categoryId: 'pet', matchedTerm: 'vet' });
});

test('matcher: no matching term leaves it uncategorized', () => {
  assert.equal(categorize('lunch with friends', CATS), null);
});

test('matcher: two distinct matching categories leave it uncategorized', () => {
  // "market" → Groceries and "pet" → Pet are two distinct categories.
  assert.equal(categorize('market and pet supplies', CATS), null);
});

test('matcher: an empty comment or no terms yields null', () => {
  assert.equal(categorize('', CATS), null);
  assert.equal(categorize('market', [{ id: 'x', name: 'X', terms: [] }]), null);
});

// --- 2.2 validation + resolution fallbacks ---

test('validation: an arbitrary id string and uncategorized are accepted', () => {
  assert.equal(isAllowedCategory('groceries'), true);
  assert.equal(isAllowedCategory('some-custom-id'), true);
  assert.equal(isAllowedCategory('uncategorized'), true);
  assert.equal(isAllowedCategory(''), false);
  assert.equal(
    validateSpending({ amount: 5, date: '2026-07-04', comment: '', category: 'some-custom-id' }).ok,
    true,
  );
});

test('resolveCategory: id → name fallback → uncategorized', () => {
  // Exact id match.
  assert.equal(resolveCategory('groceries', CATS)?.name, 'Groceries');
  // Legacy rows store the name; resolve case-insensitively.
  assert.equal(resolveCategory('groceries'.toUpperCase(), CATS)?.id, 'groceries');
  assert.equal(resolveCategory('Pet', CATS)?.id, 'pet');
  // Unresolvable id (removed category) and uncategorized → null.
  assert.equal(resolveCategory('gone', CATS), null);
  assert.equal(resolveCategory('uncategorized', CATS), null);
});

test('slugify + DEFAULT_CATEGORIES: stable slug ids, empty terms', () => {
  assert.equal(slugify('Groceries'), 'groceries');
  const groceries = DEFAULT_CATEGORIES.find((c) => c.name === 'Groceries');
  assert.equal(groceries.id, 'groceries');
  assert.deepEqual(groceries.terms, []);
  assert.equal(DEFAULT_CATEGORIES.length, 8);
});

// --- 2.3 uniqueness helpers ---

test('uniqueness: duplicate term across categories is detected with its owner', () => {
  const owner = findCategoryOwningTerm('Market', CATS);
  assert.equal(owner?.name, 'Groceries');
  // A free term is owned by nobody.
  assert.equal(findCategoryOwningTerm('unused', CATS), null);
  // Editing the owning category itself is not a conflict.
  assert.equal(findCategoryOwningTerm('market', CATS, 'groceries'), null);
});

test('uniqueness: duplicate category name is detected case-insensitively', () => {
  assert.equal(findCategoryByName('groceries', CATS)?.id, 'groceries');
  assert.equal(findCategoryByName('Travel', CATS), null);
  // Renaming a category to its own current name is not a conflict.
  assert.equal(findCategoryByName('Groceries', CATS, 'groceries'), null);
});

// --- category colors ---

test('nextAvailableColorId: picks the first palette color not already used', () => {
  const used = [
    { id: 'a', name: 'A', terms: [], colorId: CATEGORY_PALETTE[0].id },
    { id: 'b', name: 'B', terms: [], colorId: CATEGORY_PALETTE[1].id },
  ];
  assert.equal(nextAvailableColorId(used), CATEGORY_PALETTE[2].id);
  assert.equal(nextAvailableColorId([]), CATEGORY_PALETTE[0].id);
});

test('nextAvailableColorId: falls back to reuse once all 16 are used', () => {
  const allUsed = CATEGORY_PALETTE.map((p, i) => ({
    id: `cat-${i}`,
    name: `Cat ${i}`,
    terms: [],
    colorId: p.id,
  }));
  assert.equal(nextAvailableColorId(allUsed), CATEGORY_PALETTE[0].id);
});

test('colorIdFor: stored id wins over the positional fallback', () => {
  const cat = { id: 'a', name: 'A', terms: [], colorId: CATEGORY_PALETTE[5].id };
  assert.equal(colorIdFor(cat, 0), CATEGORY_PALETTE[5].id);
});

test('colorIdFor: missing id falls back deterministically by index, without mutating', () => {
  const cat = { id: 'a', name: 'A', terms: [] };
  assert.equal(colorIdFor(cat, 2), CATEGORY_PALETTE[2].id);
  assert.equal(colorIdFor(cat, 2 + CATEGORY_PALETTE.length), CATEGORY_PALETTE[2].id);
  assert.equal('colorId' in cat, false);
});

test('withCategoryColorChanged: updates only the targeted category', () => {
  const cats = [
    { id: 'a', name: 'A', terms: [], colorId: 'gray' },
    { id: 'b', name: 'B', terms: [], colorId: 'red' },
  ];
  const next = withCategoryColorChanged(cats, 'a', 'blue');
  assert.equal(next.find((c) => c.id === 'a').colorId, 'blue');
  assert.equal(next.find((c) => c.id === 'b').colorId, 'red');
  assert.equal(cats.find((c) => c.id === 'a').colorId, 'gray'); // original untouched
});

test('sortCategoriesByName: locale-aware, case-insensitive alphabetical order', () => {
  const cats = [
    { id: 'z', name: 'zebra', terms: [] },
    { id: 'a', name: 'Apple', terms: [] },
    { id: 'm', name: 'mango', terms: [] },
  ];
  assert.deepEqual(
    sortCategoriesByName(cats).map((c) => c.name),
    ['Apple', 'mango', 'zebra'],
  );
});

test('DEFAULT_CATEGORIES: all 8 have a colorId and no two share the same color', () => {
  assert.ok(DEFAULT_CATEGORIES.every((c) => typeof c.colorId === 'string' && c.colorId));
  const colorIds = DEFAULT_CATEGORIES.map((c) => c.colorId);
  assert.equal(new Set(colorIds).size, colorIds.length);
});

// --- Reports: category breakdown ---

const spend = (amount, date, category) => ({ amount, date, category, comment: '' });

test('groupByCategory: sorted by total descending, Uncategorised always last', () => {
  const rows = groupByCategory(
    [
      spend(1832, '2026-07-04', 'groceries'),
      spend(915, '2026-07-05', 'health'),
      spend(771, '2026-07-06', 'pet'),
      spend(5000, '2026-07-07', 'unresolvable-id'), // → uncategorized despite huge total
    ],
    CATS,
  );
  assert.deepEqual(
    rows.map((r) => r.categoryId),
    ['groceries', 'health', 'pet', 'uncategorized'],
  );
  assert.equal(rows[0].total, 1832);
  assert.equal(rows[rows.length - 1].name, 'Uncategorised');
});

test('groupByCategory: Uncategorised bucket always present, even at zero', () => {
  const rows = groupByCategory([spend(100, '2026-07-01', 'groceries')], CATS);
  const uncategorized = rows.find((r) => r.categoryId === 'uncategorized');
  assert.ok(uncategorized);
  assert.equal(uncategorized.total, 0);
  assert.equal(uncategorized.share, 0);
});

test('groupByCategory: share is exact (not rounded), 0 for an empty period', () => {
  const rows = groupByCategory(
    [spend(30, '2026-07-01', 'groceries'), spend(70, '2026-07-02', 'pet')],
    CATS,
  );
  const groceries = rows.find((r) => r.categoryId === 'groceries');
  assert.equal(groceries.share, 0.3);
  assert.deepEqual(
    groupByCategory([], CATS).map((r) => r.share),
    [0],
  );
});

// --- Reports: largest-remainder percentage rounding ---

test('largestRemainderRound: sums to exactly 100 even when independent rounding would not', () => {
  // 8 equal shares of 1/8 each floor to 12, summing to 96 — 4 points to distribute.
  const shares = new Array(8).fill(1 / 8);
  const pcts = largestRemainderRound(shares);
  assert.equal(pcts.reduce((a, b) => a + b, 0), 100);
});

test('largestRemainderRound: extra points go to the largest fractional remainders', () => {
  // .3, .3, .4 floor to 30/30/40 = 100 exactly — no remainder to distribute.
  assert.deepEqual(largestRemainderRound([0.3, 0.3, 0.4]), [30, 30, 40]);
  // .333, .333, .334 floor to 33/33/33 = 99 — the 1 remaining point goes to
  // the largest fractional remainder (index 2, .334's fraction beats .333's).
  assert.deepEqual(largestRemainderRound([0.333, 0.333, 0.334]), [33, 33, 34]);
});

test('largestRemainderRound: an empty period (all-zero shares) returns all zeros, not 100', () => {
  assert.deepEqual(largestRemainderRound([0, 0]), [0, 0]);
});

// --- Reports: aggregation ---

test('aggregateByMonth: 12 entries, only the given year counted', () => {
  const totals = aggregateByMonth(
    [spend(100, '2026-01-15'), spend(50, '2026-01-20'), spend(200, '2026-03-01'), spend(999, '2025-12-31')],
    2026,
  );
  assert.equal(totals.length, 12);
  assert.equal(totals[0], 150);
  assert.equal(totals[2], 200);
  assert.equal(totals[11], 0);
});

test('aggregateByDay: one entry per day of the month, only that month counted', () => {
  const totals = aggregateByDay(
    [spend(10, '2026-02-01'), spend(5, '2026-02-01'), spend(20, '2026-02-28'), spend(999, '2026-03-01')],
    '2026-02',
  );
  assert.equal(totals.length, 28); // 2026 is not a leap year
  assert.equal(totals[0], 15);
  assert.equal(totals[27], 20);
});

test('niceAxisMax: rounds up to the smallest 1/2/5/10 step at or above the raw peak', () => {
  assert.equal(niceAxisMax(913), 1000);
  assert.equal(niceAxisMax(1), 1);
  assert.equal(niceAxisMax(150), 200);
  assert.equal(niceAxisMax(420), 500);
  assert.equal(niceAxisMax(0), 1);
});
