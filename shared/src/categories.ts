/**
 * Single source of truth for spending categories.
 *
 * Forward-compat (design.md → Future Directions "User-managed categories"):
 * every consumer imports the category set from HERE and nowhere else, so the
 * source can later change from this hardcoded constant to a Firestore
 * collection in one place. Do not inline these strings elsewhere.
 */

/** The eight fixed, deliberately-chosen categories (v1). */
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

export type Category = (typeof CATEGORIES)[number];

/**
 * The reserved "not yet assigned" state. This is NOT a real category:
 * `uncategorized` !== `Other`. `Other` is a chosen bucket; `uncategorized`
 * means categorization is still pending (e.g. a fire-and-forget voice entry).
 */
export const UNCATEGORIZED = 'uncategorized' as const;

export type CategoryValue = Category | typeof UNCATEGORIZED;

/** Every value the `category` field may legally hold. */
export const ALLOWED_CATEGORY_VALUES: readonly CategoryValue[] = [
  ...CATEGORIES,
  UNCATEGORIZED,
];

/** True when `value` is a member of the allowed set (fixed list ∪ uncategorized). */
export function isAllowedCategory(value: unknown): value is CategoryValue {
  return (
    typeof value === 'string' &&
    (ALLOWED_CATEGORY_VALUES as readonly string[]).includes(value)
  );
}

/** True when `value` is one of the eight real categories (excludes uncategorized). */
export function isRealCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value);
}
