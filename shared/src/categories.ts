/**
 * Category domain: the default seed set, id slugging, and the pure helpers
 * (matcher, resolver, uniqueness) shared by every write path and the UI.
 *
 * Categories are user-managed data (a `users/{uid}` document, see types.ts);
 * this module holds only the seed names and the stateless logic that operates
 * on a caller-supplied `Category[]`. Nothing here reads Firestore.
 */
import type { Category, SpendingInput } from './types.js';

/** The eight default category NAMES seeded for a new owner (v1). */
export const CATEGORIES = [
  'Groceries',
  'Health',
  'Sports',
  'Pet',
  'Relationships',
  'Kid',
  'Utilities',
  'Other',
] as const;

/**
 * The reserved "not yet assigned" state. This is NOT a real category:
 * `uncategorized` !== `Other`. `Other` is a chosen bucket; `uncategorized`
 * means categorization is still pending (e.g. a fire-and-forget voice entry).
 */
export const UNCATEGORIZED = 'uncategorized' as const;

/**
 * The fixed 16-swatch categorical color palette a category's `colorId` refers
 * to. Held at matched lightness/chroma (OKLCH) so no swatch reads louder than
 * another; values are theme-independent (same in light and dark).
 */
export interface PaletteColor {
  id: string;
  name: string;
  oklch: string;
}

export const CATEGORY_PALETTE: PaletteColor[] = [
  { id: 'gray', name: 'Gray', oklch: 'oklch(0.72 0.01 285)' },
  { id: 'brown', name: 'Brown', oklch: 'oklch(0.72 0.05 55)' },
  { id: 'red', name: 'Red', oklch: 'oklch(0.72 0.19 25)' },
  { id: 'orange', name: 'Orange', oklch: 'oklch(0.72 0.19 55)' },
  { id: 'amber', name: 'Amber', oklch: 'oklch(0.72 0.19 75)' },
  { id: 'yellow', name: 'Yellow', oklch: 'oklch(0.72 0.19 95)' },
  { id: 'lime', name: 'Lime', oklch: 'oklch(0.72 0.19 125)' },
  { id: 'green', name: 'Green', oklch: 'oklch(0.72 0.19 145)' },
  { id: 'teal', name: 'Teal', oklch: 'oklch(0.72 0.19 165)' },
  { id: 'cyan', name: 'Cyan', oklch: 'oklch(0.72 0.19 195)' },
  { id: 'sky', name: 'Sky', oklch: 'oklch(0.72 0.19 225)' },
  { id: 'blue', name: 'Blue', oklch: 'oklch(0.72 0.19 255)' },
  { id: 'indigo', name: 'Indigo', oklch: 'oklch(0.72 0.19 280)' },
  { id: 'violet', name: 'Violet', oklch: 'oklch(0.72 0.19 300)' },
  { id: 'purple', name: 'Purple', oklch: 'oklch(0.72 0.19 320)' },
  { id: 'pink', name: 'Pink', oklch: 'oklch(0.72 0.19 350)' },
];

/**
 * The value the `category` field may hold: a category id, a legacy category
 * name (backward-compat), or `uncategorized`. It is validated as a non-empty
 * string; an unresolvable value simply renders as "Uncategorised".
 */
export type CategoryValue = string;

/** Derive a stable slug id from a display name (`Groceries` → `groceries`). */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Collapse every run of non-alphanumerics to a single '-', so the trim
    // below only ever sees one leading/trailing '-' — a linear pattern with no
    // polynomial backtracking (avoids the ReDoS shape of `/^-+|-+$/`).
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Fold a term or name to its canonical form for case-insensitive equality. */
export function normalizeTerm(value: string): string {
  return value.trim().toLowerCase();
}

/** Hand-picked colors for the seeded defaults, so the set reads intentionally. */
const DEFAULT_CATEGORY_COLORS: Record<(typeof CATEGORIES)[number], string> = {
  Groceries: 'green',
  Health: 'red',
  Sports: 'orange',
  Pet: 'brown',
  Relationships: 'pink',
  Kid: 'yellow',
  Utilities: 'blue',
  Other: 'gray',
};

