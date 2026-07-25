# Expense breakdown screen — and does it need a SQL database?

- **Date:** 2026-07-26
- **Status:** Exploration — paused mid-discussion, to be resumed
- **Trigger:** Wanting a screen that shows expenses per period (day/week/month/year)
  with prev/next arrows, grouped by category, each row showing a percentage and an
  amount. Open question raised alongside it: should the app move off Firestore
  documents onto Firebase's SQL offering?
- **Scale assumption:** max 10 users, ~200 entries per user per month, kept for
  several years.

> This is a thinking document, not a proposal. Nothing here is committed to.
> If a direction is chosen, it graduates into an OpenSpec change under
> `openspec/changes/`.

---

## Part 1 — The datastore question

### Sizing reality check

```
10 users × 200 entries/month
  = 2,000 writes/month
  = 24,000 docs/year
  = 240,000 docs after TEN years

Doc size ≈ 300 bytes → ~72 MB of data, maybe ~200 MB with indexes
```

Firestore's free daily allowance is 50,000 reads / 20,000 writes / 1 GiB stored.
A **decade** of accumulated data fits in a fifth of the free storage tier. Monthly
write volume is a tenth of a single day's free writes.

This workload sits roughly **three orders of magnitude** below where Firestore's
model starts to strain. It is not a scale problem. The real question is not "which
database scales" but "which query shape do I want".

### What "Firebase SQL" (Data Connect / Cloud SQL for Postgres) would cost

|                     | Firestore              | Data Connect                                        |
| ------------------- | ---------------------- | --------------------------------------------------- |
| Baseline cost/month | $0 (free tier)         | ~$10–25 — Cloud SQL instance bills 24/7, no free tier |
| Offline persistence | ✓ IndexedDB, built-in  | ✗ none                                              |
| Realtime listeners  | ✓ `onSnapshot`         | ✗ (polling / limited)                               |
| `GROUP BY`          | ✗                      | ✓                                                   |
| Ad-hoc analytics    | ✗                      | ✓                                                   |
| Security model      | `firestore.rules` (exists) | auth directives in GraphQL schema — full rewrite |

Two things stand out:

1. **Cost flips from $0/year to ~$150–300/year**, permanently, because a Cloud SQL
   instance bills for wall-clock time whether or not anyone opens the app.
   (Figures approximate; the order of magnitude is the point.)
2. **Offline disappears.** The app has an in-flight offline-persistence change, a
   PWA voice-capture shortcut, and `onSnapshot` doing cross-device sync in
   `web/src/lib/spendings.ts`. Voice-logging an expense in a shop with bad signal is
   exactly the case that breaks without offline support.

### The existing index already covers every period

`date` is a fixed-width `YYYY-MM-DD` string, so lexicographic range = chronological
range:

```
firestore.indexes.json:  (ownerUid ASC, date DESC)
                                    │
        ┌───────────────┬───────────┴───┬───────────────┐
        ▼               ▼               ▼               ▼
      DAY             WEEK           MONTH            YEAR
  2026-07-25      2026-07-20      2026-07-01      2026-01-01
       ..              ..              ..              ..
  2026-07-26      2026-07-27      2026-08-01      2027-01-01

   ~7 docs         ~46 docs        ~200 docs      ~2,400 docs

           ── ALL periods use the SAME index, zero migrations ──
```

`monthRange()` in `web/src/lib/date.ts` is one of N range functions.
`subscribeToMonth` generalises to `subscribeToRange(uid, start, end)` and every
period falls out. Storage-side change required: **none**.

### Where the real tension is: grouping

SQL does this in one round trip returning ~8 rows:

```sql
SELECT category, SUM(amount) FROM spendings
WHERE owner_uid = ? AND date >= ? AND date < ?
GROUP BY category;
```

Firestore offers three ways to render the same screen:

