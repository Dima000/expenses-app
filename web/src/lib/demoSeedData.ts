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
import { toDateString } from './date';

/** `ownerUid` stored on every seeded spending; never a real Firebase uid. */
export const DEMO_OWNER_UID = 'demo';

/** Weekday indices as `Date#getDay()` returns them. */
const TUE = 2;
const WED = 3;
const THU = 4;
const FRI = 5;
const SAT = 6;

/**
 * How often a rule fires. `weekly` drives the dense categories the drilldown
 * heatmap needs; `monthly` covers fixed and occasional spend. Two kinds cover
 * every shape the demo needs (design.md D1).
 */
type Cadence =
  | { kind: 'weekly'; weekdays: readonly number[]; skipEvery?: number }
  | { kind: 'monthly'; daysOfMonth: readonly number[] };

/** One category's rhythm, comment pool, and amount cycle. */
interface CadenceRule {
  /** The category assigned directly — `UNCATEGORIZED` when `autoMatch` resolves it. */
  categoryId: string;
  cadence: Cadence;
  /** Cycled by this rule's own occurrence index. */
  comments: readonly string[];
  /**
   * Hand-picked amounts cycled by this rule's own occurrence index, so
   * intensity varies instead of ramping linearly (design.md D4). Lengths are
   * chosen not to re-align with the cadence and produce a repeating stripe.
   */
  amounts: readonly number[];
  needsReview?: boolean;
  /** Comment carries a term seeded onto the demo categories; the real matcher assigns the category. */
  autoMatch?: boolean;
}

/**
 * The cadence table (design.md D3). `groceries` and `relationships` are the
 * two dense categories — a viewer expects both to recur, and their differing
 * weekday sets make their heatmaps look different from each other. `health`
 * and `pet` stay at one day per month so drilldowns differ in density.
 */
const CADENCE_RULES: readonly CadenceRule[] = [
  {
    categoryId: 'groceries',
    cadence: { kind: 'weekly', weekdays: [TUE, THU, SAT], skipEvery: 5 },
    comments: ['Weekly grocery shop', 'Corner shop top-up', 'Market vegetables', 'Bakery run'],
    amounts: [42, 18, 37, 63, 22, 51, 29, 45, 15, 34],
  },
  {
    categoryId: 'relationships',
    cadence: { kind: 'weekly', weekdays: [WED, FRI, SAT], skipEvery: 4 },
    comments: ['Dinner out', 'Drinks with friends', 'Cinema tickets'],
    amounts: [58, 24, 71, 33, 46, 19, 62],
  },
  {
    categoryId: UNCATEGORIZED,
    cadence: { kind: 'monthly', daysOfMonth: [6, 17, 28] },
    comments: ['Cash withdrawal', 'Online purchase', 'Store purchase'],
    amounts: [23, 9, 41, 16],
  },
  {
    categoryId: 'kid',
    cadence: { kind: 'monthly', daysOfMonth: [5, 18] },
    comments: ['School supplies', 'Kids clothes'],
    amounts: [27, 14, 35, 19, 22],
  },
  {
    categoryId: 'sports',
    cadence: { kind: 'monthly', daysOfMonth: [7, 21] },
    comments: ['Gym membership', 'Climbing session'],
    amounts: [55, 21, 38],
  },
  {
    categoryId: 'other',
    cadence: { kind: 'monthly', daysOfMonth: [11, 26] },
    comments: ['Miscellaneous purchase', 'Household bits'],
    amounts: [12, 31, 7, 24],
  },
  {
    categoryId: UNCATEGORIZED,
    cadence: { kind: 'monthly', daysOfMonth: [8, 21] },
    comments: ['Voice capture, amount unclear', 'Quick log, check amount later'],
    // `needsReview` entries are exactly the ones whose amount is not yet known.
    amounts: [0],
    needsReview: true,
  },
  {
    categoryId: 'utilities',
    cadence: { kind: 'monthly', daysOfMonth: [3] },
    comments: ['Internet bill'],
    amounts: [47, 52, 44, 61, 49],
  },
  {
    categoryId: 'health',
    cadence: { kind: 'monthly', daysOfMonth: [9] },
    comments: ['Pharmacy run', 'Dentist checkup'],
    amounts: [26, 11, 48, 17],
  },
  {
    categoryId: 'pet',
    cadence: { kind: 'monthly', daysOfMonth: [14] },
    comments: ['Vet visit supplies', 'Pet food refill'],
    amounts: [33, 64, 19],
  },
  {
    categoryId: UNCATEGORIZED,
    cadence: { kind: 'monthly', daysOfMonth: [10] },
    comments: ['Grabbed milk and eggs on the way home'],
    amounts: [8, 5, 11, 6, 9],
    autoMatch: true,
  },
  {
    categoryId: UNCATEGORIZED,
    cadence: { kind: 'monthly', daysOfMonth: [2] },
    comments: ['Paid the electricity bill'],
    amounts: [72, 58, 84, 66, 49],
    autoMatch: true,
  },
];

