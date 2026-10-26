## Why

Spendings made in Moldova are paid in Moldovan lei (MDL), which the add form cannot convert
today — the owner has to work out the RON amount by hand. The current rate provider
(Frankfurter, ECB reference rates) does not publish MDL at all (`symbols=MDL` → `not found`),
so adding the currency also needs a second rate source.

## What Changes

- Add **MDL** as a fifth entry currency, converted to RON at write time like EUR/USD/GBP. No
  stored-record or report change: records still carry RON only.
- Add a **second rate provider** used only for MDL (open.er-api.com, key-less and CORS-enabled,
  native `RON` base). Frankfurter stays the source for EUR, USD and GBP.
- Cache each provider's rates **independently** on the device, each with its own fetch time,
  24-hour refresh guard and validation. A failure of one source never discards or blocks the
  other's rates.
- Make foreign-currency availability **per currency**: the picker disables only the currencies
  that have no cached rate, instead of all foreign currencies together.
- Add a frozen MDL rate to the demo table; the demo route still makes no rate request.
- MDL is **picker-only**: no voice/text symbol or word selects it, and `lei`/`leu` keep meaning
  RON in the parser.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `currency-conversion`: five entry currencies instead of four; two rate sources with
  independent per-source caches; cache integrity and cold-start availability scoped per source /
  per currency; demo table gains MDL.
- `voice-capture`: states explicitly that MDL is never detected from a transcript and that
  `lei`/`leu` continue to select RON.

## Impact

- `shared/src/currency.ts` — `Currency` type and `CURRENCIES` list gain MDL.
- `web/src/lib/fx.ts` — second endpoint and cache key, per-source validation, merged
  `readRates()`, MDL in `DEMO_RATES`. Existing `expenses.fxRates.v1` cache stays valid as-is.
- `web/src/components/SpendingForm.tsx` — per-currency `disabled` and unavailable message.
- Tests: `web/src/lib/fx.test.ts`, `tests/domain.test.mjs`.
- New external dependency: open.er-api.com (free tier, daily-updated rates). No attribution
  footer is added in this change.
- No Firestore, rules, functions or data migration changes.
