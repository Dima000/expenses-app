## 1. Branch

- [x] 1.1 Create branch `feat/demo-seed-cadence` off `main`

## 2. Cadence model in `demoSeedData.ts`

- [x] 2.1 Add the rule types: a discriminated union of `weekly(weekdays[], skipEvery?)` and `monthly(daysOfMonth[])` (design D1), alongside each rule's `categoryId`, comment pool, and amount cycle
- [x] 2.2 Author the cadence table from design D3 — `groceries` and `relationships` on `weekly`, the rest on `monthly`, `needsReview` fixed at amount `0`
- [x] 2.3 Author the per-rule amount cycles from design D4, picking list lengths that do not re-align with each rule's cadence
- [x] 2.4 Implement the day-walk: iterate every date from Jan 1 of the prior year through "today", asking each rule whether it fires (design D5). Delete `ENTRIES_PER_MONTH`, the `slot`/`maxDay` logic, and `amountFor`
- [x] 2.5 Implement `skipEvery` with a **per-category** occurrence counter that does not reset at month boundaries (design D2)
- [x] 2.6 Keep the two auto-match rules generating `uncategorized` inputs whose comments contain `milk` / `electricity`, still resolved through `applyAutoCategory` — not by assigning `category`/`autoMatchedTerm` directly
- [x] 2.7 Append the explicit "dated today" entry only when the walk produced no entry for today (design D6)
- [x] 2.8 Confirm the exported surface is unchanged: `DEMO_OWNER_UID`, `buildDemoCategories()`, and `generateDemoSpendings(today, categories)` keep their current signatures so `DemoDataSource` needs no edit
- [x] 2.9 Confirm every generated row still carries `source: 'web'` and a stable `id`/`createdAtMs`

## 3. Tests in `demoSeedData.test.ts`

- [x] 3.1 Replace `expect(rows.length).toBe(210)` with a per-month volume band of 30–45 entries for every fully covered month (design D7)
- [x] 3.2 Add the density assertion: at least two categories have entries on ≥8 distinct days in every fully covered month
- [x] 3.3 Add the variety assertion: at least one category sits at ~1 distinct day per month
- [x] 3.4 Add a no-future-dates assertion: no row's `date` exceeds the "today" passed in
- [x] 3.5 Add a coverage assertion: every month from January of the prior year through the current month is non-empty
- [x] 3.6 Add the current-month-proportionality case: with "today" early in a month, the current month holds only a handful of entries rather than a full month's worth
- [x] 3.7 Add a second pinned "today" in January to cover the D5 early-in-year edge (resolves the design's open question)
- [x] 3.8 Keep the existing determinism, required-mix, `source: 'web'`, `DEFAULT_CATEGORIES`-immutability, and `applyAutoCategory` tests passing unchanged
- [x] 3.9 `npm run test:web` passes

## 4. Visual verification in the running demo

- [ ] 4.1 `npm run dev`, open `/demo/reports/groceries` in month view — the heatmap shows ~10 lit days with varied intensity, not a linear ramp
- [ ] 4.2 `/demo/reports/relationships` shows a visibly different, weekend-weighted pattern
- [ ] 4.3 `/demo/reports/pet` (or `health`) shows the deliberately sparse single-day case, confirming drilldowns differ from each other
- [ ] 4.4 The dashboard's current month shows entries spread across the elapsed days, not stacked on today and yesterday
- [ ] 4.5 Reports year view for the prior year shows 12 populated bars; the current year runs January through the current month with no future bars
- [ ] 4.6 The Today, Uncategorized, and needs-review filters each still return entries

## 5. Ship

- [x] 5.1 `npm run build:web` typechecks clean
- [x] 5.2 Update `docs/explorations/2026-08-01-demo-mode-and-dev-sandbox.md` — correct the "Seed data" section's range/volume description to the new window and cadence model
- [ ] 5.3 Commit, push, open a PR referencing the relevant issue, and merge once CI is green
- [ ] 5.4 Archive the change (`/opsx:archive`) so the `demo-data-source` spec picks up the deltas