/**
 * The rule backing the explicit "dated today" entry when nothing else fired
 * (design.md D6) — `groceries`, the densest category, so the fallback reads as
 * ordinary traffic. Looked up by category so reordering the table above cannot
 * silently repoint it at a different rule.
 */
const TODAY_RULE_INDEX = CADENCE_RULES.findIndex((rule) => rule.categoryId === 'groceries');

function cadenceFires(cadence: Cadence, date: Date): boolean {
  return cadence.kind === 'weekly'
    ? cadence.weekdays.includes(date.getDay())
    : cadence.daysOfMonth.includes(date.getDate());
}

/**
 * `skipEvery: N` drops every Nth firing, counted per category across the whole
 * run rather than reset per month (design.md D2) — a counter that reset would
 * give every month an identical skip pattern.
 */
function cadenceSkips(cadence: Cadence, occurrence: number): boolean {
  if (cadence.kind !== 'weekly' || !cadence.skipEvery) return false;
  return occurrence % cadence.skipEvery === cadence.skipEvery - 1;
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
 * One entry for a rule's `occurrence`-th firing. Auto-matched rules go through
 * the real matcher rather than assigning `category`/`autoMatchedTerm` directly.
 */
function buildSpendingInput(
  rule: CadenceRule,
  dateStr: string,
  occurrence: number,
  demoCategories: readonly Category[],
): SpendingInput {
  const input: SpendingInput = {
    amount: rule.amounts[occurrence % rule.amounts.length],
    date: dateStr,
    comment: rule.comments[occurrence % rule.comments.length],
    category: rule.categoryId,
    needsReview: rule.needsReview ?? false,
  };
  return rule.autoMatch ? applyAutoCategory(input, demoCategories) : input;
}

function toSpending(input: SpendingInput, id: number, createdAtMs: number): Spending {
  return { ...input, id: `demo-${id}`, ownerUid: DEMO_OWNER_UID, source: 'web', createdAtMs };
}

/**
 * Generate the demo dataset relative to `today`: the whole of the prior
 * calendar year plus the current year up to and including "today". Every date
 * in that window is walked and each rule asked whether it fires, so the
 * current month simply holds whatever its cadences produced for the elapsed
 * days — no future-dated entry is possible by construction. `categories`
 * defaults to a fresh `buildDemoCategories()`, but a caller (e.g.
 * `DemoDataSource`) may pass its own instance so seeding stays consistent with
 * what it stores.
 */
export function generateDemoSpendings(
  today: Date = new Date(),
  categories: readonly Category[] = buildDemoCategories(),
): Spending[] {
  const todayStr = toDateString(today);
  const spendings: Spending[] = [];
  // Per-rule counters: `fired` counts every date a cadence names (skipped ones
  // included, so `skipEvery` stays regular); `emitted` indexes the amount and
  // comment cycles. Both are per-category, so changing one rule's cadence
  // cannot disturb another category's entries.
  const counters = CADENCE_RULES.map(() => ({ fired: 0, emitted: 0 }));
  let id = 0;

  const cursor = new Date(today.getFullYear() - 1, 0, 1);
  let dateStr = toDateString(cursor);
  while (dateStr <= todayStr) {
    CADENCE_RULES.forEach((rule, i) => {
      if (!cadenceFires(rule.cadence, cursor)) return;
      const counter = counters[i];
      const occurrence = counter.fired++;
      if (cadenceSkips(rule.cadence, occurrence)) return;
      const input = buildSpendingInput(rule, dateStr, counter.emitted++, categories);
      spendings.push(toSpending(input, id, id));
      id++;
    });
    cursor.setDate(cursor.getDate() + 1);
    dateStr = toDateString(cursor);
  }

  // Cadences cannot guarantee an entry on "today", and the dashboard's Today
  // filter needs one — so append it, but only when the walk produced none
  // (design.md D6). Entries are pushed in date order and "today" is the last
  // date walked, so the final entry settles it.
  if (spendings[spendings.length - 1]?.date !== todayStr) {
    const input = buildSpendingInput(
      CADENCE_RULES[TODAY_RULE_INDEX],
      todayStr,
      counters[TODAY_RULE_INDEX].emitted,
      categories,
    );
    spendings.push(toSpending(input, id, id));
  }

  return spendings;
}