```
┌─ A ─ FETCH ALL, GROUP CLIENT-SIDE ────────────────────────────┐
│  reads: 1 per doc  (year view = 2,400)                        │
│  ✓ drill-down FREE — the rows are already in memory           │
│  ✓ pure function in shared/, unit-tested in CI                │
│  ✓ zero new indexes, zero new writes                          │
│  ✗ year view ≈ 500 KB, ~1-2s on mobile                        │
└───────────────────────────────────────────────────────────────┘

┌─ B ─ AGGREGATION QUERIES (getAggregateFromServer + sum()) ────┐
│  reads: ~1 per 1,000 index entries scanned                    │
│         year view = 8 queries ≈ 8 reads instead of 2,400      │
│  ✗ Firestore has NO group-by → one query PER category         │
│  ✗ needs index (ownerUid, category, date)                     │
│  ✗ returns sums but NOT rows → drill-down needs a 2nd trip    │
└───────────────────────────────────────────────────────────────┘

┌─ C ─ ROLLUP DOCS  users/{uid}/rollups/{2026-07} ──────────────┐
│  reads: month = 1, year = 12                                  │
│  ✗ every edit/delete/category-rename must fix up the rollup   │
│  ✗ backfill required for existing data                        │
│  ✗ a whole new class of "the numbers don't match" bugs        │
└───────────────────────────────────────────────────────────────┘
```

**Option A wins, and the decisive argument is drill-down.** A row reading
"Groceries — 42% — 1,240" is one a user will tap to see *which* purchases. Option A
already holds them. B and C pay a second round trip to recover what A never threw
away.

A's worst case isn't scary either: arrow-keying back through five years of year-views
is ~12,000 reads in one session. Ten users doing that *daily* runs about $7/year over
the free tier.

### Conclusion

**Stay on Firestore. Fetch the range, group in a pure function.**

Revisit only if (a) cross-period analytics are wanted — 12-month trend lines, YoY
comparison, fastest-growing category — or (b) the year view feels sluggish in
practice. Even then the first move is **not** a migration but Firestore's
**BigQuery export extension**: real SQL for analytics while Firestore stays the
operational store. `GROUP BY` without giving up offline, listeners, or $0.

---

## Part 2 — The screen

### Decisions made in this session

| Question                    | Decision                                                     |
| --------------------------- | ------------------------------------------------------------ |
| Uncategorised handling      | Single "Uncategorised" row. Spendings pointing at deleted categories merge into it. Expected to stay near-empty — the goal is to categorise everything. |
| Week view                   | **Dropped.** Weeks straddle month boundaries and add a Monday-vs-Sunday locale question for little value. |
| Period units                | Month and year are "the actual value".                        |
| Next arrow past today       | Either disable or allow-with-no-data, whichever is easier.     |
| Relationship to current dashboard | A **separate** screen, not folded into the existing one. |
| Pie chart                   | Wanted — but only after categories get colours.                |

Dropping week is worth more than it looks: periods now nest cleanly
(day ⊂ month ⊂ year), the locale question vanishes, and `periodRange()` is ~6 lines.

**Open recommendation (not yet agreed):** drop **day** too. Today/Yesterday quick
filters already ship on the main dashboard (commit `6f8c98f`), so day-level viewing
exists. And a single day is ~7 entries across maybe 3 categories — a pie chart of
that is noise. Suggested scope: month + year only.

**Open recommendation on the next arrow:** disabling is barely harder than allowing
and is better UX. One rule covers both units — *disable when the next period's start
is after today*. Arrowing into an empty 2029 is a dead end with no upside.

### Sketch

```
┌────────────────────────────────────────────────────┐
│  Breakdown                            [Tags] [⏻]  │
├────────────────────────────────────────────────────┤
│         [  Month  |  Year  ]                       │
│                                                    │
│     ◀          July 2026          ▶ (disabled)    │
│                                                    │
│   ┌──────────────────────────────────────────┐    │
│   │  Total        4,820         213 entries  │    │
│   └──────────────────────────────────────────┘    │
│                                                    │
│        ( pie lands here — after colours )          │
│                                                    │
│   Groceries       ████████████   38%      1,832   │
│   Utilities       ██████         19%        915   │
│   Kid             █████          16%        771   │
│   Health          ███            11%        530   │
│   Sports          ██              8%        385   │
│   Pet             █               5%        241   │
│   Relationships   █               3%        146   │
│   Uncategorised   ·               0%          0   │ ← pinned last
└────────────────────────────────────────────────────┘
```

The inline bar costs nothing, conveys proportion *before* colours exist, and stays
useful once the pie ships.

### One shape that serves both the table and the pie

