/** Pure date-display helpers shared across surfaces. */

/**
 * Short human label for a `YYYY-MM-DD` date string: day-of-month followed by
 * the abbreviated month name, e.g. `2026-06-07` → `"7 Jun"`.
 *
 * The date parts are parsed explicitly and rendered from a local `Date` so the
 * label never shifts a day across time zones (unlike `new Date("2026-06-07")`,
 * which is parsed as UTC midnight).
 */
export function shortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  });
}
