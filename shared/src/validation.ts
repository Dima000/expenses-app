import { isAllowedCategory } from './categories.js';
import type { SpendingInput } from './types.js';

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

/** `YYYY-MM-DD` with a real calendar check (rejects `2026-13-40`). */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

/**
 * Validate a spending payload against the shared rules (design.md D2):
 * - amount is a positive whole integer (or `0` when `needsReview` is set)
 * - category is any non-empty string (an id, a legacy name, or `uncategorized`);
 *   membership is no longer enforced — an unresolvable value renders as
 *   "Uncategorised" (design.md A1)
 * - date is a valid `YYYY-MM-DD`
 * - comment is a string
 *
 * Returns every problem found so callers can report them all at once. This is
 * the canonical validator; Firestore security rules mirror the same checks.
 */
export function validateSpending(input: Partial<SpendingInput> | undefined): ValidationResult {
  const errors: string[] = [];

  if (!input || typeof input !== 'object') {
    return { ok: false, errors: ['payload must be an object'] };
  }

  const needsReview = input.needsReview === true;

  if (input.amount === undefined || input.amount === null) {
    errors.push('amount is required');
  } else if (typeof input.amount !== 'number' || !Number.isInteger(input.amount)) {
    errors.push('amount must be a whole integer');
  } else if (needsReview ? input.amount < 0 : input.amount <= 0) {
    errors.push(
      needsReview
        ? 'amount must be zero or a positive integer'
        : 'amount must be a positive integer',
    );
  }

  if (input.category === undefined || input.category === null) {
    errors.push('category is required');
  } else if (!isAllowedCategory(input.category)) {
    errors.push('category must be a non-empty string');
  }

  if (input.date === undefined || input.date === null) {
    errors.push('date is required');
  } else if (!isValidDateString(input.date)) {
    errors.push('date must be a valid YYYY-MM-DD string');
  }

  if (input.comment !== undefined && typeof input.comment !== 'string') {
    errors.push('comment must be a string');
  }

  return { ok: errors.length === 0, errors };
}

/** Error thrown by {@link assertValidSpending}; carries the field messages. */
export class SpendingValidationError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(`Invalid spending: ${errors.join('; ')}`);
    this.name = 'SpendingValidationError';
    this.errors = errors;
  }
}

/**
 * Validate and narrow to a well-formed {@link SpendingInput}, throwing
 * {@link SpendingValidationError} otherwise. Normalizes an absent comment to
 * `''` and an absent `needsReview` to `false`. Carries `autoMatchedTerm`
 * through when set, so it can be persisted.
 */
export function assertValidSpending(input: Partial<SpendingInput> | undefined): SpendingInput {
  const { ok, errors } = validateSpending(input);
  if (!ok || !input) throw new SpendingValidationError(errors);
  return {
    amount: input.amount as number,
    date: input.date as string,
    comment: input.comment ?? '',
    category: input.category!,
    needsReview: input.needsReview === true,
    ...(input.autoMatchedTerm ? { autoMatchedTerm: input.autoMatchedTerm } : {}),
  };
}
