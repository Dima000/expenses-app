/**
 * Money helpers. Amounts are always WHOLE currency units (design.md D1):
 * no minor-unit/cents bookkeeping, so month totals stay exact.
 */

/**
 * Ceiling any fractional amount to the next whole unit, applied ONCE at entry.
 * `12.34` → `13`, `12` → `12`, `12.0` → `12`.
 *
 * Returns `null` for values that are not finite numbers, so callers can treat
 * an unparseable amount as "needs review" rather than storing a wrong value.
 */
export function roundUpAmount(input: number): number | null {
  if (typeof input !== 'number' || !Number.isFinite(input)) return null;
  return Math.ceil(input);
}
