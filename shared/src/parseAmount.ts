import { roundUpAmount } from './money.js';

export interface ParsedUtterance {
  /** Whole-unit amount (rounded up), or `null` when no number was recognized. */
  amount: number | null;
  /** The utterance with the currency symbol + amount token stripped, trimmed. */
  comment: string;
  /** True when no recognizable number was found (caller should flag for review). */
  needsReview: boolean;
}

/**
 * Matches the first numeric token, allowing an optional leading currency
 * symbol and an optional decimal part: `£?$?\d+(\.\d+)?` (design.md D5).
 */
const AMOUNT_RE = /[£$€]?\s*\d+(?:\.\d+)?/;

/**
 * Deterministic "first number wins" parser (design.md D5):
 *  1. First numeric token left→right is the amount (optional currency symbol,
 *     optional decimal part).
 *  2. Decimal amounts are rounded UP; integers used as-is.
 *  3. Comment is the rest of the transcript with the symbol + amount stripped.
 *  4. Numbers are taken LITERALLY — "1250" means 1250, never 12.50.
 *  5. No number found → amount `null`, needsReview `true`, full raw text kept
 *     as the comment (fire-and-forget must never store a wrong amount).
 */
export function parseAmountFromTranscript(transcript: string): ParsedUtterance {
  const raw = (transcript ?? '').trim();
  const match = raw.match(AMOUNT_RE);

  if (!match) {
    return { amount: null, comment: raw, needsReview: true };
  }

  const numeric = match[0].replace(/[£$€\s]/g, '');
  const amount = roundUpAmount(Number(numeric));

  if (amount === null) {
    return { amount: null, comment: raw, needsReview: true };
  }

  const comment = (raw.slice(0, match.index) + raw.slice(match.index! + match[0].length))
    .replace(/\s+/g, ' ')
    .trim();

  return { amount, comment, needsReview: false };
}