```ts
interface CategoryBreakdownRow {
  categoryId: string;   // 'uncategorized' for the catch-all bucket
  name: string;         // resolved display name
  total: number;        // integer currency units — exact, no float drift
  share: number;        // 0..1 exact ratio    → pie slices use THIS
  displayPct: number;   // integer            → table label uses this
  count: number;        // → enables per-row drill-down later
}
```

Carrying `categoryId` (not just the name) is what lets colours slot in later without
reshaping anything.

**Why `share` and `displayPct` are separate:** round eight percentages independently
and they sum to 99 or 101. Users notice, and it reads as a bug. Largest-remainder
rounding fixes it in ~10 lines of pure code — the pie draws from exact `share`, the
table labels come from `displayPct` and always total 100.

The whole module is pure, belongs in `shared/` next to `resolveCategory`, and is
covered by the domain unit tests CI already runs.

### Data flow

```
                         ┌────────────────────────┐
   MonthNav              │  PeriodNav             │
   monthKey ─────────▶   │  { unit, anchor }      │
   +/- 1 month           │  unit ∈ month | year   │
                         └───────────┬────────────┘
                                     │ periodRange()
                                     ▼
                         ┌────────────────────────┐
                         │ subscribeToRange(      │   ← generalises
                         │   uid, start, end)     │     subscribeToMonth
                         └───────────┬────────────┘
                                     │ Spending[]
                                     ▼
                    ┌────────────────────────────────┐
                    │ shared/src/breakdown.ts        │  ← pure, CI-testable
                    │ groupByCategory(rows, cats)    │
                    │   → CategoryBreakdownRow[]     │
                    └───────────┬────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
             breakdown rows          tap → drill-down
             (sorted by total)       (rows already here)
```

---

## Part 3 — Navigation fork (undecided)

`web/src/App.tsx` currently comments: *"Full-page categories manager (in-app view
switch; no router)"*. Screens are a boolean cascade. A third screen forces a choice:

```
       NOW                      OPTION A                  OPTION B
  ─────────────            ─────────────────          ──────────────
  showCategories           view: 'dashboard'          react-router
  boolean                        | 'categories'
                                 | 'breakdown'
  2 screens ✓              3 screens ✓                3 screens ✓
                           ~0 new code                +~15 KB dep
                           no dep                     real URLs
                           back button still          Android/PWA back
                             exits the app              button works
```

**Leaning A** — a `view` union is honest at three screens and keeps the change small.

**But flag, don't bury:** in the installed PWA an in-app view switch pushes no history
entry, so the system back button from Categories likely exits the app rather than
returning to the dashboard. That's a real papercut that worsens with each screen —
worth its own small change rather than smuggling a router into this one.
(Not verified by testing; assumption based on the no-router implementation.)

---

## Part 4 — Sequencing

```
  fix-category-reseed-offline-persistence   ← in flight
                  │
                  ▼
        category colours  (Category.color, palette for the
                           8 seeds, CategoriesPage picker)
                  │
                  ▼
        pie chart on the breakdown screen
```

Colours touch `Category` in `shared/src/types.ts` and the seeding path — the same
seeding path the in-flight change rewrites. Land that first, or the colours change
merges against itself.

**The breakdown table itself has no dependency on any of this and can start now.**

---

## Open threads — resume here

- **Day view: keep or cut?** Recommendation above is to cut (Today/Yesterday filters
  already cover it). Not yet agreed.
- **Zero-spend categories.** A month where "Pet" had nothing — hide the row, or show
  `0 / 0%`? Leaning hide, but the table height then jumps while arrowing between
  periods.
- **Drill-down in scope for v1?** Free with option A, and the strongest reason never
  to switch to server-side aggregation. Affects whether rows are tappable, so worth
  deciding before building.
- **A year hides its own shape.** Twelve months collapsed to one percentage loses the
  trend. A 12-point sparkline per row is free once the raw rows are in memory. Scope
  creep for v1, but another argument for keeping raw rows over aggregation queries.
- **Navigation fork** (Part 3) — union type vs. router.

### If/when this graduates

Likely shape: a new `spending-breakdown` capability, plus a small delta on
`monthly-dashboard` for the nav entry point — leaving colours and the pie chart as a
separate follow-up change.
