## Why

The app has no way to see spending trends or compare categories beyond a single flat month table. "Which category is growing," "what's my share of spend on groceries this year," and "when did I actually buy that" are all mental-math today. This adds a Reports screen that answers those questions directly, building on the category colours and router already shipped for exactly this purpose.

## What Changes

- Add a new **Reports** screen at `/reports` with a Month/Year period toggle and prev/next period navigation. The next-period control is disabled once the following period hasn't started yet (its start date is after today).
- Reports rows: one per category, sorted by total descending, each showing a colour swatch, name, a proportion bar, a percentage, and the total. **Uncategorised** is always shown — never hidden, even at zero — pinned last and rendered visually dimmed rather than removed.
- Row percentages are computed with largest-remainder rounding so they always sum to exactly 100, never 99 or 101.
- Year view adds a **"Total, month by month"** aggregate bar chart above the rows: a nice-rounded y-axis (3 tick values) with gridlines; months that haven't occurred yet render as no bar at all, not a zero-height one.
- Tapping a category row opens a **category drill-down** screen: the category's total and entry count for the current period, a trend visualization (12 monthly bars in Year view; a compact, Monday-first calendar heatmap of daily spend in Month view — chosen over a line chart because daily category spend is mostly-zero, bursty data with no real continuity between purchases), and a sortable transactions table (Date, Amount, Comment — each sortable; an Edit action that reuses the existing edit-spending flow rather than introducing a new one).
- **No pie/donut chart.** Considered during design and dropped — didn't earn its space once the proportion bar and percentage already carry the "share of total" read.
- **No separate "day" period.** Only Month and Year units exist; the dashboard's existing Today/Yesterday quick filters already cover single-day viewing.
- Datastore is unchanged: Reports fetches the selected range and groups it client-side in a pure function. No new Firestore indexes, aggregation queries, or rollup documents — the existing `(ownerUid, date)` index already covers arbitrary date ranges.

## Capabilities

### New Capabilities
- `spending-reports`: The Reports screen — period selection and navigation, the category breakdown rows, the year-view aggregate trend chart, and the category drill-down (its own trend visualization and sortable transactions table).

### Modified Capabilities
- `app-navigation`: Adds `/reports` as a routed screen, following the already-specified convention of carrying screen view state (period unit/anchor) as URL query parameters rather than path segments.
- `monthly-dashboard`: Adds a navigation entry point from the dashboard to the Reports screen.

## Impact

- **`web/src`**: new Reports screen and category drill-down screen/components, including the sortable transactions table; `App.tsx` gains a `/reports` route; the dashboard gains a link/button to it.
- **`shared/src`**: new pure functions colocated with existing domain logic (e.g. next to `resolveCategory`) — category grouping over an arbitrary date range, largest-remainder percentage rounding, and monthly/daily aggregation feeding the trend chart and heatmap. Covered by the same domain unit tests CI already runs.
- **`web/src/lib`**: `subscribeToMonth` generalizes to `subscribeToRange(uid, start, end)`; every period (month, year) uses the same range query.
- No Firestore index, security rules, or Cloud Functions changes.
- **BREAKING**: none.
