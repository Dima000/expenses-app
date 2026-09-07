import type { Currency } from './currency.js';

export interface ParsedUtterance {
  /**
   * The amount exactly as spoken/typed, UNROUNDED, or `null` when no number
   * was recognized. The whole-unit ceiling is applied downstream, after any
   * currency conversion (design.md D5).
   */
  amount: number | null;
  /** The currency detected from a symbol or word, or `null` when none was found. */
  currency: Currency | null;
  /** The utterance with the symbol, amount token and currency word stripped, trimmed. */
  comment: string;
  /** True when no recognizable number was found (caller should flag for review). */
  needsReview: boolean;
}

/**
 * Matches the first numeric token, allowing an optional leading currency
 * symbol and an optional decimal part (design.md D5).
 */
const AMOUNT_RE = /([£$€])?\s*(\d+(?:\.\d+)?)/;

/** A word immediately following the amount — the only position a currency word is read from. */
const TRAILING_WORD_RE = /^\s*(\p{L}+)/u;

const SYMBOL_CURRENCY: Record<string, Currency> = {
  '€': 'EUR',
  $: 'USD',
  '£': 'GBP',
};

/**
 * Bilingual RO + EN wordlist (design.md D10). `useSpeechRecognition` sets
 * `recognition.lang = navigator.language`, so a `ro-RO` browser transcribes
 * "zece euro" and never emits a symbol. Keys are diacritic-normalised and
 * lowercased, so `liră` matches `lira`.
 */
const WORD_CURRENCY: Record<string, Currency> = {
  lei: 'RON',
  leu: 'RON',
  ron: 'RON',
  euro: 'EUR',
  euros: 'EUR',
  eur: 'EUR',
  dolar: 'USD',
  dolari: 'USD',
  dollar: 'USD',
  dollars: 'USD',
  usd: 'USD',
  lira: 'GBP',
  lire: 'GBP',
  pound: 'GBP',
  pounds: 'GBP',
  gbp: 'GBP',
};

/** Lowercase and strip diacritics so `Liră` and `lira` are the same key. */
function normalizeWord(word: string): string {
  return word.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/**
 * Deterministic "first number wins" parser (design.md D5/D10):
 *  1. First numeric token left→right is the amount (optional currency symbol,
 *     optional decimal part).
 *  2. The amount is returned RAW — rounding happens downstream of conversion,
 *     so it fires exactly once.
 *  3. A leading symbol (`€`/`$`/`£`) or a recognised currency word immediately
 *     after the number selects the currency and is stripped from the comment;
 *     an unrecognised trailing word is left alone ("10 coffee" keeps "coffee").
 *  4. Comment is the rest of the transcript with those tokens stripped.
 *  5. Numbers are taken LITERALLY — "1250" means 1250, never 12.50.
 *  6. No number found → amount `null`, needsReview `true`, full raw text kept
 *     as the comment (fire-and-forget must never store a wrong amount).
 */
export function parseAmountFromTranscript(transcript: string): ParsedUtterance {
  const raw = (transcript ?? '').trim();
  const match = raw.match(AMOUNT_RE);

  if (!match) {
    return { amount: null, currency: null, comment: raw, needsReview: true };
  }

  const amount = Number(match[2]);

  if (!Number.isFinite(amount)) {
    return { amount: null, currency: null, comment: raw, needsReview: true };
  }

  const before = raw.slice(0, match.index);
  let after = raw.slice(match.index! + match[0].length);

  // A recognised word right after the number is currency, not comment.
  const wordMatch = after.match(TRAILING_WORD_RE);
  const wordCurrency = wordMatch ? WORD_CURRENCY[normalizeWord(wordMatch[1])] : undefined;
  if (wordCurrency) after = after.slice(wordMatch![0].length);

  // Both can be present ("£12 pounds"); the symbol is the more explicit signal.
  const currency = (match[1] ? SYMBOL_CURRENCY[match[1]] : undefined) ?? wordCurrency ?? null;

  const comment = (before + after).replace(/\s+/g, ' ').trim();

  return { amount, currency, comment, needsReview: false };
}
