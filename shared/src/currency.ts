/**
 * Currency model for entry-time conversion (design.md D1). Records are stored
 * in ONE unit — `BASE_CURRENCY` — and carry no currency field; a foreign
 * amount is converted at write time and only the RON value is persisted.
 */

/** The four currencies offered at entry. Nothing else is convertible. */
export type Currency = 'RON' | 'EUR' | 'USD' | 'GBP';

/** The single unit every stored amount, total and report is expressed in. */
export const BASE_CURRENCY: Currency = 'RON';

/**
 * Display list for the entry picker, base currency first. `captionWord` is the
 * word used in the original-entry caption ("11 euro @ 5.2584"), chosen to read
 * naturally rather than to match the ISO code.
 */
export const CURRENCIES: ReadonlyArray<{
  code: Currency;
  label: string;
  captionWord: string;
}> = [
  { code: 'RON', label: 'RON — lei', captionWord: 'lei' },
  { code: 'EUR', label: 'EUR — euro', captionWord: 'euro' },
  { code: 'USD', label: 'USD — dollars', captionWord: 'dollars' },
  { code: 'GBP', label: 'GBP — pounds', captionWord: 'pounds' },
];

/** The three currencies that need a rate to be usable. */
export const FOREIGN_CURRENCIES: readonly Currency[] = CURRENCIES.map((c) => c.code).filter(
  (code) => code !== BASE_CURRENCY,
);

/**
 * A rate table keyed by currency code, each value meaning "RON per one unit"
 * (so `EUR: 5.2584` reads as 5.2584 RON per euro). Rates are inverted into this
 * direction when they are cached, because it is the direction both the
 * conversion and the caption need (design.md D6).
 */
export type RateTable = Readonly<Record<string, number>>;

/** Trim a rate to at most 4 decimals for display: `5.25845` → `"5.2584"`. */
function formatRate(rate: number): string {
  return String(Math.round(rate * 1e4) / 1e4);
}

/**
 * The display-only caption stored on a converted record (design.md D2), e.g.
 * `"11 euro @ 5.2584"`. Nothing parses this text — it exists so a converted
 * amount can still be explained later. One helper so every writer agrees on
 * the format.
 */
export function formatOriginalEntry(amount: number, currency: Currency, rate: number): string {
  const word = CURRENCIES.find((c) => c.code === currency)?.captionWord ?? currency;
  return `${amount} ${word} @ ${formatRate(rate)}`;
}

/**
 * The caption an edit should keep (design.md D4). It survives edits that leave
 * the amount alone — where it still describes the stored value truthfully — and
 * is dropped the moment the amount changes, because it would then lie.
 * Returns `undefined` when nothing should be kept, so callers can spread it.
 */
export function retainedOriginalEntry(
  previous: { amount: number; origAmount?: string } | null | undefined,
  nextAmount: number,
): string | undefined {
  if (!previous?.origAmount) return undefined;
  return previous.amount === nextAmount ? previous.origAmount : undefined;
}
