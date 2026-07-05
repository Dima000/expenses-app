import type { CategoryValue } from './categories.js';

/** Where a spending was captured from. */
export type SpendingSource = 'web' | 'voice' | 'rest';

/**
 * The fields a caller supplies when creating/editing a spending. This is the
 * shared, transport-agnostic shape validated by every input path.
 */
export interface SpendingInput {
  /** Whole currency units. Positive integer, unless `needsReview` is set. */
  amount: number;
  /** Spending date as `YYYY-MM-DD` (used for month filtering). */
  date: string;
  /** Free-text comment; for voice entries this holds the leftover utterance. */
  comment: string;
  /** One of the eight fixed categories or `uncategorized`. */
  category: CategoryValue;
  /**
   * Set when the amount could not be parsed confidently (voice) and must be
   * corrected later. When true, `amount` may be `0`. See design.md D5/9.4.
   */
  needsReview?: boolean;
}

/**
 * The Firestore document shape for a stored spending (design.md D8).
 * `createdAt` is a server timestamp; its concrete type differs between the
 * Admin SDK and the client SDK, so it is left generic here.
 */
export interface SpendingDoc<Timestamp = unknown> extends SpendingInput {
  ownerUid: string;
  source: SpendingSource;
  createdAt: Timestamp;
}

/** A spending doc paired with its Firestore id, as read back by the client. */
export interface Spending extends SpendingInput {
  id: string;
  ownerUid: string;
  source: SpendingSource;
  /** Epoch milliseconds of the server creation timestamp (client-normalized). */
  createdAtMs: number | null;
}

/** Firestore top-level collection name for spendings. */
export const SPENDINGS_COLLECTION = 'spendings';
