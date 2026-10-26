import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FOREIGN_CURRENCIES } from '@expenses/shared';
import {
  DEMO_RATES,
  ECB_SOURCE,
  MDL_SOURCE,
  RATE_SOURCES,
  readRates,
  refreshIfStale,
  toRateCache,
} from './fx';

/** Minimal in-memory `Storage`; the module only uses get/set. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

/** A well-formed ECB (Frankfurter) response, base RON, as verified against the live API. */
const GOOD = { base: 'RON', date: '2026-08-27', rates: { EUR: 0.19017, USD: 0.22146, GBP: 0.16305 } };

/** A well-formed open.er-api response — it publishes EUR/USD/GBP too, which must be ignored. */
const GOOD_MDL = {
  result: 'success',
  base_code: 'RON',
  time_last_update_utc: 'Mon, 26 Oct 2026 00:02:31 +0000',
  rates: { RON: 1, MDL: 3.754761, EUR: 0.19, USD: 0.22, GBP: 0.16 },
};

const DAY_MS = 24 * 60 * 60 * 1000;
const T0 = 1_800_000_000_000;

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body };
}

/** Answer each source's endpoint with its own payload (or rejection). */
function routeFetch(routes: { ecb?: unknown; mdl?: unknown }) {
  vi.mocked(fetch).mockImplementation(async (input) => {
    const body = String(input) === MDL_SOURCE.endpoint ? routes.mdl : routes.ecb;
    if (body instanceof Error) throw body;
    return jsonResponse(body) as Response;
  });
}

function fetchedUrls(): string[] {
  return vi.mocked(fetch).mock.calls.map(([input]) => String(input));
}

beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('toRateCache', () => {
  it('inverts base-to-foreign rates into RON per one unit', () => {
    const cache = toRateCache(ECB_SOURCE, GOOD, T0);
    expect(cache).not.toBeNull();
    // 1 / 0.19017 ≈ 5.2584 RON per euro — the direction conversion needs.
    expect(cache!.ronPerUnit.EUR).toBeCloseTo(5.2584, 3);
    expect(cache!.ronPerUnit.USD).toBeCloseTo(4.5155, 3);
    expect(cache!.ronPerUnit.GBP).toBeCloseTo(6.1331, 3);
  });

  it('keeps the source date and the fetch time as separate timestamps', () => {
    const cache = toRateCache(ECB_SOURCE, GOOD, T0)!;
    expect(cache.ratesDate).toBe('2026-08-27');
    expect(cache.fetchedAt).toBe(T0);
  });

  it('rejects a partial, non-numeric or non-positive response', () => {
    // Spread GOOD so only `rates` is wrong — the base check alone would also reject.
    const ecb = (rates: unknown) => toRateCache(ECB_SOURCE, { ...GOOD, rates }, T0);
    expect(ecb({ EUR: 0.19, USD: 0.22 })).toBeNull(); // GBP missing
    expect(ecb({ EUR: '0.19', USD: 0.22, GBP: 0.16 })).toBeNull();
    expect(ecb({ EUR: 0, USD: 0.22, GBP: 0.16 })).toBeNull();
    expect(ecb(null)).toBeNull();
    expect(toRateCache(ECB_SOURCE, 'nope', T0)).toBeNull();
  });

  it('takes only MDL from the second source, inverted', () => {
    const cache = toRateCache(MDL_SOURCE, GOOD_MDL, T0)!;
    // 1 / 3.754761 ≈ 0.2663 RON per Moldovan leu.
    expect(cache.ronPerUnit).toEqual({ MDL: 0.2663 });
    expect(cache.ratesDate).toBe(GOOD_MDL.time_last_update_utc);
  });

  it('rejects a second-source response without a usable MDL rate', () => {
    const rates = { EUR: 0.19, USD: 0.22, GBP: 0.16 };
    const mdl = (r: unknown) => toRateCache(MDL_SOURCE, { ...GOOD_MDL, rates: r }, T0);
    expect(mdl(rates)).toBeNull();
    expect(mdl({ ...rates, MDL: 0 })).toBeNull();
    expect(mdl({ ...rates, MDL: '3.75' })).toBeNull();
  });

  it('rejects a table that is not RON-based or not a success', () => {
    expect(toRateCache(ECB_SOURCE, { ...GOOD, base: 'EUR' }, T0)).toBeNull();
    expect(toRateCache(ECB_SOURCE, { rates: GOOD.rates }, T0)).toBeNull();
    expect(toRateCache(MDL_SOURCE, { ...GOOD_MDL, base_code: 'USD' }, T0)).toBeNull();
    expect(toRateCache(MDL_SOURCE, { ...GOOD_MDL, result: 'error' }, T0)).toBeNull();
  });
});

describe('RATE_SOURCES', () => {
  it('supplies every foreign currency from exactly one source', () => {
    const supplied = RATE_SOURCES.flatMap((source) => source.codes);
    expect([...supplied].sort()).toEqual([...FOREIGN_CURRENCIES].sort());
  });

  it('requests exactly the ECB codes it validates', () => {
    const symbols = new URL(ECB_SOURCE.endpoint).searchParams.get('symbols');
    expect(symbols?.split(',')).toEqual([...ECB_SOURCE.codes]);
  });
});

