import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAmountFromTranscript,
  roundUpAmount,
  validateSpending,
  isAllowedCategory,
} from '@expenses/shared';

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

test('validation: positive integer + allowed category required', () => {
  assert.equal(validateSpending({ amount: 12, date: '2026-07-04', comment: 'x', category: 'Groceries' }).ok, true);
  assert.equal(validateSpending({ amount: 0, date: '2026-07-04', comment: '', category: 'Groceries' }).ok, false);
  assert.equal(validateSpending({ amount: 1.5, date: '2026-07-04', comment: '', category: 'Groceries' }).ok, false);
  assert.equal(validateSpending({ amount: 5, date: '2026-07-04', comment: '', category: 'Nope' }).ok, false);
  assert.equal(validateSpending({ amount: 5, date: 'bad', comment: '', category: 'Other' }).ok, false);
});

test('validation: uncategorized allowed; needsReview permits amount 0', () => {
  assert.equal(isAllowedCategory('uncategorized'), true);
  assert.equal(
    validateSpending({ amount: 0, date: '2026-07-04', comment: 'x', category: 'uncategorized', needsReview: true }).ok,
    true,
  );
});
