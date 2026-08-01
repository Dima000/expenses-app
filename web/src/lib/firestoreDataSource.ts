import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Timestamp,
} from 'firebase/firestore';
import {
  assertValidSpending,
  DEFAULT_CATEGORIES,
  roundUpAmount,
  SPENDINGS_COLLECTION,
  USERS_COLLECTION,
  withCategoryAdded,
  withCategoryColorChanged,
  withCategoryRemoved,
  withCategoryRenamed,
  withTermAdded,
  withTermRemoved,
  type Category,
  type CategoryValue,
  type Spending,
  type SpendingInput,
  type SpendingSource,
} from '@expenses/shared';
import { db } from './firebase';
import { monthRange } from './date';
import type { DataSource, Unsubscribe } from './dataSource';

/**
 * Firestore-backed `DataSource`. `ownerUid` is fixed at construction (one
 * instance per signed-in owner) instead of being passed on every call.
 * Keeps its own last-known `categories` snapshot (from `subscribeToCategories`)
 * so the category writers can apply their read-modify-write transform without
 * requiring the caller to pass the current set on every write.
 */
export class FirestoreDataSource implements DataSource {
  private categoriesCache: Category[] = [];

  constructor(private readonly ownerUid: string) {}

  private col() {
    return collection(db, SPENDINGS_COLLECTION);
  }

  private userDoc() {
    return doc(db, USERS_COLLECTION, this.ownerUid);
  }

  private async writeCategories(categories: Category[]): Promise<void> {
    await setDoc(this.userDoc(), { categories }, { merge: true });
  }

  /**
   * Create-if-absent seed write: only creates the categories doc when it does
   * not already exist server-side, so a stale/queued seed can never clobber
   * the owner's real category set even if it races a reconnect.
   */
  private async seedCategoriesIfAbsent(): Promise<void> {
    const ref = this.userDoc();
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (snap.exists()) return;
      tx.set(ref, { categories: DEFAULT_CATEGORIES }, { merge: true });
    });
  }

  /**
   * Subscribe to an arbitrary `[start, end)` date range's spendings for the
   * owner, newest first. Uses a live snapshot so a write on any device shows
   * up here automatically (spec: cross-device sync). Returns an unsubscribe
   * function.
   *
   * Ordered by `date desc` via the existing `(ownerUid, date)` composite index,
   * which covers any range since `date` is a fixed-width `YYYY-MM-DD` string
   * (lexicographic range = chronological range); same-day entries are then
   * ordered by creation time client-side (avoids a second index field).
   */
  subscribeToRange(
    start: string,
    end: string,
    onData: (spendings: Spending[]) => void,
    onError?: (err: Error) => void,
  ): Unsubscribe {
    const q = query(
      this.col(),
      where('ownerUid', '==', this.ownerUid),
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

  /** Subscribe to a single month's spendings — a thin wrapper over `subscribeToRange`. */
  subscribeToMonth(
    monthKey: string,
    onData: (spendings: Spending[]) => void,
    onError?: (err: Error) => void,
  ): Unsubscribe {
    const { start, end } = monthRange(monthKey);
    return this.subscribeToRange(start, end, onData, onError);
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
  subscribeToCategories(
    onData: (categories: Category[]) => void,
    onError?: (err: Error) => void,
  ): Unsubscribe {
    let seeded = false;
    return onSnapshot(
      this.userDoc(),
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
            this.seedCategoriesIfAbsent().catch((err) => onError?.(err as Error));
          }
          this.categoriesCache = DEFAULT_CATEGORIES;
          onData(DEFAULT_CATEGORIES);
          return;
        }
        const data = snap.data() as { categories?: Category[] };
        const categories = data.categories ?? [];
        this.categoriesCache = categories;
        onData(categories);
      },
      (err) => onError?.(err),
    );
  }

  /**
   * Create a spending via the client SDK (guarded by Auth + security rules).
   * This is the shared web/voice write path; round-up + validation run here
   * exactly as the server's `recordSpending()` does.
   */
  async createSpending(input: SpendingInput, source: SpendingSource): Promise<string> {
    const rounded = roundUpAmount(Number(input.amount));
    const valid = assertValidSpending({ ...input, amount: rounded as number });
    const ref = await addDoc(this.col(), {
      amount: valid.amount,
      date: valid.date,
      comment: valid.comment,
      category: valid.category,
      // Only persisted when auto-categorisation fired (never write `undefined`).
      ...(valid.autoMatchedTerm ? { autoMatchedTerm: valid.autoMatchedTerm } : {}),
      needsReview: valid.needsReview ?? false,
      ownerUid: this.ownerUid,
      source,
      createdAt: serverTimestamp(),
    });
    return ref.id;
  }

  /** Update the mutable fields of an existing spending after validation. */
  async updateSpending(id: string, input: SpendingInput): Promise<void> {
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
  async assignCategory(id: string, category: CategoryValue): Promise<void> {
    await updateDoc(doc(db, SPENDINGS_COLLECTION, id), { category });
  }

  async deleteSpending(id: string): Promise<void> {
    await deleteDoc(doc(db, SPENDINGS_COLLECTION, id));
  }

  /**
   * Writers below apply a pure shared transform over the last-known
   * `categories` snapshot (which enforces name/term uniqueness and throws an
   * `Error` whose message the manager UI shows inline), then persist the
   * whole set. Uniqueness is app-enforced (not by rules); at single-owner
   * scale a concurrent-edit race is negligible.
   */
  async addCategory(name: string): Promise<void> {
    await this.writeCategories(withCategoryAdded(this.categoriesCache, name));
  }

  async renameCategory(id: string, name: string): Promise<void> {
    await this.writeCategories(withCategoryRenamed(this.categoriesCache, id, name));
  }

  async setCategoryColor(id: string, colorId: string): Promise<void> {
    await this.writeCategories(withCategoryColorChanged(this.categoriesCache, id, colorId));
  }

  /** Non-destructive: existing spendings keep their stored id and render "Uncategorised". */
  async removeCategory(id: string): Promise<void> {
    await this.writeCategories(withCategoryRemoved(this.categoriesCache, id));
  }

  async addTerm(id: string, term: string): Promise<void> {
    await this.writeCategories(withTermAdded(this.categoriesCache, id, term));
  }

  async removeTerm(id: string, term: string): Promise<void> {
    await this.writeCategories(withTermRemoved(this.categoriesCache, id, term));
  }
}
