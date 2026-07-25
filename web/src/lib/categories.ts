import { doc, onSnapshot, runTransaction, setDoc } from 'firebase/firestore';
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
 * Create-if-absent seed write: only creates the categories doc when it does
 * not already exist server-side, so a stale/queued seed can never clobber the
 * owner's real category set even if it races a reconnect.
 */
async function seedCategoriesIfAbsent(ownerUid: string): Promise<void> {
  const ref = userDoc(ownerUid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) return;
    tx.set(ref, { categories: DEFAULT_CATEGORIES }, { merge: true });
  });
}

/**
 * Subscribe to the owner's categories, mirroring `subscribeToMonth`. Live
 * `onSnapshot` over `users/{uid}`. One-time seeds the defaults on first run,
 * but only once the server (not the local cache) has confirmed the doc is
 * absent — a cache-cold or offline "absent" snapshot doesn't prove the doc
 * doesn't exist, so it's ignored and the code simply waits for the server
 * snapshot. Never re-seeds once the doc exists, so deleting all categories
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
        if (snap.metadata.fromCache) {
          // Not server-confirmed: could be a cold/offline cache, not a real
          // first run. Wait for the server snapshot instead of seeding.
          return;
        }
        // Server-confirmed absence: genuine first run, seed once.
        if (!seeded) {
          seeded = true;
          seedCategoriesIfAbsent(ownerUid).catch((err) => onError?.(err as Error));
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
