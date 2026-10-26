import type { Currency, RateTable } from '@expenses/shared';
import { isDemoPath } from './demoRoutes';

/**
 * The ONLY place that touches the exchange-rate providers (design.md D6).
 * Everything else — the form, the conversion, the caption — reads a plain
 * `RateTable` of RON-per-unit numbers and never learns where they came from,
 * so swapping either provider is a change to this file alone.
 *
 * Two sources, each with its own cache, 24h guard and validation, so one
 * failing never degrades the other's currencies (add-mdl-currency D3).
 */

/** One rate provider: where to fetch, where to cache, and what it supplies. */
export interface RateSource {
  /** localStorage key for this source's `RateCache`. */
  storageKey: string;
  /** Key-less, CORS-enabled, `RON`-based endpoint. */
  endpoint: string;
  /** The currencies taken from THIS source — each currency has exactly one source. */
  codes: readonly Currency[];
  /**
   * True only for a successful, `RON`-based table — a table on any other base
   * would invert to plausible-looking but wrong rates and be cached for good.
   */
  isRonBased(payload: Record<string, unknown>): boolean;
  /** The source's own publication date, read from its payload — debugging only. */
  ratesDate(payload: Record<string, unknown>): string;
}

const ECB_CODES: readonly Currency[] = ['EUR', 'USD', 'GBP'];

/** ECB reference rates via Frankfurter, with native `base=RON` (design.md D6). */
export const ECB_SOURCE: RateSource = {
  // Unchanged key: devices cached before MDL existed keep EUR/USD/GBP as-is.
  storageKey: 'expenses.fxRates.v1',
  // Built from the codes, so the request and the validation can never drift.
  endpoint: `https://api.frankfurter.dev/v1/latest?base=RON&symbols=${ECB_CODES.join(',')}`,
  codes: ECB_CODES,
  isRonBased: (p) => p.base === 'RON',
  ratesDate: (p) => (typeof p.date === 'string' ? p.date : ''),
};

/**
 * open.er-api.com, for MDL only — the ECB does not publish it (add-mdl-currency
 * D2). It also returns EUR/USD/GBP, which are deliberately ignored (D1).
 */
export const MDL_SOURCE: RateSource = {
  storageKey: 'expenses.fxRates.mdl.v1',
  endpoint: 'https://open.er-api.com/v6/latest/RON',
  codes: ['MDL'],
  isRonBased: (p) => p.result === 'success' && p.base_code === 'RON',
  ratesDate: (p) => (typeof p.time_last_update_utc === 'string' ? p.time_last_update_utc : ''),
};

export const RATE_SOURCES: readonly RateSource[] = [ECB_SOURCE, MDL_SOURCE];

/** At most one fetch per source per device per day (design.md D6). */
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Frozen table for `/demo` (design.md D9). The public, unauthenticated route
 * issues no rate request at all — that keeps the one surface with unbounded
 * traffic off the providers, and makes demo conversions deterministic.
 */
export const DEMO_RATES: RateTable = { EUR: 5.2584, USD: 4.5155, GBP: 6.1331, MDL: 0.2663 };

/** What we keep on the device. */
export interface RateCache {
  /** The source's own publication date — debugging only (design.md D7). */
  ratesDate: string;
  /** Our clock, at the moment of the successful fetch — drives the 24h guard. */
  fetchedAt: number;
  /** RON per one unit of each of the source's currencies. */
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

function isUsableRate(rate: unknown): rate is number {
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0;
}

/**
 * Validate and invert a provider response (design.md D6, cache integrity).
 * Sources express rates base-to-foreign (`EUR: 0.19017` = euros per leu);
 * conversion and the caption both need the other direction, so each rate is
 * inverted here to RON-per-unit (`0.19017` → `5.2584`).
 *
 * Returns `null` unless the payload is a RON-based table and every one of the
 * source's currencies carries a finite positive rate, so a malformed or partial response can never be cached. Only
 * the source's own currencies are kept; anything else in the payload is dropped.
 */
export function toRateCache(
  source: RateSource,
  payload: unknown,
  fetchedAt: number,
): RateCache | null {
  if (!payload || typeof payload !== 'object') return null;
  if (!source.isRonBased(payload as Record<string, unknown>)) return null;
  const { rates } = payload as { rates?: unknown };
  if (!rates || typeof rates !== 'object') return null;

  const ronPerUnit: Record<string, number> = {};
  for (const code of source.codes) {
    const rate = (rates as Record<string, unknown>)[code];
    if (!isUsableRate(rate)) return null;
    ronPerUnit[code] = trimRate(1 / rate);
  }

  return {
    ratesDate: source.ratesDate(payload as Record<string, unknown>),
    fetchedAt,
    ronPerUnit,
  };
}

/** A source's cached table, or `null` when the device has never stored a usable one. */
export function readCache(source: RateSource): RateCache | null {
  const store = storage();
  if (!store) return null;
  try {
    const raw = store.getItem(source.storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RateCache>;
    // Re-validate on read: hand-edited or half-written storage must not convert.
    if (!parsed || typeof parsed.fetchedAt !== 'number' || !parsed.ronPerUnit) return null;
    for (const code of source.codes) {
      if (!isUsableRate(parsed.ronPerUnit[code])) return null;
    }
    return parsed as RateCache;
  } catch {
    return null;
  }
}

function writeCache(source: RateSource, cache: RateCache): void {
  try {
    storage()?.setItem(source.storageKey, JSON.stringify(cache));
  } catch {
    // A full or blocked quota is not worth failing an entry over; the next
    // start simply refetches and the cold-start state (D8) already exists.
  }
}

/**
 * The rate table to convert with RIGHT NOW — a synchronous read, so the add
 * form is usable with no async gate. It is the union of every source's cache,
 * so a currency is available exactly when its own source has been cached.
 * `null` means no source has ever been cached (D8).
 */
export function readRates(demo = isDemoRuntime()): RateTable | null {
  if (demo) return DEMO_RATES;
  let table: Record<string, number> | null = null;
  for (const source of RATE_SOURCES) {
    const cached = readCache(source);
    if (!cached) continue;
    table ??= {};
    // Only the source's own codes: each currency has exactly one source (D1).
    for (const code of source.codes) table[code] = cached.ronPerUnit[code];
  }
  return table;
}

/**
 * Refresh one source only when its last fetch is older than 24 hours. A
 * failure leaves that source's previous table (and its `fetchedAt`) intact, so
 * the next start retries.
 */
async function refreshSource(source: RateSource, now: number): Promise<void> {
  const cached = readCache(source);
  if (cached && now - cached.fetchedAt < REFRESH_AFTER_MS) return;

  try {
    const res = await fetch(source.endpoint);
    if (!res.ok) return;
    const next = toRateCache(source, await res.json(), now);
    if (next) writeCache(source, next);
  } catch {
    // Offline or provider down: the cached table (if any) stays in use.
  }
}

/**
 * Refresh every stale source, each independently — one failing never aborts or
 * blocks another. Never blocks the form: the caller keeps using whatever is
 * cached while this runs.
 */
export async function refreshIfStale(
  options: { demo?: boolean; now?: number } = {},
): Promise<void> {
  const { demo = isDemoRuntime(), now = Date.now() } = options;
  if (demo) return; // D9: the demo route never talks to any provider.
  await Promise.all(RATE_SOURCES.map((source) => refreshSource(source, now)));
}
