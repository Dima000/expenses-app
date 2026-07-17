## 1. Helpers & domain logic

- [x] 1.1 Add `shortDate(dateStr: string): string` to `shared/src/date.ts` (testable home; design said web/lib) that parses `YYYY-MM-DD` parts explicitly and returns a `"7 Jun"`-style label (no UTC shift)
- [x] 1.2 Reuse the existing shared `parseAmountFromTranscript` ("first number wins") for free-text add instead of adding a duplicate helper
- [x] 1.3 Add unit tests for `shortDate` (day/month formatting, no off-by-one, malformed input) and a free-text quick-entry parser scenario (`parseAmountFromTranscript` already covers first-number/no-number)

## 2. Table refinements

- [x] 2.1 Reorder `SpendingTable.tsx` columns to Date, Amount, Comment, Category and render the date via `shortDate`
- [x] 2.2 Add client-side sort state (`'date'` default vs `'category'`) with the date order as the in-category tiebreak; make the Category header toggle it and clear back to the date default
- [x] 2.3 Keep the amount/needs-review, inline categorize-later, and edit/delete affordances working after the reorder

## 3. Free-text quick entry

- [x] 3.1 In `SpendingForm.tsx` (add mode only), replace the separate Amount and Comment inputs with a single free-text field; keep discrete fields for edit mode
- [x] 3.2 On add submit, run `parseAmountFromTranscript` and feed the result into the existing `validateSpending` / `createSpending` path unchanged
- [x] 3.3 Preserve prefill behavior (e.g. voice capture) by seeding the free-text field from prefilled amount/comment

## 4. Initial loading state

- [x] 4.1 In `App.tsx`, initialize `spendings` to `null`, set rows on the first snapshot, and reset to `null` on no-user / month change
- [x] 4.2 Pass a `loading` flag to `SpendingTable`; render a loading indicator while pending and show the empty-state only after the first snapshot arrives
- [x] 4.3 Guard `total`/`uncategorizedCount`/`visible` computations against the `null` initial value

## 5. Verify

- [x] 5.1 Run typecheck/build and the domain unit tests (`npm run build`, unit tests) and confirm green
- [x] 5.2 Manually verify in the app: date-first short-date table, category sort toggle, free-text add, and the loading state on PWA open (verified on the deployed site)
