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

test('invalid client writes are denied (bad amount, bad category)', async () => {
  const db = env.authenticatedContext(OWNER).firestore();
  await assertFails(setDoc(doc(db, 'spendings/bad1'), { ...validDoc(), amount: 0 }));
  await assertFails(setDoc(doc(db, 'spendings/bad2'), { ...validDoc(), amount: 1.5 }));
  await assertFails(setDoc(doc(db, 'spendings/bad3'), { ...validDoc(), category: 'Nope' }));
  await assertFails(setDoc(doc(db, 'spendings/bad4'), { ...validDoc(), date: 'not-a-date' }));
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