/** The default categories seeded on first run: slug ids, no terms, pre-assigned colors. */
export const DEFAULT_CATEGORIES: Category[] = CATEGORIES.map((name) => ({
  id: slugify(name),
  name,
  terms: [],
  colorId: DEFAULT_CATEGORY_COLORS[name],
}));

/** True when `value` is a legal stored category (any non-empty string). */
export function isAllowedCategory(value: unknown): value is CategoryValue {
  return typeof value === 'string' && value.length > 0;
}

/** The term + category id captured when auto-categorisation fires. */
export interface CategorizeResult {
  categoryId: string;
  matchedTerm: string;
}

/** Whole-word, case-insensitive test of `term` within an already-lowercased comment. */
function commentContainsTerm(commentLower: string, term: string): boolean {
  const t = normalizeTerm(term);
  if (!t) return false;
  // Escape regex metacharacters so terms stay plain strings, then match on
  // word boundaries so `market` ∤ `supermarket`.
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`).test(commentLower);
}

/**
 * Auto-categorise a comment against the owner's category terms (design.md).
 * Case-insensitive, whole-word matching. Collect the DISTINCT categories whose
 * terms appear: exactly one → return its id + the term that matched; zero or
 * two-or-more distinct → return `null` (stay uncategorized).
 */
export function categorize(
  comment: string,
  categories: readonly Category[],
): CategorizeResult | null {
  if (typeof comment !== 'string' || !comment.trim()) return null;
  const lower = comment.toLowerCase();
  let match: CategorizeResult | null = null;
  for (const cat of categories) {
    for (const term of cat.terms) {
      if (commentContainsTerm(lower, term)) {
        // A second distinct category is ambiguous → leave uncategorized.
        if (match && match.categoryId !== cat.id) return null;
        if (!match) match = { categoryId: cat.id, matchedTerm: term };
        break; // first matching term in this category is enough
      }
    }
  }
  return match;
}

/**
 * Save-time auto-categorisation policy, shared by every write path so client
 * and server behave identically (design.md). Applies the matcher ONLY when the
 * owner left the category `uncategorized` — an explicit pick is never
 * overridden — and, on a single-distinct match, returns the input enriched
 * with the resolved id and the matched term. Otherwise the input is unchanged.
 */
export function applyAutoCategory(
  input: SpendingInput,
  categories: readonly Category[],
): SpendingInput {
  if (input.category !== UNCATEGORIZED) return input;
  const match = categorize(input.comment, categories);
  if (!match) return input;
  return { ...input, category: match.categoryId, autoMatchedTerm: match.matchedTerm };
}

/**
 * Resolve a stored category value to a category (UI display, design.md):
 * exact id match → case-insensitive name fallback (legacy rows) → `null`
 * (unresolved, renders as "Uncategorised").
 */
export function resolveCategory(
  value: string | undefined | null,
  categories: readonly Category[],
): Category | null {
  if (!value || value === UNCATEGORIZED) return null;
  const byId = categories.find((c) => c.id === value);
  if (byId) return byId;
  const lower = value.toLowerCase();
  return categories.find((c) => c.name.toLowerCase() === lower) ?? null;
}

/**
 * The category that already owns `term` (case-insensitive), or `null`. Terms
 * are globally unique across the owner's set; pass `ignoreId` to skip the
 * category being edited.
 */
export function findCategoryOwningTerm(
  term: string,
  categories: readonly Category[],
  ignoreId?: string,
): Category | null {
  const t = normalizeTerm(term);
  if (!t) return null;
  return (
    categories.find(
      (c) => c.id !== ignoreId && c.terms.some((x) => normalizeTerm(x) === t),
    ) ?? null
  );
}

/**
 * An existing category with the same display name (case-insensitive), or
 * `null`. Names are unique within the set; pass `ignoreId` to skip the
 * category being renamed.
 */
export function findCategoryByName(
  name: string,
  categories: readonly Category[],
  ignoreId?: string,
): Category | null {
  const n = normalizeTerm(name);
  if (!n) return null;
  return categories.find((c) => c.id !== ignoreId && normalizeTerm(c.name) === n) ?? null;
}

/**
 * The first palette color not already used by `categories`, or — once all 16
 * are in use — `CATEGORY_PALETTE[0].id` (colors then simply repeat). Used to
 * auto-assign a new category's color at creation time.
 */
export function nextAvailableColorId(categories: readonly Category[]): string {
  const used = new Set(categories.map((c) => c.colorId));
  const free = CATEGORY_PALETTE.find((p) => !used.has(p.id));
  return free ? free.id : CATEGORY_PALETTE[0].id;
}

/**
 * Resolve a category's display color: its stored `colorId` if present, else a
 * deterministic fallback keyed by its position in `categories` (design.md).
 * Pure — never mutates or persists; the fallback applies only until the owner
 * explicitly sets a color.
 */
export function colorIdFor(category: Category, index: number): string {
  return category.colorId ?? CATEGORY_PALETTE[index % CATEGORY_PALETTE.length].id;
}

/** Categories sorted alphabetically by name (locale-aware, case-insensitive). */
export function sortCategoriesByName(categories: readonly Category[]): Category[] {
  return [...categories].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );
}

/** A slug id not already used by another category (disambiguates collisions). */
function uniqueCategoryId(base: string, categories: readonly Category[]): string {
  const seed = base || 'category';
  const ids = new Set(categories.map((c) => c.id));
  if (!ids.has(seed)) return seed;
  let n = 2;
  while (ids.has(`${seed}-${n}`)) n++;
  return `${seed}-${n}`;
}

/**
 * Pure category-set transforms: each takes the current set and returns the new
 * set, or throws an `Error` (message shown inline by the UI) on a
 * uniqueness/validation conflict. The persistence layer wraps these with a
 * single write; keeping the transitions here makes the invariants domain-owned,
 * testable, and reusable by any future write path.
 */
export function withCategoryAdded(categories: readonly Category[], name: string): Category[] {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name is required');
  const dup = findCategoryByName(trimmed, categories);
  if (dup) throw new Error(`A category named "${dup.name}" already exists`);
  const id = uniqueCategoryId(slugify(trimmed), categories);
  const colorId = nextAvailableColorId(categories);
  return [...categories, { id, name: trimmed, terms: [], colorId }];
}

export function withCategoryRenamed(
  categories: readonly Category[],
  id: string,
  name: string,
): Category[] {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Category name is required');
  const dup = findCategoryByName(trimmed, categories, id);
  if (dup) throw new Error(`A category named "${dup.name}" already exists`);
  return categories.map((c) => (c.id === id ? { ...c, name: trimmed } : c));
}

export function withCategoryColorChanged(
  categories: readonly Category[],
  id: string,
  colorId: string,
): Category[] {
  return categories.map((c) => (c.id === id ? { ...c, colorId } : c));
}

export function withCategoryRemoved(categories: readonly Category[], id: string): Category[] {
  return categories.filter((c) => c.id !== id);
}

export function withTermAdded(
  categories: readonly Category[],
  id: string,
  term: string,
): Category[] {
  const trimmed = term.trim();
  if (!trimmed) throw new Error('Term is required');
  const owner = findCategoryOwningTerm(trimmed, categories);
  if (owner) {
    if (owner.id === id) return [...categories]; // already on this category — no-op
    throw new Error(`"${trimmed}" is already in ${owner.name}`);
  }
  return categories.map((c) => (c.id === id ? { ...c, terms: [...c.terms, trimmed] } : c));
}

export function withTermRemoved(
  categories: readonly Category[],
  id: string,
  term: string,
): Category[] {
  const target = normalizeTerm(term);
  return categories.map((c) =>
    c.id === id ? { ...c, terms: c.terms.filter((t) => normalizeTerm(t) !== target) } : c,
  );
}