describe('refreshIfStale', () => {
  it('fetches and caches when nothing has ever been stored', async () => {
    routeFetch({ ecb: GOOD, mdl: GOOD_MDL });
    expect(readRates(false)).toBeNull();

    await refreshIfStale({ demo: false, now: T0 });

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(readRates(false)!.EUR).toBeCloseTo(5.2584, 3);
    // MDL comes from its own source; that source's EUR is never used.
    expect(readRates(false)!.MDL).toBe(0.2663);
  });

  it('issues no request while the cache is under 24h old', async () => {
    routeFetch({ ecb: GOOD, mdl: GOOD_MDL });
    await refreshIfStale({ demo: false, now: T0 });
    vi.mocked(fetch).mockClear();

    await refreshIfStale({ demo: false, now: T0 + DAY_MS - 1 });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('refetches once the cache is older than 24h', async () => {
    routeFetch({ ecb: GOOD, mdl: GOOD_MDL });
    await refreshIfStale({ demo: false, now: T0 });
    vi.mocked(fetch).mockClear();

    await refreshIfStale({ demo: false, now: T0 + DAY_MS + 1 });

    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not let a malformed response clobber a good cache', async () => {
    routeFetch({ ecb: GOOD, mdl: GOOD_MDL });
    await refreshIfStale({ demo: false, now: T0 });
    const before = readRates(false);

    // A response missing GBP is discarded whole, not merged.
    routeFetch({ ecb: { ...GOOD, date: '2026-08-28', rates: { EUR: 1, USD: 1 } }, mdl: GOOD_MDL });
    await refreshIfStale({ demo: false, now: T0 + DAY_MS + 1 });

    expect(readRates(false)).toEqual(before);
  });

  it('keeps the existing table when the fetch fails outright', async () => {
    routeFetch({ ecb: GOOD, mdl: GOOD_MDL });
    await refreshIfStale({ demo: false, now: T0 });
    const before = readRates(false);

    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    await refreshIfStale({ demo: false, now: T0 + DAY_MS + 1 });

    expect(readRates(false)).toEqual(before);
  });

  it('does not let a response without MDL clobber a good MDL cache', async () => {
    routeFetch({ ecb: GOOD, mdl: GOOD_MDL });
    await refreshIfStale({ demo: false, now: T0 });

    routeFetch({ ecb: GOOD, mdl: { ...GOOD_MDL, rates: { MDL: 0, EUR: 1 } } });
    await refreshIfStale({ demo: false, now: T0 + DAY_MS + 1 });

    expect(readRates(false)!.MDL).toBe(0.2663);
  });

  it('keeps EUR/USD/GBP from a pre-MDL v1 cache, with MDL simply absent', () => {
    localStorage.setItem(ECB_SOURCE.storageKey, JSON.stringify(toRateCache(ECB_SOURCE, GOOD, T0)));

    const rates = readRates(false)!;
    expect(Object.keys(rates).sort()).toEqual(['EUR', 'GBP', 'USD']);
    expect(rates.MDL).toBeUndefined();
  });

  it('refreshes only the stale source', async () => {
    routeFetch({ ecb: GOOD, mdl: GOOD_MDL });
    localStorage.setItem(
      ECB_SOURCE.storageKey,
      JSON.stringify(toRateCache(ECB_SOURCE, GOOD, T0 + DAY_MS - 2 * 3600_000)),
    );
    localStorage.setItem(MDL_SOURCE.storageKey, JSON.stringify(toRateCache(MDL_SOURCE, GOOD_MDL, T0)));

    await refreshIfStale({ demo: false, now: T0 + DAY_MS + 6 * 3600_000 });

    expect(fetchedUrls()).toEqual([MDL_SOURCE.endpoint]);
  });

  it('caches MDL even when the ECB source fails', async () => {
    routeFetch({ ecb: new Error('offline'), mdl: GOOD_MDL });
    await refreshIfStale({ demo: false, now: T0 });

    expect(readRates(false)).toEqual({ MDL: 0.2663 });
  });

  it('caches EUR/USD/GBP even when the MDL source fails', async () => {
    routeFetch({ ecb: GOOD, mdl: new Error('offline') });
    await refreshIfStale({ demo: false, now: T0 });

    const rates = readRates(false)!;
    expect(rates.EUR).toBeCloseTo(5.2584, 3);
    expect(rates.MDL).toBeUndefined();
  });
});

describe('demo mode', () => {
  it('never touches either provider and uses the frozen table', async () => {
    await refreshIfStale({ demo: true, now: T0 });

    expect(fetch).not.toHaveBeenCalled();
    expect(readRates(true)).toEqual(DEMO_RATES);
    expect(readRates(true)!.MDL).toBe(0.2663);
  });

  it('is deterministic — the same table whatever the day', () => {
    expect(readRates(true)).toEqual(readRates(true));
  });
});
