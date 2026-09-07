## 1. Shared domain — currency model and conversion

- [x] 1.1 Add a `Currency` type (`'RON' | 'EUR' | 'USD' | 'GBP'`), a `BASE_CURRENCY = 'RON'` constant, and a `CURRENCIES` display list to `shared/src/` (new `currency.ts`), exported from `shared/src/index.ts`.
- [x] 1.2 Add `convertToBase(amount: number, currency: Currency, ronPerUnit: Record<string, number>): number | null` to `shared/src/money.ts`, returning the RON value **unrounded** and `null` for a missing/non-positive rate. Return the input unchanged for `RON`. Document beside `roundUpAmount` that the ceiling is applied once, downstream of this call (design D5).
- [x] 1.3 Add optional `origAmount?: string` to `SpendingInput` in `shared/src/types.ts`, documented as display-only text that nothing parses (design D2).
- [x] 1.4 Carry `origAmount` through `assertValidSpending` in `shared/src/validation.ts` using the same conditional-spread pattern as `autoMatchedTerm`, so it is never written as `undefined`.
- [x] 1.5 Add a `formatOriginalEntry(amount, currency, rate): string` helper producing the caption form `"11 euro @ 5.2584"`, so the add form and any future writer agree on one format.

## 2. Shared domain — parser currency detection

- [x] 2.1 Change `parseAmountFromTranscript` in `shared/src/parseAmount.ts` to return the amount **unrounded** and stop calling `roundUpAmount`; add `currency: Currency | null` to `ParsedUtterance`. Update its doc comment — rounding now happens downstream of conversion.
- [x] 2.2 Detect a leading `€`/`$`/`£` symbol and map it to EUR/USD/GBP, stripping it from the comment as today.
- [x] 2.3 Detect a recognised currency **word** immediately following the number and strip it from the comment. Cover RO + EN: `lei/leu/ron`, `euro/euros/eur`, `dolar/dolari/dollar/dollars/usd`, `lira/lire/pound/pounds/gbp`. Match case-insensitively with diacritics normalised (`liră` → `lira`).
- [x] 2.4 Leave an unrecognised trailing word untouched in the comment (`"10 coffee"` keeps `"coffee"`), and report `currency: null` when neither a symbol nor a recognised word is present.
- [x] 2.5 Update every existing caller of the rounded return value so behaviour is preserved where no currency is involved.

## 3. Rate module (`web/src/lib/fx.ts`)

- [x] 3.1 Create `web/src/lib/fx.ts` as the only place that touches the rate provider (design D6).
- [x] 3.2 Implement the fetch against `https://api.frankfurter.dev/v1/latest?base=RON&symbols=EUR,USD,GBP`, **inverting** each returned rate to RON-per-unit before use (`0.19017` → `5.2584`).
- [x] 3.3 Validate the response shape before caching — a finite positive rate for each of EUR, USD and GBP — and discard anything malformed or partial without overwriting an existing table (design: cache integrity).
- [x] 3.4 Persist to `localStorage` as `{ ratesDate, fetchedAt, ronPerUnit }`, keeping the two timestamps distinct (`fetchedAt` drives refresh, `ratesDate` is the source's publication date).
- [x] 3.5 Expose a read that returns the cached table synchronously (so the form is usable with no async gate) plus a `refreshIfStale()` that fetches only when `fetchedAt` is older than 24h and never blocks on the result.
- [x] 3.6 Wire `refreshIfStale()` into app start in `web/src/App.tsx`.
- [x] 3.7 Add a compiled-in frozen stub table and use it when running in demo mode, issuing no network request (design D9).

## 4. Add form — picker, preview, conversion

- [x] 4.1 Add a currency `Select` (existing shadcn component, 4 options) to add mode in `web/src/components/SpendingForm.tsx`, defaulting to RON on every open — reset it in the existing open-effect alongside the other fields (design D11).
- [x] 4.2 Render EUR/USD/GBP **disabled** with an "unavailable until you connect once" explanation when no rate table is cached; keep RON always selectable (design D8).
- [x] 4.3 Have a detected symbol or currency word from the parsed entry text move the picker, so the control and the text can never disagree on screen (design D10).
- [x] 4.4 Show the conversion preview `≈ 58 RON · rate 5.2584` for non-RON only; show nothing for RON.
- [x] 4.5 On submit, convert then round exactly once — `convertToBase()` followed by `roundUpAmount()` — and never round the entered foreign amount first (design D5).
- [x] 4.6 Build `origAmount` via `formatOriginalEntry` for non-RON submissions only, and leave it unset for RON.
- [x] 4.7 In edit mode, add no currency control; display the existing `origAmount` read-only next to the RON amount, mirroring the existing `autoMatchedTerm` hint line (design D3).
- [x] 4.8 Pass the editing record's `origAmount` back through on submit so `updateSpending` can decide whether to keep it.

## 5. Voice prefill

- [x] 5.1 Add `currency` to the `VoiceCapture` prefill shape in `web/src/components/VoiceButton.tsx` and pass through what the parser detected.
- [x] 5.2 Thread `currency` through the `prefill` prop in `web/src/App.tsx` and seed the picker from it in `SpendingForm`, falling back to RON when nothing was detected.

## 6. Persistence

- [x] 6.1 Persist `origAmount` in `firestoreDataSource.createSpending`, using the conditional spread so `undefined` is never written.
- [x] 6.2 In `firestoreDataSource.updateSpending`, retain `origAmount` when the amount is unchanged and `deleteField()` it when the amount changed (design D4).
- [x] 6.3 Confirm no change is needed in `firestore.rules` (`validSpending` uses `hasAll`, not `hasOnly`) and leave `functions/recordSpending.ts` and the REST path RON-only.

## 7. Tests

- [x] 7.1 Extend `tests/domain.test.mjs` for `convertToBase`: RON passthrough, correct multiplication, `null` on a missing or non-positive rate.
- [x] 7.2 Extend `tests/domain.test.mjs` for convert-then-round ordering — `10.4` EUR at `5.0` yields `52`, not `55`.
- [x] 7.3 Extend `tests/domain.test.mjs` for the parser: unrounded return, leading symbol, trailing RO and EN currency words, diacritics normalisation, base-currency word stripping (`"10 lei bere"` → `10`, RON, `"bere"`), unrecognised trailing word preserved, and the existing literal-number and no-number cases still passing.
- [x] 7.4 Add `web/src/lib/fx.test.ts` (vitest) covering rate inversion, rejection of a malformed/partial response without clobbering a good cache, the 24h refresh guard, and the demo stub path issuing no fetch.
- [x] 7.5 Add a test for the caption lifecycle: retained when only the comment changes, removed when the amount changes.
- [x] 7.6 Run `npm run test:domain` and `npm run test:web`; run `npm run test:rules` locally to confirm the unchanged rules still accept a record carrying `origAmount`.

## 8. Wrap-up

- [x] 8.1 Typecheck and build: `npm run build:shared` then `npm run build:web`.
- [ ] 8.2 Manually verify the four states in the app: RON entry unchanged, a EUR entry converting and captioned, edit showing the caption read-only with no picker, and `/demo` making no rate request (check the network panel).
- [x] 8.3 Open a PR on a `feat/` branch referencing the change, and let CI run before merging.
