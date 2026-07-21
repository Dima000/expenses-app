import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import {
  assertValidSpending,
  roundUpAmount,
  SPENDINGS_COLLECTION,
  type Spending,
  type SpendingInput,
  type SpendingSource,
} from '@expenses/shared';
import { db } from './firebase';
import { monthRange } from './date';

const col = () => collection(db, SPENDINGS_COLLECTION);

/**
 * Subscribe to a month's spendings for the owner, newest first. Uses a live
 * snapshot so a write on any device shows up here automatically (spec:
 * cross-device sync). Returns an unsubscribe function.
 *
 * Ordered by `date desc` via a composite index; same-day entries are then
 * ordered by creation time client-side (avoids a second index field).
 */
export function subscribeToMonth(
  ownerUid: string,
  monthKey: string,
  onData: (spendings: Spending[]) => void,
  onError?: (err: Error) => void,
): () => void {
  const { start, end } = monthRange(monthKey);
  const q = query(
    col(),
    where('ownerUid', '==', ownerUid),
    where('date', '>=', start),
    where('date', '<', end),
    orderBy('date', 'desc'),
  );

  return onSnapshot(
    q,
    (snap) => {
      const rows: Spending[] = snap.docs.map((d) => {
        const data = d.data();
        const createdAt = data.createdAt as Timestamp | null;
        return {
          id: d.id,
          amount: data.amount,
          date: data.date,
          comment: data.comment ?? '',
          category: data.category,
          autoMatchedTerm: data.autoMatchedTerm,
          needsReview: data.needsReview ?? false,
          ownerUid: data.ownerUid,
          source: data.source,
          createdAtMs: createdAt?.toMillis?.() ?? null,
        };
      });
      // Tiebreak same-date rows by creation time, newest first.
      rows.sort((a, b) =>
        a.date === b.date ? (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0) : 0,
      );
      onData(rows);
    },
    (err) => onError?.(err),
  );
}

/**
 * Create a spending via the client SDK (guarded by Auth + security rules).
 * This is the shared web/voice write path; round-up + validation run here
 * exactly as the server's `recordSpending()` does.
 */
export async function createSpending(
  input: SpendingInput,
  ownerUid: string,
  source: SpendingSource,
): Promise<string> {
  const rounded = roundUpAmount(Number(input.amount));
  const valid = assertValidSpending({ ...input, amount: rounded as number });
  const ref = await addDoc(col(), {
    amount: valid.amount,
    date: valid.date,
    comment: valid.comment,
    category: valid.category,
    // Only persisted when auto-categorisation fired (never write `undefined`).
    ...(valid.autoMatchedTerm ? { autoMatchedTerm: valid.autoMatchedTerm } : {}),
    needsReview: valid.needsReview ?? false,
    ownerUid,
    source,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Update the mutable fields of an existing spending after validation. */
export async function updateSpending(id: string, input: SpendingInput): Promise<void> {
  const rounded = roundUpAmount(Number(input.amount));
  const valid = assertValidSpending({ ...input, amount: rounded as number });
  await updateDoc(doc(db, SPENDINGS_COLLECTION, id), {
    amount: valid.amount,
    date: valid.date,
    comment: valid.comment,
    category: valid.category,
    // Clear any stale matched-term when an edit no longer auto-categorises.
    autoMatchedTerm: valid.autoMatchedTerm ?? deleteField(),
    needsReview: valid.needsReview ?? false,
  });
}

/** Assign a category to an uncategorized spending (categorize-later flow). */
export async function assignCategory(id: string, category: SpendingInput['category']): Promise<void> {
  await updateDoc(doc(db, SPENDINGS_COLLECTION, id), { category });
}

export async function deleteSpending(id: string): Promise<void> {
  await deleteDoc(doc(db, SPENDINGS_COLLECTION, id));
}
