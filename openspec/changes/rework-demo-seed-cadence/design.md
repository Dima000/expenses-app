## Context

`web/src/lib/demoSeedData.ts` generates the demo dataset from a single running
`dayIndex` that simultaneously drives date placement (`slot % maxDay`), category
selection (`% 7`, `% 5`, `% 11`, `% 8`), and amount (`min + dayIndex % range`).
Three independent concerns share one counter, which produces the three defects
listed in the proposal — the current-month collapse, per-category sparsity
below what the drilldown heatmap needs, and a visibly synthetic texture.

The consumer that sets the bar is `CategoryDrilldownPage` (`CategoryDrilldownPage.tsx:56,68`):
it filters to one category via `spendingsForCategory`, then calls
`aggregateByDay(filtered, anchor)` and hands the result to `CalendarHeatmap`.
So the quantity that matters is **distinct days per category per month**, not
entries per month. Today that number is 1–3; the calendar needs roughly 8+ for
at least a couple of categories to look like a real account.

Constraints carried over unchanged: the generator is a pure function of "today"
with no randomness, it must not mutate `DEFAULT_CATEGORIES`, auto-categorized
rows must come from `applyAutoCategory` rather than being authored directly,
and the exported signature `generateDemoSpendings(today, categories)` must stay
put so `DemoDataSource` needs no edit.

## Goals / Non-Goals

**Goals:**

- Populate the drilldown heatmap for at least two categories in every fully
  covered month.
- Remove the current-month collapse structurally, not by patching `maxDay`.
- Keep density *varied* across categories — a demo where every drilldown looks
  identical is its own kind of fake.
- Stay deterministic and PRNG-free, and keep the dataset readable: someone
  should be able to look at the cadence table and predict what a month contains.
- Widen coverage so both year-views in Reports are populated.

**Non-Goals:**

- No seeded PRNG, hashing, or noise function. Rejected in favour of authored
  constants — see Decision 4.
- No changes to `DemoDataSource`, `demoRoutes`, `App.tsx`, or any Firestore
  path. This change is confined to the generator and its test.
- Not modelling realistic *inflation*, seasonality, or category correlation.
  Plausible texture is the bar, not simulation fidelity.
- Not adding the "Try the demo" sign-in link — that stays in Part 4 of the
  exploration doc.

## Decisions

### D1 — Two cadence rule kinds, walked day-by-day

Replace slot-filling with a walk over every date in the covered window, asking
each rule whether it fires:

```
weekly(weekdays[], skipEvery?)   fires on the listed weekdays
monthly(daysOfMonth[])           fires on the listed days of the month
```

Walking days rather than filling slots is what deletes the current-month bug:
the walk simply stops at "today", so a partial month contains exactly the
entries its cadences produced for the elapsed days. There is no `maxDay`, no
wrap, and no future-dated entry possible by construction.

Two rule kinds cover every shape needed: `weekly` for habitual spend (the dense
categories) and `monthly` for fixed or occasional spend (bills, one-offs).

**Alternative considered:** a third `everyNWeeks` rule so `pet` could skip whole
months. Dropped — it buys one category's worth of texture for a third code path
and a third mental model. `monthly([14])` is the simpler sparse case, and
`health` at `monthly([9])` already gives a one-day-per-month drilldown.

### D2 — `skipEvery` counts per-category occurrences, and does not reset per month

`skipEvery: N` drops every Nth firing of that rule, counted from the start of
the whole run. Not resetting at month boundaries is deliberate: a counter that
reset would make every month's skip pattern identical, reintroducing exactly the
regularity this change removes. Letting it run continuously means the skipped
days drift through the calendar, so consecutive months differ without any
randomness.

The counter is **per category**, which is what satisfies the spec requirement
that changing one category's cadence cannot disturb another's entries. This is
the specific property the current global `dayIndex` lacks: today, inserting one
entry anywhere shifts the category *and* amount of every later entry in the
dataset.

### D3 — The cadence table

Measured against a prototype over 2025-01-01 … 2026-08-02 (20 months, 691
rows). "Worst" is the minimum across all fully covered months, i.e. February.

| rule | cadence | worst distinct days/mo |
| --- | --- | --- |
| `groceries` | `weekly([Tue, Thu, Sat], skipEvery: 5)` | **10** |
| `relationships` | `weekly([Wed, Fri, Sat], skipEvery: 4)` | **9** |
| `uncategorized` | `monthly([6, 17, 28])` | 3 |
| `kid` | `monthly([5, 18])` | 2 |
| `sports` | `monthly([7, 21])` | 2 |
| `other` | `monthly([11, 26])` | 2 |
| `needsReview` | `monthly([8, 21])`, amount `0` | 2 |
| `utilities` | `monthly([3])` (+ auto-matched day 2) | 2 |
| `health` | `monthly([9])` | 1 |
| `pet` | `monthly([14])` | 1 |
| auto-match → groceries | `monthly([10])`, comment contains `milk` | — |
| auto-match → utilities | `monthly([2])`, comment contains `electricity` | — |

