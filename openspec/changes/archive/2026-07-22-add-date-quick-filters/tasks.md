## 1. Date helper

- [x] 1.1 Add `yesterdayString()` to `web/src/lib/date.ts` (local time, `YYYY-MM-DD`), mirroring `todayString()` and handling month/year rollover via `Date.setDate`.

## 2. Dashboard filter state

- [x] 2.1 In `web/src/App.tsx`, replace the `onlyUncategorized` boolean state with an exclusive `activeFilter: FilterId | null` (`'uncategorized' | 'today' | 'yesterday'`).
- [x] 2.2 Add a predicate map (`uncategorized` → `isUncategorized`, `today` → `s.date === todayString()`, `yesterday` → `s.date === yesterdayString()`).
- [x] 2.3 Compute `visible` from the active filter's predicate; show all spendings when no filter is active. Keep it memoized on `spendings` and `activeFilter`.

## 3. Filter buttons UI

- [x] 3.1 Add **Today** and **Yesterday** toggle buttons to the filter row at `size="sm"`, keeping every filter button on `variant="outline"` and layering an active-state className so toggling doesn't shift the row.
- [x] 3.2 Wire each button to exclusively select its id (re-click clears it); keep the Uncategorized button's count badge and its existing disabled rule.

## 4. Verify

- [x] 4.1 Typecheck/build the web app (`npm run build` or the project's typecheck).
- [x] 4.2 Manually verify: no filter shows the whole month; Today/Yesterday each narrow correctly; selecting one deactivates the others; re-clicking the active filter restores the full month; toggling does not shift the row.
