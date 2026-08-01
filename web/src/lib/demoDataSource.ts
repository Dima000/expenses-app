import {
  assertValidSpending,
  roundUpAmount,
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
import { buildDemoCategories, DEMO_OWNER_UID, generateDemoSpendings } from './demoSeedData';
import { monthRange } from './date';
import type { DataSource, Unsubscribe } from './dataSource';

interface SpendingListener {
  matches(spending: Spending): boolean;
  onData(spendings: Spending[]): void;
}

/** Newest first by date, same-date rows tiebroken by creation order — mirrors `FirestoreDataSource`. */
function sortSpendingsDesc(rows: readonly Spending[]): Spending[] {
  return [...rows].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.createdAtMs ?? 0) - (a.createdAtMs ?? 0);
  });
}

/**
 * In-memory `DataSource` implementation, seeded with the deterministic demo
 * dataset (design.md). Holds `spendings`/`categories` as private instance
 * state plus a listener set per subscription kind; a write mutates state then
 * notifies listeners on a microtask, mirroring `onSnapshot`'s async delivery
 * so component code can't accidentally depend on synchronous notification.
 * Never imports or calls into Firestore.
 */
export class DemoDataSource implements DataSource {
  private spendings: Spending[];
  private categories: Category[];
  private readonly spendingListeners = new Set<SpendingListener>();
  private readonly categoryListeners = new Set<(categories: Category[]) => void>();
  private nextCreatedId = 0;

  constructor(today: Date = new Date()) {
    this.categories = buildDemoCategories();
    this.spendings = generateDemoSpendings(today, this.categories);
  }

  private notifySpendingListener(listener: SpendingListener): void {
    queueMicrotask(() => {
      if (!this.spendingListeners.has(listener)) return; // unsubscribed before the microtask ran
      listener.onData(sortSpendingsDesc(this.spendings.filter((s) => listener.matches(s))));
    });
  }

  private notifyAllSpendingListeners(): void {
    for (const listener of this.spendingListeners) this.notifySpendingListener(listener);
  }

  private notifyAllCategoryListeners(): void {
    const snapshot = [...this.categories];
    for (const onData of this.categoryListeners) {
      queueMicrotask(() => {
        if (!this.categoryListeners.has(onData)) return;
        onData(snapshot);
      });
    }
  }

  subscribeToRange(
    start: string,
    end: string,
    onData: (spendings: Spending[]) => void,
  ): Unsubscribe {
    const listener: SpendingListener = {
      matches: (s) => s.date >= start && s.date < end,
      onData,
    };
    this.spendingListeners.add(listener);
    this.notifySpendingListener(listener);
    return () => this.spendingListeners.delete(listener);
  }

  subscribeToMonth(monthKey: string, onData: (spendings: Spending[]) => void): Unsubscribe {
    const { start, end } = monthRange(monthKey);
    return this.subscribeToRange(start, end, onData);
  }

  subscribeToCategories(onData: (categories: Category[]) => void): Unsubscribe {
    this.categoryListeners.add(onData);
    queueMicrotask(() => {
      if (!this.categoryListeners.has(onData)) return;
      onData([...this.categories]);
    });
    return () => this.categoryListeners.delete(onData);
  }

  async createSpending(input: SpendingInput, source: SpendingSource): Promise<string> {
    const rounded = roundUpAmount(Number(input.amount));
    const valid = assertValidSpending({ ...input, amount: rounded as number });
    const id = `demo-created-${this.nextCreatedId++}`;
    this.spendings = [
      ...this.spendings,
      {
        ...valid,
        id,
        ownerUid: DEMO_OWNER_UID,
        source,
        createdAtMs: Date.now(),
      },
    ];
    this.notifyAllSpendingListeners();
    return id;
  }

  async updateSpending(id: string, input: SpendingInput): Promise<void> {
    const rounded = roundUpAmount(Number(input.amount));
    const valid = assertValidSpending({ ...input, amount: rounded as number });
    this.spendings = this.spendings.map((s) =>
      s.id === id
        ? {
            ...s,
            amount: valid.amount,
            date: valid.date,
            comment: valid.comment,
            category: valid.category,
            // Clear any stale matched-term when an edit no longer auto-categorises.
            autoMatchedTerm: valid.autoMatchedTerm,
            needsReview: valid.needsReview ?? false,
          }
        : s,
    );
    this.notifyAllSpendingListeners();
  }

  async assignCategory(id: string, category: CategoryValue): Promise<void> {
    this.spendings = this.spendings.map((s) => (s.id === id ? { ...s, category } : s));
    this.notifyAllSpendingListeners();
  }

  async deleteSpending(id: string): Promise<void> {
    this.spendings = this.spendings.filter((s) => s.id !== id);
    this.notifyAllSpendingListeners();
  }

  private writeCategories(categories: Category[]): void {
    this.categories = categories;
    this.notifyAllCategoryListeners();
  }

  async addCategory(name: string): Promise<void> {
    this.writeCategories(withCategoryAdded(this.categories, name));
  }

  async renameCategory(id: string, name: string): Promise<void> {
    this.writeCategories(withCategoryRenamed(this.categories, id, name));
  }

  async setCategoryColor(id: string, colorId: string): Promise<void> {
    this.writeCategories(withCategoryColorChanged(this.categories, id, colorId));
  }

  async removeCategory(id: string): Promise<void> {
    this.writeCategories(withCategoryRemoved(this.categories, id));
  }

  async addTerm(id: string, term: string): Promise<void> {
    this.writeCategories(withTermAdded(this.categories, id, term));
  }

  async removeTerm(id: string, term: string): Promise<void> {
    this.writeCategories(withTermRemoved(this.categories, id, term));
  }
}
