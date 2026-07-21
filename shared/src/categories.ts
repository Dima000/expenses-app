/**
 * Category domain: the default seed set, id slugging, and the pure helpers
 * (matcher, resolver, uniqueness) shared by every write path and the UI.
 *
 * Categories are user-managed data (a `users/{uid}` document, see types.ts);
 * this module holds only the seed names and the stateless logic that operates
 * on a caller-supplied `Category[]`. Nothing here reads Firestore.
 */
import type { Category } from './types.js';

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
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** The default categories seeded on first run: slug ids, no terms. */
export const DEFAULT_CATEGORIES: Category[] = CATEGORIES.map((name) => ({
  id: slugify(name),
  name,
  terms: [],
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
  const t = term.trim().toLowerCase();
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
  const t = term.trim().toLowerCase();
  if (!t) return null;
  return (
    categories.find(
      (c) => c.id !== ignoreId && c.terms.some((x) => x.trim().toLowerCase() === t),
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
  const n = name.trim().toLowerCase();
  if (!n) return null;
  return categories.find((c) => c.id !== ignoreId && c.name.trim().toLowerCase() === n) ?? null;
}
