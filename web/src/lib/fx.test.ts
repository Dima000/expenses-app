import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEMO_RATES, readRates, refreshIfStale, toRateCache } from './fx';

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

/** A well-formed provider response, base RON, as verified against the live API. */
const GOOD = { base: 'RON', date: '2026-08-27', rates: { EUR: 0.19017, USD: 0.22146, GBP: 0.16305 } };

const DAY_MS = 24 * 60 * 60 * 1000;
const T0 = 1_800_000_000_000;

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body };
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
    const cache = toRateCache(GOOD, T0);
    expect(cache).not.toBeNull();
    // 1 / 0.19017 ≈ 5.2584 RON per euro — the direction conversion needs.
    expect(cache!.ronPerUnit.EUR).toBeCloseTo(5.2584, 3);
    expect(cache!.ronPerUnit.USD).toBeCloseTo(4.5155, 3);
    expect(cache!.ronPerUnit.GBP).toBeCloseTo(6.1331, 3);
  });

  it('keeps the source date and the fetch time as separate timestamps', () => {
    const cache = toRateCache(GOOD, T0)!;
    expect(cache.ratesDate).toBe('2026-08-27');
    expect(cache.fetchedAt).toBe(T0);
  });

  it('rejects a partial, non-numeric or non-positive response', () => {
    expect(toRateCache({ rates: { EUR: 0.19, USD: 0.22 } }, T0)).toBeNull(); // GBP missing
    expect(toRateCache({ rates: { EUR: '0.19', USD: 0.22, GBP: 0.16 } }, T0)).toBeNull();
    expect(toRateCache({ rates: { EUR: 0, USD: 0.22, GBP: 0.16 } }, T0)).toBeNull();
    expect(toRateCache({ rates: null }, T0)).toBeNull();
    expect(toRateCache('nope', T0)).toBeNull();
  });
});

describe('refreshIfStale', () => {
  it('fetches and caches when nothing has ever been stored', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(GOOD) as Response);
    expect(readRates(false)).toBeNull();

    await refreshIfStale({ demo: false, now: T0 });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(readRates(false)!.EUR).toBeCloseTo(5.2584, 3);
  });

  it('issues no request while the cache is under 24h old', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(GOOD) as Response);
    await refreshIfStale({ demo: false, now: T0 });
    vi.mocked(fetch).mockClear();

    await refreshIfStale({ demo: false, now: T0 + DAY_MS - 1 });

    expect(fetch).not.toHaveBeenCalled();
  });

  it('refetches once the cache is older than 24h', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(GOOD) as Response);
    await refreshIfStale({ demo: false, now: T0 });
    vi.mocked(fetch).mockClear();

    await refreshIfStale({ demo: false, now: T0 + DAY_MS + 1 });

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not let a malformed response clobber a good cache', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(GOOD) as Response);
    await refreshIfStale({ demo: false, now: T0 });
    const before = readRates(false);

    // A response missing GBP is discarded whole, not merged.
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ date: '2026-08-28', rates: { EUR: 1, USD: 1 } }) as Response,
    );
    await refreshIfStale({ demo: false, now: T0 + DAY_MS + 1 });

    expect(readRates(false)).toEqual(before);
  });

  it('keeps the existing table when the fetch fails outright', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(GOOD) as Response);
    await refreshIfStale({ demo: false, now: T0 });
    const before = readRates(false);

    vi.mocked(fetch).mockRejectedValue(new Error('offline'));
    await refreshIfStale({ demo: false, now: T0 + DAY_MS + 1 });

    expect(readRates(false)).toEqual(before);
  });
});

describe('demo mode', () => {
  it('never touches the provider and uses the frozen table', async () => {
    await refreshIfStale({ demo: true, now: T0 });

    expect(fetch).not.toHaveBeenCalled();
    expect(readRates(true)).toEqual(DEMO_RATES);
  });

  it('is deterministic — the same table whatever the day', () => {
    expect(readRates(true)).toEqual(readRates(true));
  });
});
