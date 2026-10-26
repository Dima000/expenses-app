## 1. Currency model

- [x] 1.1 Add `'MDL'` to the `Currency` type and `{ code: 'MDL', label: 'MDL — lei moldovenești', captionWord: 'MDL' }` to `CURRENCIES` in `shared/src/currency.ts`; update the "four"/"three" comments
- [x] 1.2 Add domain tests: `convertToBase(150, 'MDL', { MDL: 0.2663 })` rounds up to `40`, and `formatOriginalEntry(150, 'MDL', 0.2663)` is `"150 MDL @ 0.2663"`
- [x] 1.3 Add parser tests confirming `"150 lei cafea"` → RON and `"150 mdl cafea"` → no currency, comment `"mdl cafea"` (no parser change)

## 2. Rate module (`web/src/lib/fx.ts`)

- [x] 2.1 Introduce a source descriptor list (storage key, endpoint, currency codes, publication-date reader): ECB → `expenses.fxRates.v1`, EUR/USD/GBP; open.er-api `https://open.er-api.com/v6/latest/RON` → `expenses.fxRates.mdl.v1`, MDL
- [x] 2.2 Make `toRateCache` and `readCache` validate only the given source's codes, and cache only those codes (ignore extra currencies in the open.er-api response)
- [x] 2.3 Make `readRates()` return the union of both caches' `ronPerUnit`, or `null` when neither exists
- [x] 2.4 Make `refreshIfStale()` check and refresh each source independently against its own `fetchedAt`, so one failing never aborts the other
- [x] 2.5 Add `MDL: 0.2663` to `DEMO_RATES`; keep the demo short-circuit for both sources
- [x] 2.6 Update the module doc comments (provider isolation now covers two sources)

## 3. Rate module tests (`web/src/lib/fx.test.ts`)

- [x] 3.1 open.er-api payload inverts MDL `3.754761` → ~`0.2663` and caches no other code
- [x] 3.2 Response missing/zero/string MDL is discarded and leaves the existing MDL cache intact
- [x] 3.3 An existing v1-only cache still yields EUR/USD/GBP from `readRates()` (upgrade path)
- [x] 3.4 Independent refresh: fresh ECB + stale MDL → only the MDL endpoint is fetched; ECB failure does not block an MDL update and vice versa
- [x] 3.5 Demo mode issues no request to either endpoint and returns a table including MDL

## 4. Add form (`web/src/components/SpendingForm.tsx`)

- [x] 4.1 Disable each foreign option when `rates?.[code]` is missing (per currency) instead of when `rates` is null
- [x] 4.2 Show the "connect once" explanation whenever any foreign currency is disabled

## 5. Verify

- [x] 5.1 `npm run build` and domain/unit tests pass
- [x] 5.2 In the running app: MDL appears in the picker, `150` MDL previews `≈ 40 RON · rate 0.2663`-style output, saves 40 RON with caption `150 MDL @ …`
- [x] 5.3 With the MDL cache cleared and the network offline, EUR/USD/GBP stay selectable and only MDL is disabled
- [x] 5.4 `/demo` makes no request to either rate provider
