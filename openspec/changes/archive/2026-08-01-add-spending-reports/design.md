## Context

The [2026-07-26 exploration](../../../docs/explorations/2026-07-26-expense-breakdown-screen-and-datastore.md) already answered the load-bearing datastore question: at this app's scale (10 users, ~200 entries/user/month), fetching a period's range and grouping client-side is ~1000x below where Firestore's model starts to strain, and the existing `(ownerUid, date)` index already covers any date range because `date` is a fixed-width `YYYY-MM-DD` string (lexicographic range = chronological range). This design doesn't revisit that question — it builds on it.

Two prerequisites this design depends on have already shipped: category colours (`Category.colorId`, `CATEGORY_PALETTE`, `colorIdFor` in `shared/src/categories.ts`) and the `react-router` adoption, whose `app-navigation` spec already documents the query-param convention this screen is the first to actually use (`/reports?unit=month&anchor=2026-07`).

The screen's shape (rows, aggregate trend, drill-down, table) was worked out interactively against a live mockup artifact across several iterations — this document captures the decisions that came out of that process, not a fresh derivation.

## Goals / Non-Goals

**Goals:**
- Month and Year category breakdown, a year-view aggregate spend trend, and a per-category drill-down with its own trend and a sortable transactions table.
- No new Firestore indexes, aggregation queries, or rollup documents.
- Reuse the existing edit-spending flow for the drill-down table's Edit action.

**Non-Goals:**
- No pie/donut chart.
- No "day" period unit (Today/Yesterday quick filters on the existing dashboard already cover that).
- No cross-period analytics beyond month/year (e.g. year-over-year comparison).
- No listener-lifecycle/caching work — parked in `docs/explorations/2026-07-31-expense-read-caching.md`.
- No full-year calendar/contribution-graph treatment — only the per-category, per-month heatmap described below.

## Decisions

1. **Client-side range fetch + grouping over server-side aggregation.** Drill-down is free because the raw rows are already in memory; it's a pure, unit-testable function; zero new indexes or writes. Rejected: `getAggregateFromServer` (no `GROUP BY` in Firestore, one query per category, and sums-only means a second round trip to recover the rows drill-down needs anyway) and rollup documents (every edit/delete/rename has to fix up the rollup — a new class of "the numbers don't match" bugs, plus a backfill for existing data). Worst realistic case — arrow-keying through 5 years of year-views daily — is roughly $7/year over the free tier, not a real constraint.

2. **`subscribeToMonth` generalizes to `subscribeToRange(uid, start, end)`.** Both periods (month, year) compute a `[start, end)` range and call the same subscription. No schema change, since date-string ordering already gives chronological ordering for any range.

3. **Two period units: month and year only.** Dropping day and week avoids the Monday-vs-Sunday locale question for week, and keeps periods nesting cleanly (month ⊂ year) so `periodRange()` stays a small pure function.

4. **The next-period control disables once the next period's start is after today** — one rule for both units. Arrowing into a guaranteed-empty future period has no upside.

5. **View state lives in URL query params** (`/reports?unit=month&anchor=2026-07`), per the already-documented `app-navigation` convention — no new convention introduced.

6. **Uncategorised always renders, pinned last, dimmed rather than hidden, even at 0%.** Keeps row count/height stable across periods (no layout jump depending on whether anything is uncategorised) and keeps "how much still needs categorising" visible without a separate affordance.

7. **Row percentages use largest-remainder rounding.** Rounding each share independently can sum to 99 or 101, which reads as a bug. Floor each percentage, then hand the remaining points to the largest fractional remainders — the displayed percentages always sum to exactly 100. The underlying share stays an exact float; only the displayed integer is adjusted.

8. **No pie chart.** It doesn't carry information the bar/percentage/total row doesn't already show, and it costs vertical space that the aggregate trend chart uses better in year view.

9. **Aggregate trend chart (year view): bars with a "nice" rounded y-axis max, not a line.** A line implies interpolation between points; a month's total is a discrete measurement, not a sample of something continuously varying, so a line implies a shape the data doesn't have. The y-axis max is rounded up to a clean step above the raw peak (standard 1/2/5/10 "nice number" step) so gridlines land on round values and bars don't look cropped at an arbitrary maximum. A month that hasn't occurred yet renders as no bar at all — not a zero-height one — so "hasn't happened" reads as absent, not "spent nothing."

10. **Per-category drill-down trend: 12-month bars (Year view), calendar heatmap (Month view) — no sparkline in either case.**
    - Year view: a category's monthly totals are 12 discrete, independent buckets — bars, same reasoning as (9).
    - Month view: daily totals for one category are sparse and bursty (most days $0, occasional purchase days) with no real continuity between them for a line to represent honestly. A compact calendar heatmap (day-of-week grid, Monday-first, single-hue intensity from the category's own colour, "Less → More" legend since cell values aren't printed) fits that shape better than ~30 skinny bars, and additionally surfaces day-of-week patterns (e.g. "always shops Saturdays") that neither bars nor a line would show.

11. **The drill-down table's Edit action reuses the existing edit-spending flow** already specified under `monthly-dashboard`'s "Manual spending management" requirement — no second edit UI.

12. **Row-level sparkline (one per category, in the summary list) was considered and rejected.** Squeezed into every row of a 7-8-row list it added noise without adding drill-down (already free per (1)) or a place to read the shape at any real size. It found its home in the category drill-down instead (10), where it's the sole focus.

## Risks / Trade-offs

- **[Risk] A year-view drill-down's transactions table can be long** — every transaction across every elapsed month for that category, potentially 100+ rows. → Mitigation: the table scrolls internally with a sticky header rather than growing the page. No pagination for now; revisit only if a real owner's yearly transaction count makes this sluggish (unlikely at ~200 entries/user/month).
- **[Risk] `subscribeToRange` opens a fresh listener per period change**, same churn already true of today's `subscribeToMonth`. → Mitigation: none in this change — parked in `docs/explorations/2026-07-31-expense-read-caching.md`; revisit only if real usage shows listener churn costing meaningful reads.
- **[Risk] The heatmap's intensity buckets are relative to that period's own max**, so the same absolute amount can render at a different shade in a light-spend month vs. a heavy one. → Mitigation: acceptable — the heatmap's job is "which days stood out this month," not absolute cross-month comparison; the hover tooltip always shows the exact amount.

## Open Questions

None blocking. A full-year calendar/contribution-graph treatment is worth considering later if the 12-bar year trend feels insufficient in practice, but isn't part of this change.
