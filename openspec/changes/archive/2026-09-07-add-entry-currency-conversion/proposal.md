## Why

Spendings are recorded in whole RON units with no way to enter a foreign amount, so a
purchase made in EUR, USD or GBP has to be converted by hand before it can be typed in.
That is friction at the exact moment the owner is trying to capture a spending quickly,
and hand-conversion is the step most likely to be skipped or fudged.

Converting at entry — rather than storing a currency per record — keeps every read path
(totals, reports, drilldowns, month filtering) working on a single unit, so the feature
costs nothing outside the entry form.

## What Changes

- The add-spending form gains a currency picker offering RON, EUR, USD and GBP. It
  defaults to RON on every open, so forgetting to change it always yields a correct entry.
- When a non-RON currency is selected, the amount is converted to RON at write time and
  only the RON amount is persisted. Conversion happens **before** the existing round-up,
  so the whole-unit ceiling is applied exactly once.
- A new optional, display-only text field `origAmount` records what was actually entered
  (for example `"11 euro @ 5.2584"`). Nothing parses it; it exists so a converted record
  can still be explained later. It is written only for non-RON entries.
- Exchange rates are fetched client-side from a free, key-less, CORS-enabled ECB-backed
  API, inverted to "RON per unit", and cached on the device. The cache is refreshed at
  most once per day, checked on app start. Stale rates are used as-is.
- When no rates have ever been cached and the fetch fails (first run while offline), the
  three foreign currencies are shown but disabled with an explanation. RON entry is never
  blocked.
- The transcript/free-text parser learns currency: a leading symbol (`€`, `$`, `£`) or a
  trailing currency word (`euro`, `lei`, `dolari`, `pounds`, …) selects the currency and
  is stripped from the comment. **BREAKING (internal):** the parser now returns a *raw*
  amount plus a currency instead of a pre-rounded amount, because rounding must move
  downstream of conversion.
- Voice capture inherits the picker for free — it already opens the add form prefilled for
  review rather than writing directly.
- The edit form does **not** get a picker. It shows the RON amount plus the `origAmount`
  caption read-only. The caption is cleared only when the amount itself changes.
- The public `/demo` route stays fully network-free and uses a frozen stub rate table.
- The REST endpoint remains RON-only; it has no device cache and no rate access.

## Capabilities

### New Capabilities
- `currency-conversion`: available currencies and the RON base, where rates come from,
  the once-per-day device cache and its staleness policy, cold-start behaviour when no
  rates exist, and the demo-mode stub.

### Modified Capabilities
- `spending-tracking`: currency selection at entry, convert-then-round ordering, and the
  new display-only `origAmount` field including its clear-on-amount-change lifecycle.
- `voice-capture`: the "currency symbol is ignored" scenario is no longer correct; the
  parser now yields a raw amount plus a detected currency, and recognised currency words
  are stripped from the comment.

## Impact

**New code**
- `web/src/lib/fx.ts` — rate fetch, inversion, localStorage cache, staleness, demo stub.

**Modified code**
- `shared/src/money.ts` — add `convertToBase()` alongside `roundUpAmount`.
- `shared/src/parseAmount.ts` — symbol/word currency detection; return raw amount.
- `shared/src/types.ts` — optional `origAmount?: string` on `SpendingInput`.
- `shared/src/validation.ts` — carry `origAmount` through `assertValidSpending`.
- `web/src/components/SpendingForm.tsx` — picker, conversion preview, caption display.
- `web/src/components/VoiceButton.tsx`, `web/src/App.tsx` — carry currency in the prefill.
- `web/src/lib/firestoreDataSource.ts` — persist `origAmount`; conditional clear on update.

**Explicitly unaffected**
- `firestore.rules` — `validSpending` uses `hasAll`, not `hasOnly`, so an extra optional
  field needs no rule change.
- `functions/` (`recordSpending`, REST endpoint) — RON-only, unchanged.
- All read paths: `SpendingTable`, `TotalCard`, reports, drilldowns, month/range queries.
- `demoDataSource` and the stored Firestore document shape for existing records.

**New external dependency**
- A public exchange-rate API (`api.frankfurter.dev`), reached directly from the browser.
  It is a free community service with no SLA; the fetch is isolated behind `fx.ts` so the
  provider can be swapped in one file, and every failure mode degrades to "foreign
  currencies unavailable, RON unaffected".
