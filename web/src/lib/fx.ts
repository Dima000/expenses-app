import { FOREIGN_CURRENCIES, type RateTable } from '@expenses/shared';
import { isDemoPath } from './demoRoutes';

/**
 * The ONLY place that touches the exchange-rate provider (design.md D6).
 * Everything else — the form, the conversion, the caption — reads a plain
 * `RateTable` of RON-per-unit numbers and never learns where they came from,
 * so swapping providers is a change to this file alone.
 */

/** Key-less, CORS-enabled, ECB-backed, with native `base=RON` (design.md D6). */
const ENDPOINT = 'https://api.frankfurter.dev/v1/latest?base=RON&symbols=EUR,USD,GBP';

const STORAGE_KEY = 'expenses.fxRates.v1';

/** At most one fetch per device per day (design.md D6). */
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Frozen table for `/demo` (design.md D9). The public, unauthenticated route
 * issues no rate request at all — that keeps the one surface with unbounded
 * traffic off the provider, and makes demo conversions deterministic.
 */
export const DEMO_RATES: RateTable = { EUR: 5.2584, USD: 4.5155, GBP: 6.1331 };

/** What we keep on the device. */
export interface RateCache {
  /** The source's own publication date (`YYYY-MM-DD`) — debugging only (design.md D7). */
  ratesDate: string;
  /** Our clock, at the moment of the successful fetch — drives the 24h guard. */
  fetchedAt: number;
  /** RON per one unit of each foreign currency. */
  ronPerUnit: RateTable;
}

function isDemoRuntime(): boolean {
  return typeof window !== 'undefined' && isDemoPath(window.location.pathname);
}

function storage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Storage can throw outright when blocked by browser settings.
    return null;
  }
}

/** Rate trimmed to 4 decimals so the cached number and the caption agree exactly. */
function trimRate(rate: number): number {
  return Math.round(rate * 1e4) / 1e4;
}

/**
 * Validate and invert a provider response (design.md D6, cache integrity).
 * The source expresses rates base-to-foreign (`EUR: 0.19017` = euros per leu);
 * conversion and the caption both need the other direction, so each rate is
 * inverted here to RON-per-unit (`0.19017` → `5.2584`).
 *
 * Returns `null` unless every one of the three currencies carries a finite
 * positive rate, so a malformed or partial response can never be cached.
 */
export function toRateCache(payload: unknown, fetchedAt: number): RateCache | null {
  if (!payload || typeof payload !== 'object') return null;
  const { date, rates } = payload as { date?: unknown; rates?: unknown };
  if (!rates || typeof rates !== 'object') return null;

  const ronPerUnit: Record<string, number> = {};
  for (const code of FOREIGN_CURRENCIES) {
    const rate = (rates as Record<string, unknown>)[code];
    if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return null;
    ronPerUnit[code] = trimRate(1 / rate);
  }

  return {
    ratesDate: typeof date === 'string' ? date : '',
    fetchedAt,
    ronPerUnit,
  };
}

/** The cached table, or `null` when the device has never stored a usable one. */
export function readCache(): RateCache | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RateCache>;
    // Re-validate on read: hand-edited or half-written storage must not convert.
    if (!parsed || typeof parsed.fetchedAt !== 'number' || !parsed.ronPerUnit) return null;
    for (const code of FOREIGN_CURRENCIES) {
      const rate = parsed.ronPerUnit[code];
      if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) return null;
    }
    return parsed as RateCache;
  } catch {
    return null;
  }
}

function writeCache(cache: RateCache): void {
  try {
    storage()?.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // A full or blocked quota is not worth failing an entry over; the next
    // start simply refetches and the cold-start state (D8) already exists.
  }
}

/**
 * The rate table to convert with RIGHT NOW — a synchronous read, so the add
 * form is usable with no async gate. `null` means no rates have ever been
 * cached, which the form renders as "foreign currencies unavailable" (D8).
 */
export function readRates(demo = isDemoRuntime()): RateTable | null {
  if (demo) return DEMO_RATES;
  return readCache()?.ronPerUnit ?? null;
}

/**
 * Fetch a replacement table only when the last fetch is older than 24 hours.
 * Never blocks: the caller keeps using whatever is cached while this runs, and
 * a failure leaves the previous table (and the previous `fetchedAt`) intact, so
 * the next start retries.
 */
export async function refreshIfStale(
  options: { demo?: boolean; now?: number } = {},
): Promise<void> {
  const { demo = isDemoRuntime(), now = Date.now() } = options;
  if (demo) return; // D9: the demo route never talks to the provider.

  const cached = readCache();
  if (cached && now - cached.fetchedAt < REFRESH_AFTER_MS) return;

  try {
    const res = await fetch(ENDPOINT);
    if (!res.ok) return;
    const next = toRateCache(await res.json(), now);
    if (next) writeCache(next);
  } catch {
    // Offline or provider down: the cached table (if any) stays in use.
  }
}
