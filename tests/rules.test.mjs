import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

// The firestore emulator sets GCLOUD_PROJECT; a `demo-` project needs no login.
const PROJECT = process.env.GCLOUD_PROJECT || 'demo-expenses';
const OWNER = 'owner-uid';
const OTHER = 'intruder-uid';

const validDoc = (ownerUid = OWNER) => ({
  amount: 12,
  date: '2026-07-04',
  comment: 'lunch',
  category: 'Groceries',
  ownerUid,
  source: 'web',
  needsReview: false,
});

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: {
      rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  });
});

after(async () => {
  await env?.cleanup();
});

test('owner can create and read their own valid spending', async () => {
  const db = env.authenticatedContext(OWNER).firestore();
  await assertSucceeds(setDoc(doc(db, 'spendings/s1'), validDoc()));
  await assertSucceeds(getDoc(doc(db, 'spendings/s1')));
});

test('another authenticated identity cannot read the owner data', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'spendings/s2'), validDoc());
  });
  const other = env.authenticatedContext(OTHER).firestore();
  await assertFails(getDoc(doc(other, 'spendings/s2')));
});

test('unauthenticated client cannot read or write', async () => {
  const anon = env.unauthenticatedContext().firestore();
  await assertFails(getDoc(doc(anon, 'spendings/s1')));
  await assertFails(setDoc(doc(anon, 'spendings/s3'), validDoc()));
});

test('invalid client writes are denied (bad amount, empty category, bad date)', async () => {
  const db = env.authenticatedContext(OWNER).firestore();
  await assertFails(setDoc(doc(db, 'spendings/bad1'), { ...validDoc(), amount: 0 }));
  await assertFails(setDoc(doc(db, 'spendings/bad2'), { ...validDoc(), amount: 1.5 }));
  // Category is no longer restricted to a fixed list, but it must be a non-empty string.
  await assertFails(setDoc(doc(db, 'spendings/bad3'), { ...validDoc(), category: '' }));
  await assertFails(setDoc(doc(db, 'spendings/bad4'), { ...validDoc(), date: 'not-a-date' }));
});

test('a spending with an arbitrary (non-list) category id is accepted', async () => {
  const db = env.authenticatedContext(OWNER).firestore();
  await assertSucceeds(
    setDoc(doc(db, 'spendings/custom1'), { ...validDoc(), category: 'some-custom-id' }),
  );
});

test('a needsReview entry may have amount 0', async () => {
  const db = env.authenticatedContext(OWNER).firestore();
  await assertSucceeds(
    setDoc(doc(db, 'spendings/review1'), {
      ...validDoc(),
      amount: 0,
      category: 'uncategorized',
      needsReview: true,
    }),
  );
});

test('cannot create a spending owned by someone else', async () => {
  const db = env.authenticatedContext(OWNER).firestore();
  await assertFails(setDoc(doc(db, 'spendings/spoof'), validDoc(OTHER)));
});

const categoriesDoc = () => ({
  categories: [{ id: 'groceries', name: 'Groceries', terms: [] }],
});

test('owner can read and write their own categories document', async () => {
  const db = env.authenticatedContext(OWNER).firestore();
  // Create.
  await assertSucceeds(setDoc(doc(db, `users/${OWNER}`), categoriesDoc()));
  // Read.
  await assertSucceeds(getDoc(doc(db, `users/${OWNER}`)));
  // Update.
  await assertSucceeds(
    setDoc(doc(db, `users/${OWNER}`), {
      categories: [{ id: 'groceries', name: 'Groceries', terms: ['market'] }],
    }),
  );
});

test('another identity cannot read or write the owner categories document', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `users/${OWNER}`), categoriesDoc());
  });
  const other = env.authenticatedContext(OTHER).firestore();
  await assertFails(getDoc(doc(other, `users/${OWNER}`)));
  await assertFails(setDoc(doc(other, `users/${OWNER}`), categoriesDoc()));
  // ...and cannot write a doc whose id mismatches their own uid either.
  await assertFails(setDoc(doc(other, 'users/some-other-uid'), categoriesDoc()));
});
