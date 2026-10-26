## Context

Entry-time currency conversion (archived change `add-entry-currency-conversion`) lets the add
form take EUR, USD or GBP and store the RON equivalent. All rate access lives in
`web/src/lib/fx.ts`, which fetches one Frankfurter (ECB) table per device per day, inverts it to
RON-per-unit, and caches it under `expenses.fxRates.v1`. `readCache()` and `toRateCache()` both
require a rate for **every** entry in `FOREIGN_CURRENCIES`, and the form disables all foreign
currencies together when `readRates()` returns `null`.

MDL cannot be added by extending that list: the ECB does not publish MDL, so Frankfurter answers
`not found`. Checked alternatives (2026-10-26):

| Source | MDL | Key-less | Browser CORS | Shape |
|---|---|---|---|---|
| open.er-api.com `/v6/latest/RON` | ✓ | ✓ | `ACAO: *` | `{ base_code, time_last_update_utc, rates: { MDL, ... } }` |
| jsDelivr `@fawazahmed0/currency-api` | ✓ | ✓ | `ACAO: *` | `{ date, ron: { mdl, ... } }` (lowercase, nested) |
| BNM (National Bank of Moldova) XML | ✓ | ✓ | ✗ (no ACAO) | XML; needs a server proxy |

## Goals / Non-Goals

**Goals:**
- MDL selectable in the add form and converted to RON exactly like the other foreign currencies.
- Keep ECB as the source for EUR, USD and GBP.
- A failure or absence of one rate source never degrades the currencies of the other.
- Zero-cost upgrade: devices with an existing v1 cache keep EUR/USD/GBP even offline.

**Non-Goals:**
- Voice/text detection of MDL (see D5).
- Attribution footer for open.er-api (deferred; not part of this change).
- Any stored-record, report or Firestore change — records stay RON-only.
- Server-side rate fetching or a proxy.

## Decisions

### D1 — Add a second source for MDL only, keep Frankfurter for the rest

EUR/USD/GBP stay on ECB reference rates; MDL comes from open.er-api. Each currency is taken from
exactly one source even though open.er-api also publishes EUR/USD/GBP — mixing would make the
rate for a given currency depend on which fetch happened to succeed.

*Alternative:* switch everything to open.er-api (one fetch, one cache). Simpler, but gives up ECB
rates for the three existing currencies; rejected by the owner in favour of keeping ECB.

### D2 — open.er-api.com as the MDL source

Key-less, CORS-enabled, native `RON` base, updated daily, and its `rates` object has the same
flat shape Frankfurter uses, so validation and inversion are the same code. The publication date
comes from `time_last_update_utc` instead of `date`.

*Alternatives:* jsDelivr currency-api (works, but a different nested/lowercase shape and a
community-maintained dataset); BNM (official, but no CORS — would need a Cloud Function proxy,
contradicting the client-only design of the original D6).

### D3 — Independent per-source caches; v1 key untouched

```
 refreshIfStale()
   ├─ ECB  source → validate {EUR,USD,GBP} → invert → expenses.fxRates.v1      (unchanged)
   └─ MDL  source → validate {MDL}         → invert → expenses.fxRates.mdl.v1 (new)

 readRates() = { ...ecbCache?.ronPerUnit, ...mdlCache?.ronPerUnit }   (or null if both absent)
```

Each cache keeps its own `RateCache` (`ratesDate`, `fetchedAt`, `ronPerUnit`) and its own 24h
guard, and the two refreshes run independently (one failing does not abort the other).

Model sources as a small descriptor list in `fx.ts`, e.g.
`{ storageKey, endpoint, codes, ratesDate(payload) }`, so `toRateCache`/`readCache` take the
source and validate only that source's `codes`. This splits today's double meaning of
`FOREIGN_CURRENCIES` ("picker currencies that need a rate" vs "what one response must contain");
the latter becomes per-source `codes`.

*Alternative:* one combined cache, bumped to `v2`. Rejected: every existing device loses
EUR/USD/GBP until its next online start, and a partial failure needs either all-or-nothing
(MDL outage blocks ECB updates) or merge logic.

### D4 — Availability is per currency

The form disables an option when `rates?.[code]` is missing, rather than when `rates` is `null`,
and shows the "connect once" explanation whenever any foreign currency is disabled. The
conversion path already handles a missing rate per currency (`convertToBase` → `null` → error
message), so only the picker and the message change.

### D5 — MDL is picker-only

No MDL symbol exists, and the spoken words for MDL (`lei`, `leu`) are the RON words. The parser is
unchanged: `lei` → RON. The existing "detected word moves the picker" behaviour (original D10)
gets one exception: a detected RON never moves the picker off an explicit MDL pick. Otherwise
selecting MDL and typing `150 lei cafea` would flip to RON and silently store 150 RON (~3.75× the
real value) — Moldovans say `lei` for MDL too.

*Alternatives:* recognise `mdl` (nobody says it aloud); two-word lookahead for `lei moldovenești`
(breaks the one-trailing-word rule and depends on transcription spelling). Both deferred.

### D6 — Caption word `MDL`, label `MDL — lei moldovenești`

The caption reads `150 MDL @ 0.2663`. Plain `lei` would be indistinguishable from RON captions.
Four-decimal rate trimming is kept: at ~0.27 the relative error is ≤0.02%, far below the
whole-RON round-up.

### D7 — Demo table gains MDL

`DEMO_RATES` adds `MDL: 0.2663`. The demo route still skips both sources entirely.

## Risks / Trade-offs

- [open.er-api is an aggregator, not a central bank] → acceptable: amounts are rounded up to whole
  RON, which dominates any source difference; only MDL depends on it.
- [open.er-api free-tier terms may ask for attribution] → deliberately deferred; revisit if the
  provider complains or rate-limits.
- [Provider outage or shape change] → per-source validation discards bad responses and the last
  good MDL rate stays in use indefinitely (no staleness cap, per original D7).
- [MDL is worth ~0.27 RON, so whole-RON round-up inflates small amounts (5 MDL → 2 RON, +50%)] →
  accepted; typical spends (≥30 MDL) are within a few percent, consistent with existing rounding.
- [Typing `lei` with MDL selected would flip the picker to RON] → prevented (D5): a detected RON
  never overrides an MDL pick.

## Migration Plan

No data migration. Deploying adds a new localStorage key; the existing v1 cache is read as-is.
Rollback: the previous build ignores `expenses.fxRates.mdl.v1` and keeps working on v1.
