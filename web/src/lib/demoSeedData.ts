/**
 * Deterministic seed data for `DemoDataSource` (design.md "Seed generator").
 * A pure function of "today" — no PRNG, no hardcoded dates — so the same
 * "today" always produces the same dataset. Has no `DataSource` dependency:
 * it only builds plain `Category[]`/`Spending[]` values.
 */
import {
  applyAutoCategory,
  DEFAULT_CATEGORIES,
  UNCATEGORIZED,
  withTermAdded,
  type Category,
  type Spending,
  type SpendingInput,
} from '@expenses/shared';
import { addMonths, toDateString } from './date';

/** `ownerUid` stored on every seeded spending; never a real Firebase uid. */
export const DEMO_OWNER_UID = 'demo';

const ENTRIES_PER_MONTH = 30;

const pad = (n: number) => String(n).padStart(2, '0');

function daysInMonth(monthKey: string): number {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

/** A pool entry cycled by day-index rather than drawn at random. */
interface PoolEntry {
  categoryId: string;
  comment: string;
  minAmount: number;
  maxAmount: number;
}

/** Manually-categorized entries, spread across every default category for Reports variety. */
const NORMAL_POOL: PoolEntry[] = [
  { categoryId: 'groceries', comment: 'Weekly grocery shop', minAmount: 15, maxAmount: 45 },
  { categoryId: 'health', comment: 'Pharmacy run', minAmount: 8, maxAmount: 30 },
  { categoryId: 'sports', comment: 'Gym membership', minAmount: 20, maxAmount: 60 },
  { categoryId: 'pet', comment: 'Vet visit supplies', minAmount: 10, maxAmount: 40 },
  { categoryId: 'relationships', comment: 'Dinner out', minAmount: 25, maxAmount: 70 },
  { categoryId: 'kid', comment: 'School supplies', minAmount: 12, maxAmount: 35 },
  { categoryId: 'utilities', comment: 'Internet bill', minAmount: 30, maxAmount: 55 },
  { categoryId: 'other', comment: 'Miscellaneous purchase', minAmount: 5, maxAmount: 25 },
];

const UNCATEGORIZED_COMMENTS = ['Cash withdrawal', 'Online purchase', 'Store purchase'];

const REVIEW_COMMENTS = ['Voice capture, amount unclear', 'Quick log, check amount later'];

/** Comments containing a term seeded onto the demo category set, for the real matcher to resolve. */
const AUTO_MATCH_ENTRIES = [
  { comment: 'Grabbed milk and eggs on the way home', minAmount: 4, maxAmount: 12 },
  { comment: 'Paid the electricity bill', minAmount: 40, maxAmount: 90 },
];

function amountFor(min: number, max: number, dayIndex: number): number {
  return min + (dayIndex % (max - min + 1));
}

/**
 * `DEFAULT_CATEGORIES` cloned, with a couple of terms layered onto the local
 * copy only — never mutates the shared export or affects real onboarding.
 */
export function buildDemoCategories(): Category[] {
  const cloned = DEFAULT_CATEGORIES.map((c) => ({ ...c, terms: [...c.terms] }));
  const withMilk = withTermAdded(cloned, 'groceries', 'milk');
  return withTermAdded(withMilk, 'utilities', 'electricity');
}

/**
 * Deterministic placement rule keyed by a running day-index: explicit
 * `needsReview` / uncategorized / auto-matched entries at fixed moduli, a
 * cycled category pool otherwise (design.md "Seed generator").
 */
function buildSpendingInput(
  dateStr: string,
  dayIndex: number,
  demoCategories: readonly Category[],
): SpendingInput {
  if (dayIndex % 7 === 0) {
    const comment = REVIEW_COMMENTS[dayIndex % REVIEW_COMMENTS.length];
    return { amount: 0, date: dateStr, comment, category: UNCATEGORIZED, needsReview: true };
  }
  if (dayIndex % 5 === 0) {
    const comment = UNCATEGORIZED_COMMENTS[dayIndex % UNCATEGORIZED_COMMENTS.length];
    const amount = amountFor(5, 25, dayIndex);
    return { amount, date: dateStr, comment, category: UNCATEGORIZED, needsReview: false };
  }
  if (dayIndex % 11 === 0) {
    const tpl = AUTO_MATCH_ENTRIES[dayIndex % AUTO_MATCH_ENTRIES.length];
    const amount = amountFor(tpl.minAmount, tpl.maxAmount, dayIndex);
    const draft: SpendingInput = {
      amount,
      date: dateStr,
      comment: tpl.comment,
      category: UNCATEGORIZED,
      needsReview: false,
    };
    return applyAutoCategory(draft, demoCategories);
  }
  const tpl = NORMAL_POOL[dayIndex % NORMAL_POOL.length];
  const amount = amountFor(tpl.minAmount, tpl.maxAmount, dayIndex);
  return { amount, date: dateStr, comment: tpl.comment, category: tpl.categoryId, needsReview: false };
}

function toSpending(input: SpendingInput, id: number, createdAtMs: number): Spending {
  return { ...input, id: `demo-${id}`, ownerUid: DEMO_OWNER_UID, source: 'web', createdAtMs };
}

/**
 * Generate the demo dataset relative to `today`: 3–4 months of history in
 * the current year (as many of the latest 4 as remain within it) plus the
 * last 3 months of the prior year, ~30 entries/month. `categories` defaults
 * to a fresh `buildDemoCategories()`, but a caller (e.g. `DemoDataSource`)
 * may pass its own instance so seeding stays consistent with what it stores.
 */
export function generateDemoSpendings(
  today: Date = new Date(),
  categories: readonly Category[] = buildDemoCategories(),
): Spending[] {
  const todayStr = toDateString(today);
  const currentYear = today.getFullYear();
  const curMonthKey = `${currentYear}-${pad(today.getMonth() + 1)}`;

  const currentYearMonths: string[] = [];
  for (let i = 0; i < 4; i++) {
    const monthKey = addMonths(curMonthKey, -i);
    if (Number(monthKey.slice(0, 4)) !== currentYear) break;
    currentYearMonths.unshift(monthKey);
  }

  const priorYear = currentYear - 1;
  const priorYearMonths = [`${priorYear}-10`, `${priorYear}-11`, `${priorYear}-12`];

  const monthsCovered = [...priorYearMonths, ...currentYearMonths];

  const spendings: Spending[] = [];
  let dayIndex = 0;
  let id = 0;

  for (const monthKey of monthsCovered) {
    const isCurrentMonth = monthKey === curMonthKey;
    // The current month only has days up to "today" — no future-dated entries.
    const maxDay = isCurrentMonth ? today.getDate() : daysInMonth(monthKey);
    // One slot is reserved below for an explicit "dated today" entry.
    const entriesInMonth = isCurrentMonth ? ENTRIES_PER_MONTH - 1 : ENTRIES_PER_MONTH;

    for (let slot = 0; slot < entriesInMonth; slot++) {
      const day = 1 + (slot % maxDay);
      const dateStr = `${monthKey}-${pad(day)}`;
      const input = buildSpendingInput(dateStr, dayIndex, categories);
      spendings.push(toSpending(input, id, id));
      dayIndex++;
      id++;
    }

    if (isCurrentMonth) {
      // Explicit placement (not left to the day-index modulo) so a "today"
      // entry exists regardless of how many days into the month it is.
      const tpl = NORMAL_POOL[dayIndex % NORMAL_POOL.length];
      const amount = amountFor(tpl.minAmount, tpl.maxAmount, dayIndex);
      const input: SpendingInput = {
        amount,
        date: todayStr,
        comment: tpl.comment,
        category: tpl.categoryId,
        needsReview: false,
      };
      spendings.push(toSpending(input, id, id));
      dayIndex++;
      id++;
    }
  }

  return spendings;
}
