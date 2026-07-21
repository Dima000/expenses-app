import { getFirestore, FieldValue, type Firestore } from 'firebase-admin/firestore';
import {
  applyAutoCategory,
  assertValidSpending,
  roundUpAmount,
  SpendingValidationError,
  SPENDINGS_COLLECTION,
  UNCATEGORIZED,
  USERS_COLLECTION,
  type Category,
  type SpendingInput,
  type SpendingSource,
} from '@expenses/shared';

export interface RecordSpendingOptions {
  ownerUid: string;
  source: SpendingSource;
}

/**
 * The canonical write path (design.md D2). Every server-side adapter creates
 * spendings through this one function so validation and persistence are
 * identical across paths.
 *
 * Round-up is applied ONCE here (design.md D1) so any input path — REST now,
 * Telegram bot later — stores whole-unit amounts consistently. Then the shared
 * validator runs; on failure a {@link SpendingValidationError} is thrown.
 *
 * @returns the created Firestore document id.
 */
export async function recordSpending(
  input: Partial<SpendingInput> | undefined,
  { ownerUid, source }: RecordSpendingOptions,
  db: Firestore = getFirestore(),
): Promise<string> {
  if (!ownerUid) throw new SpendingValidationError(['ownerUid is required']);

  // Round up before validation so fractional inputs from any path are accepted
  // and stored as whole units (spec: "fractional amount is rounded up").
  const rounded = input?.amount === undefined || input.amount === null
    ? input?.amount
    : roundUpAmount(Number(input.amount));

  const valid = assertValidSpending({ ...input, amount: rounded as number });

  // Auto-categorise identically to the client via the shared policy (design.md:
  // "Auto-categorisation on every write path"). The categories doc is read
  // lazily — only when the caller left the category `uncategorized` — so
  // explicit-category writes cost no extra read.
  let toWrite = valid;
  if (valid.category === UNCATEGORIZED) {
    const userSnap = await db.collection(USERS_COLLECTION).doc(ownerUid).get();
    const categories: Category[] = userSnap.data()?.categories ?? [];
    toWrite = applyAutoCategory(valid, categories);
  }

  const ref = await db.collection(SPENDINGS_COLLECTION).add({
    amount: toWrite.amount,
    date: toWrite.date,
    comment: toWrite.comment,
    category: toWrite.category,
    needsReview: toWrite.needsReview ?? false,
    ownerUid,
    source,
    // Only persist the matched term when auto-assignment fired — never write
    // `undefined` to Firestore.
    ...(toWrite.autoMatchedTerm ? { autoMatchedTerm: toWrite.autoMatchedTerm } : {}),
    createdAt: FieldValue.serverTimestamp(),
  });

  return ref.id;
}
