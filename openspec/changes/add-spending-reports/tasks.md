## 1. Date and range helpers (`web/src/lib/date.ts`)

- [x] 1.1 Add `yearRange(year: number): { start: string; end: string }`, mirroring `monthRange`'s inclusive-start/exclusive-end `YYYY-MM-DD` bounds.
- [x] 1.2 Add a `periodRange(unit: 'month' | 'year', anchor: string)` that dispatches to `monthRange`/`yearRange` so callers don't branch on unit themselves.
- [x] 1.3 Add `addYears`/year-label helpers analogous to `addMonths`/`monthLabel`, and a shared `isNextPeriodDisabled(unit, anchor)` that returns true when the next period's start is after today.

## 2. Data layer (`web/src/lib/spendings.ts`)

- [x] 2.1 Generalize `subscribeToMonth` into `subscribeToRange(uid, start, end)`; keep `subscribeToMonth` as a thin wrapper (or update call sites) so the existing dashboard is unaffected.
- [x] 2.2 Confirm no new Firestore index is needed (existing `(ownerUid, date)` composite index already covers arbitrary ranges) — check `firestore.indexes.json`, no change expected.

## 3. Shared pure logic (`shared/src`)

- [x] 3.1 Add `groupByCategory(spendings, categories): CategoryBreakdownRow[]` — one row per category plus the `uncategorized` bucket, each with `categoryId`, `name`, `total`, `share` (exact), `count`; sorted by total descending with `uncategorized` forced last regardless of value.
- [x] 3.2 Add `largestRemainderRound(shares: number[]): number[]` — floors each share to a percentage and distributes remaining points to the largest fractional remainders so the result always sums to 100; use it to derive each row's `displayPct` from `share`.
- [x] 3.3 Add `aggregateByMonth(spendings, year): number[]` (12 entries, one per month) for the year-view trend chart, and a per-category variant for the drill-down's year-view bars.
- [x] 3.4 Add `aggregateByDay(spendings, monthKey): number[]` for one category's daily totals, for the drill-down's month-view heatmap.
- [x] 3.5 Add `niceAxisMax(rawMax: number): number` (1/2/5/10 "nice number" step) shared by the aggregate trend chart, the drill-down's year-view bars, and its month-view heatmap intensity buckets.
- [x] 3.6 Unit test all of the above in `shared/` alongside `resolveCategory`'s existing tests (CI already runs this suite).

## 4. Routing (`web/src/App.tsx`, `app-navigation`)

- [x] 4.1 Add a `/reports` route rendering the new Reports screen, using `navigate('/reports')` (not `{ replace: true }`) so back navigation returns to the dashboard, consistent with the `/categories` route.
- [x] 4.2 Read `unit` and `anchor` from `useSearchParams()` on the Reports route, defaulting to `unit=month` and the current month/year when absent; update the URL (not component state) when the owner changes period or unit.
- [x] 4.3 Add a "Reports" entry point button/link on the dashboard that navigates to `/reports`.

## 5. Reports screen

- [x] 5.1 Build the period toggle (Month/Year) and prev/next navigation, wired to `periodRange`/`isNextPeriodDisabled`.
- [x] 5.2 Build the total card (total amount + entry count) for the selected period.
- [x] 5.3 Build the category breakdown rows: swatch, name, proportion bar, `displayPct`, total; Uncategorised always rendered last and dimmed, including at zero.
- [x] 5.4 Build the year-view aggregate "Total, month by month" bar chart: y-axis with 3 ticks (`niceAxisMax`, its midpoint, 0) and gridlines; no bar (not a zero-height one) for months that haven't occurred; hover tooltip with month + total.
- [x] 5.5 Wire each row to open the category drill-down for that category, preserving the current period unit and anchor.

## 6. Category drill-down screen

- [x] 6.1 Build the drill-down header (back navigation, category swatch + name), total + entry count for the selected period.
- [x] 6.2 Build the year-view trend: one bar per elapsed month for that category, same axis/no-future-bar treatment as 5.4.
- [x] 6.3 Build the month-view trend: Monday-first calendar heatmap, single-hue intensity from the category's own colour relative to that period's peak day, "Less → More" legend, hover tooltip with date + exact amount (including 0).
- [x] 6.4 Build the transactions table: Date, Amount, Comment columns, each sortable (click toggles direction on the active column), plus a non-sortable Edit action column.
- [x] 6.5 Wire the Edit action to the existing edit-spending flow (already used by the dashboard's month table); confirm a saved edit updates the drill-down and the underlying Reports totals via the existing Firestore listener, with no separate refresh logic needed.

## 7. Verification

- [x] 7.1 Manually verify the golden path: Reports from the dashboard, Month ↔ Year toggle, prev/next including the disabled-next boundary, opening a category's drill-down, sorting the transactions table, editing a transaction and seeing totals update.
- [x] 7.2 Verify PWA back-button behavior from both Reports and the drill-down returns to the correct previous screen.
- [x] 7.3 Run `npm run test:rules` / `npm run test:rest` locally if touched paths interact with Firestore rules or the REST endpoint (not expected, since no schema change) — confirmed not applicable; this change touches no rules or REST paths.
