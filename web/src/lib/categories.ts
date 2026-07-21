import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import {
  DEFAULT_CATEGORIES,
  USERS_COLLECTION,
  withCategoryAdded,
  withCategoryRemoved,
  withCategoryRenamed,
  withTermAdded,
  withTermRemoved,
  type Category,
} from '@expenses/shared';
import { db } from './firebase';

const userDoc = (ownerUid: string) => doc(db, USERS_COLLECTION, ownerUid);

/** Persist the full category set (single-doc write; merges to preserve other user fields). */
async function writeCategories(ownerUid: string, categories: Category[]): Promise<void> {
  await setDoc(userDoc(ownerUid), { categories }, { merge: true });
}

/**
 * Subscribe to the owner's categories, mirroring `subscribeToMonth`. Live
 * `onSnapshot` over `users/{uid}`. One-time seeds the defaults on first run
 * (doc absent); never re-seeds once the doc exists, so deleting all categories
 * is a persistent, valid state. Returns an unsubscribe function.
 */
export function subscribeToCategories(
  ownerUid: string,
  onData: (categories: Category[]) => void,
  onError?: (err: Error) => void,
): () => void {
  let seeded = false;
  return onSnapshot(
    userDoc(ownerUid),
    (snap) => {
      if (!snap.exists()) {
        // First run: seed once. The write triggers a fresh snapshot with the
        // persisted defaults; surface them optimistically in the meantime.
        if (!seeded) {
          seeded = true;
          writeCategories(ownerUid, DEFAULT_CATEGORIES).catch((err) => onError?.(err as Error));
        }
        onData(DEFAULT_CATEGORIES);
        return;
      }
      const data = snap.data() as { categories?: Category[] };
      onData(data.categories ?? []);
    },
    (err) => onError?.(err),
  );
}

/**
 * Writers below take the caller's current `categories` (from the live
 * subscription), apply a pure shared transform (which enforces name/term
 * uniqueness and throws an `Error` whose message the manager UI shows inline),
 * then persist the whole set. Uniqueness is app-enforced (not by rules); at
 * single-owner scale a concurrent-edit race is negligible.
 */
export async function addCategory(
  ownerUid: string,
  categories: Category[],
  name: string,
): Promise<void> {
  await writeCategories(ownerUid, withCategoryAdded(categories, name));
}

export async function renameCategory(
  ownerUid: string,
  categories: Category[],
  id: string,
  name: string,
): Promise<void> {
  await writeCategories(ownerUid, withCategoryRenamed(categories, id, name));
}

/** Non-destructive: existing spendings keep their stored id and render "Uncategorised". */
export async function removeCategory(
  ownerUid: string,
  categories: Category[],
  id: string,
): Promise<void> {
  await writeCategories(ownerUid, withCategoryRemoved(categories, id));
}

export async function addTerm(
  ownerUid: string,
  categories: Category[],
  id: string,
  term: string,
): Promise<void> {
  await writeCategories(ownerUid, withTermAdded(categories, id, term));
}

export async function removeTerm(
  ownerUid: string,
  categories: Category[],
  id: string,
  term: string,
): Promise<void> {
  await writeCategories(ownerUid, withTermRemoved(categories, id, term));
}
