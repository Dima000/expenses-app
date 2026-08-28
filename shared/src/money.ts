import { BASE_CURRENCY, type Currency, type RateTable } from './currency.js';

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
 *
 * On a foreign-currency entry this runs *downstream* of {@link convertToBase},
 * never before it (design.md D5): rounding first would double-round, storing
 * `10.4 EUR @ 5.0` as `55` instead of `52`.
 */
export function roundUpAmount(input: number): number | null {
  if (typeof input !== 'number' || !Number.isFinite(input)) return null;
  return Math.ceil(input);
}

/**
 * Convert an entered amount into the base currency, UNROUNDED — the whole-unit
 * ceiling is applied once by {@link roundUpAmount}, after this call (design.md D5).
 *
 * `ronPerUnit` holds RON per one unit of each foreign currency. A base-currency
 * amount is returned unchanged. Returns `null` when the amount is not a finite
 * number or no usable positive rate is cached for the currency, so callers can
 * refuse the entry rather than store a wrong value.
 */
export function convertToBase(
  amount: number,
  currency: Currency,
  ronPerUnit: RateTable,
): number | null {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  if (currency === BASE_CURRENCY) return amount;
  const rate = ronPerUnit?.[currency];
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return null;
  return amount * rate;
}