Full-month volume lands at **34–38** entries, above today's flat 30. That is a
consequence of the density requirement rather than an independent choice: to
guarantee ≥8 distinct days in a 28-day February a category needs three weekdays
(12 firings) with only light skipping, so the two dense categories alone account
for ~19 entries. The spec band is set at 30–45 to reflect this rather than
starving the other categories to hit an arbitrary 30.

`groceries` and `relationships` are the two chosen for density because they are
the two a viewer intuitively expects to recur, and their weekday sets differ —
groceries reads as a spread-out shopping rhythm, relationships as a
weekend-weighted one. The resulting heatmaps look different from each other,
which is the point.

### D4 — Authored amount cycles instead of an arithmetic function

Each rule carries a short list of amounts, cycled by that rule's own occurrence
index:

```
groceries      [42, 18, 37, 63, 22, 51, 29, 45, 15, 34]
relationships  [58, 24, 71, 33, 46, 19, 62]
utilities      [47, 52, 44, 61, 49]
…
```

A human picking the numbers is the whole trick: the values look organic without
any randomness, and each is a stable, readable constant. List lengths are chosen
coprime-ish with the cadence so amounts do not re-align with weekdays and
produce a repeating stripe.

This also removes the linear intensity ramp — `min + dayIndex % range` made the
heatmap shade march upward and wrap, which is one of the more obvious tells in
the current dataset.

**Alternatives considered:** a fixed-seed LCG, and a hash of the date string.
Both would look marginally more natural, and both remain deterministic, so
neither would have violated the existing "no randomness" requirement's *intent*.
Rejected because authored constants are the simplest thing that clears the bar,
and they preserve the property that you can read the generator and predict its
output — the reason we can drop the exact-count test without losing confidence.

### D5 — Coverage window: full prior calendar year + current year to date

Chosen over a rolling N-month window because it is a simpler sentence with no
window arithmetic, and it is what makes both Reports year-views useful: the
prior-year view is always 12 full bars, and the current-year view runs January
through the current month with no future bars.

**Accepted consequence:** in early January the current-year view and the
dashboard's current-month view are nearly empty. That is the honest depiction of
a real account at that moment, and engineering around it (back-dating, or
pretending the current month is complete) would reintroduce the very thing this
change removes. Recorded here rather than fixed.

### D6 — The "dated today" entry stays an explicit injection

Cadences cannot guarantee an entry on "today" — if today is a Sunday on a day
of the month no `monthly` rule names, nothing fires. Since the spec requires at
least one entry dated today (it exercises the dashboard's Today filter), the
generator keeps an explicit append of one entry dated `today`, as the current
implementation does.

Guard against duplication: only append when the cadence walk produced no entry
for today, so the common case does not get an extra unexplained row.

### D7 — Test assertions become bands plus a density check

`expect(rows.length).toBe(210)` is not portable to an emergent volume, and the
replacement `toBe(691)` would be a change-detector asserting nothing but "output
did not move". Replaced by assertions that state the intent:

- every fully covered month has 30–45 entries;
- at least two categories reach ≥8 distinct days in a fully covered month;
- at least one category sits at ~1 day per month;
- no entry is dated after "today";
- every month from January of the prior year through the current month is
  non-empty.

Determinism keeps its existing test (`generate(TODAY)` twice, deep-equal), which
is what actually protects reproducibility — the exact count never did.

## Risks / Trade-offs

- **Volume rises from 30 to ~35 per month, and total rows from 210 to ~690.**
  → In-memory arrays of ~700 plain objects; `DemoDataSource` filters per month
  for its subscriptions, so per-render work is unchanged. No mitigation needed
  beyond noting it.

- **The dense-category guarantee is tightest in February.** A later tweak to
  `groceries`/`relationships` could silently drop below 8 distinct days.
  → The ≥8 assertion runs against every fully covered month including February,
  so a regression fails the test rather than quietly degrading a screenshot.

- **Weekday-driven placement makes output depend on the calendar of the year
  being generated.** A test pinned to `new Date(2026, 7, 1)` passes while a
  different "today" could, in principle, behave differently.
  → Assertions are ranges over all covered months rather than facts about one
  month, so they hold for any "today"; worth spot-checking a second "today"
  value in the suite.

- **Authored amount lists are a maintenance surface** — twelve small arrays that
  nobody will ever revisit.
  → Accepted. They are inert constants with no invariants to preserve beyond
  "look plausible".

- **Early-January emptiness (D5).** → Accepted and recorded, not mitigated.

## Migration Plan

None required. The generator is demo-only and holds no persisted state: demo
data is rebuilt in memory on every page load, so the change takes effect on
deploy with nothing to migrate, back-fill, or clean up. Rollback is a revert.

## Open Questions

- Should the suite pin a second "today" (e.g. a January date) to cover the
  early-in-year edge from D5, or is one pinned date plus range-based assertions
  enough? Leaning toward adding the second date — it is a two-line cost and it
  is exactly the case D5 accepts a known weakness in.
