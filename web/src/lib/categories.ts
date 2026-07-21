import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import {
  DEFAULT_CATEGORIES,
  USERS_COLLECTION,
  findCategoryByName,
  findCategoryOwningTerm,
  slugify,
  type Category,
} from '@expenses/shared';
import { db } from './firebase';

const userDoc = (ownerUid: string) => doc(db, USERS_COLLECTION, ownerUid);

/** Persist the full category set (single-doc write; merges to preserve other user fields). */
async function writeCategories(ownerUid: string, categories: Category[]): Promise<void> {
  await setDoc(userDoc(ownerUid), { categories }, { merge: true });
}

/** A slug id not already used by another category (disambiguates collisions). */
function uniqueId(base: string, categories: readonly Category[]): string {
  const seed = base || 'category';
  const ids = new Set(categories.map((c) => c.id));
  if (!ids.has(seed)) return seed;
  let n = 2;
  while (ids.has(`${seed}-${n}`)) n++;
  return `${seed}-${n}`;
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
 * subscription), enforce name/term uniqueness via the shared helpers, then
 * write the whole set. On a conflict they throw an `Error` whose message is
 * shown inline by the manager UI. Term/name uniqueness is app-enforced (not by
 * rules); at single-owner scale a concurrent-edit race is negligible.
 */
export async function addCategory(
  ownerUid: string,
  categories: Category[],
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name is required');
  const dup = findCategoryByName(trimmed, categories);
  if (dup) throw new Error(`A category named "${dup.name}" already exists`);
  const id = uniqueId(slugify(trimmed), categories);
  await writeCategories(ownerUid, [...categories, { id, name: trimmed, terms: [] }]);
}

export async function renameCategory(
  ownerUid: string,
  categories: Category[],
  id: string,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name is required');
  const dup = findCategoryByName(trimmed, categories, id);
  if (dup) throw new Error(`A category named "${dup.name}" already exists`);
  await writeCategories(
    ownerUid,
    categories.map((c) => (c.id === id ? { ...c, name: trimmed } : c)),
  );
}

/** Non-destructive: existing spendings keep their stored id and render "Uncategorised". */
export async function removeCategory(
  ownerUid: string,
  categories: Category[],
  id: string,
): Promise<void> {
  await writeCategories(
    ownerUid,
    categories.filter((c) => c.id !== id),
  );
}

export async function addTerm(
  ownerUid: string,
  categories: Category[],
  id: string,
  term: string,
): Promise<void> {
  const trimmed = term.trim();
  if (!trimmed) throw new Error('Term is required');
  const owner = findCategoryOwningTerm(trimmed, categories);
  if (owner) {
    if (owner.id === id) return; // already on this category — no-op
    throw new Error(`"${trimmed}" is already in ${owner.name}`);
  }
  await writeCategories(
    ownerUid,
    categories.map((c) => (c.id === id ? { ...c, terms: [...c.terms, trimmed] } : c)),
  );
}

export async function removeTerm(
  ownerUid: string,
  categories: Category[],
  id: string,
  term: string,
): Promise<void> {
  const lower = term.trim().toLowerCase();
  await writeCategories(
    ownerUid,
    categories.map((c) =>
      c.id === id ? { ...c, terms: c.terms.filter((t) => t.trim().toLowerCase() !== lower) } : c,
    ),
  );
}
