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
