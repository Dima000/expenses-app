## Context

`adopt-data-source-interface` (archived) put a `DataSource` interface between
components and their backend (`web/src/lib/dataSource.ts`), with
`FirestoreDataSource` (`web/src/lib/firestoreDataSource.ts`) as the sole
implementation today. This change adds the second: `DemoDataSource`, an
in-memory implementation of the same interface, plus a deterministic seed
data generator that populates it. Neither is wired into the running app —
`App.tsx` still only ever constructs a `FirestoreDataSource`. Wiring (mode
state machine, `/demo` route, banner) is a later change in the stack.

Full context in `docs/explorations/2026-08-01-demo-mode-and-dev-sandbox.md`.
The real `DataSource` interface as landed is a superset of that doc's
original sketch — it also has `subscribeToRange` and `assignCategory`
(categorize-later flow), both of which `DemoDataSource` must implement.

## Goals / Non-Goals

**Goals:**
- `DemoDataSource` implements every method of `DataSource` with in-memory
  state, behaviorally close enough to `FirestoreDataSource` that a future
  consumer (a component, or a test) can't tell them apart from the outside.
- A deterministic seed generator: same output every run, reproducible for
  the dev-sandbox and marketing-screenshot use cases, without needing a
  literal fixture of hardcoded dates.
- Demonstrate real auto-categorization (not faked) in the seed data.
- Establish a fast, CI-friendly place to unit-test `web/` code, scoped to
  what this change adds.

**Non-Goals:**
- No app wiring: no mode state machine, no `/demo` route, no banner, no
  "Try the demo" entry point. `DemoDataSource` is constructable and testable
  in isolation but not reachable from the UI yet.
- No change to `FirestoreDataSource`, `shared`'s `DEFAULT_CATEGORIES`, or any
  existing capability's behavior.
- No cross-implementation "contract test" suite run against both
  `DemoDataSource` and `FirestoreDataSource`. `FirestoreDataSource` has never
  been unit tested — only exercised via the local-only, emulator-gated
  `test:rules`/`test:rest` suites — and giving it its first unit tests is a
  separate initiative, not a side effect of building demo mode.
- No persistence (localStorage/IndexedDB) for the in-memory store — out of
  scope for this change and, per the exploration doc, not wanted at all.

## Decisions

### In-memory store: single array + `Set` of listeners per subscription kind, mutated in place

`DemoDataSource` holds `spendings: Spending[]` and `categories: Category[]`
as private instance state, plus a `Set` of `onData` callbacks for spending
subscriptions and one for category subscriptions. A write (`createSpending`,
`addCategory`, …) mutates the array, then notifies every registered listener
with a fresh filtered/sorted snapshot — mirroring the "recompute and push the
whole result set" behavior `FirestoreDataSource`'s `onSnapshot` listeners
already exhibit for a signed-in owner.

*Alternative considered:* an event-emitter / pub-sub abstraction shared with
`FirestoreDataSource`. Rejected — `FirestoreDataSource` doesn't have one
(Firestore's SDK provides `onSnapshot` for it), so introducing one here would
be new shared plumbing invented for a single caller. `DemoDataSource` staying
self-contained keeps its diff small and doesn't touch the existing
implementation at all.

### Listeners fire via microtask, not synchronously

A write resolves/returns, then on the next microtask each registered
listener is invoked with the new data — never synchronously inside the
mutating call. This matches `onSnapshot`'s async delivery (a Firestore write
never synchronously invokes its own listener) closely enough that component
code written against one implementation can't accidentally rely on
synchronous delivery in a way that breaks against the other.

*Alternative considered:* synchronous delivery (simpler to implement and to
reason about in tests). Rejected per the exploration doc — the two
implementations developing different timing assumptions is exactly the kind
of drift that would surface as a hard-to-reproduce bug only in demo mode.

### Seed generator: deterministic rule, not a seeded PRNG or a literal fixture

The generator is a pure function of "today" (injectable for tests) with no
randomness at all — it walks each month in range and places transactions by
day-index against a small fixed pool of `(category, comment template,
amount range)` tuples, cycling through the pool rather than drawing from it
randomly. The "some uncategorized / some needsReview / some dated today"
requirements are explicit placements (e.g. day-index `% 7 === 0` is
`needsReview`), not left to chance.

*Alternatives considered:*
- **Literal committed fixture** (a hardcoded array of rows). Rejected: dates
  must be relative to "today" regardless (so the fixture can't hold real
  date strings anyway), and ~30×6 ≈ 180 hand-authored rows is tedious to
  write and review compared to a compact generator function.
- **Seeded PRNG** (e.g. a small LCG with a fixed seed). Rejected: doesn't
  reduce the code needed for the explicit-placement requirements (uncategorized/
  needsReview/today still need deliberate logic either way), and adds a
  reproducibility trap — touching the RNG algorithm later silently reshuffles
  the entire dataset. A rule-based generator reads like ordinary domain code
  and stays diff-friendly.

### Demo categories: `DEFAULT_CATEGORIES` cloned, with terms layered on locally

`DemoDataSource` seeds its internal `categories` array from
`DEFAULT_CATEGORIES` (`@expenses/shared`), then applies a handful of
`withTermAdded` calls to that local copy (e.g. a term on Groceries, one on
Utilities) so the generator has real terms to match against. `shared`'s
`DEFAULT_CATEGORIES` export and `FirestoreDataSource`'s seeding are untouched.

*Alternative considered:* add the same terms to `DEFAULT_CATEGORIES` itself,
so every new real signup also gets them. Rejected after explicit discussion —
that's a genuine onboarding behavior change for real accounts (auto-
categorization firing from day one, off guessed generic terms that may not
match a given user's vocabulary or language), and deserves to be its own
considered product decision, not a side effect of building the demo dataset.

### Auto-categorization is demonstrated by running the real matcher, not by hand-assigning `autoMatchedTerm`

For rows meant to show off auto-categorization, the generator builds a
`SpendingInput` with `category: UNCATEGORIZED` and a comment containing one
of the seeded terms, then passes it through `applyAutoCategory` (from
`@expenses/shared`) before storing it — the same transform
`FirestoreDataSource.createSpending`'s callers rely on for the real create
path. `category`/`autoMatchedTerm` on the stored row are therefore whatever
the real matcher produces, not values the generator asserts directly.

*Alternative considered:* generator directly sets `category` +
`autoMatchedTerm` on the row. Rejected — the demo's "matched via" display
could silently diverge from what `categorize()` actually does if the two
were ever edited independently.

### Testing: introduce vitest, scoped to this change's new code only

`web/` gets its first test runner (`vitest`, matching the existing Vite
toolchain — no new bundler/config family). A single test file (or a small
few) covers `DemoDataSource` and the seed generator: subscription ordering,
listener microtask timing, category write transforms, and generator
properties (deterministic output, correct volume/date range, the required
mix of uncategorized/needsReview/today entries, at least one row produced by
the real matcher). `.github/workflows/ci.yml` gets a new step alongside the
existing build/typecheck/`test:domain` steps — it's fast and needs no
emulator, so it fits CI's "keep it lean" constraint the same way
`test:domain` already does.

*Alternative considered:* skip test infra for this change, verify manually
(matching how `FirestoreDataSource` has always been verified), and treat
adding `vitest` as separate follow-up work. Rejected — the generator's date
math and mix-of-flags placement is the fiddliest part of this change and the
part most likely to silently regress; `DemoDataSource` has zero external
dependencies, so testing it costs nothing in CI time or infra weight.

## Risks / Trade-offs

- **[Risk]** Microtask-based listener delivery makes `DemoDataSource` harder
  to unit test naively (assertions right after a write would run before
  listeners fire).
  → **Mitigation**: tests `await` a microtask flush (e.g. `await
  Promise.resolve()`) after triggering a write, same pattern real Firestore-
  backed tests already need against `onSnapshot`.
- **[Risk]** The rule-based generator's day-index placement logic could drift
  from the doc's stated mix requirements (e.g. "some" entries) without a test
  actually asserting the mix, if tests are written loosely.
  → **Mitigation**: tasks.md includes explicit assertions for each mix
  requirement (at least one uncategorized, at least one `needsReview`, at
  least one dated today, at least one auto-matched via the real matcher).
- **[Trade-off]** Adding `vitest` to `web/` for a single test file is
  infrastructure weight for a small immediate surface area. Accepted
  deliberately — the next changes in the stack (mode wiring, then UI polish)
  will have more to test against the same setup, so the cost is paid once.

## Migration Plan

1. Add `web/src/lib/demoSeedData.ts` (pure generator, no `DataSource`
   dependency) — testable standalone first.
2. Add `web/src/lib/demoDataSource.ts` (`DemoDataSource` class), consuming
   the generator to seed its initial `spendings` array.
3. Add `vitest` + minimal config to `web/`, plus
   `web/src/lib/demoDataSource.test.ts` (and a generator-focused test file if
   split out).
4. Add the `web` test step to `.github/workflows/ci.yml`.
5. Nothing constructs `DemoDataSource` from application code yet — no
   rollback concerns beyond reverting the PR; the running app is unaffected
   until the next change wires it in.

## Open Questions

- Exact comment/amount template pool content for the generator (specific
  strings and ranges) — a writing task for implementation, not a design
  fork.
- Whether the generator-vs-`DemoDataSource` split lands as two files or one —
  left to implementation; either is consistent with this design as long as
  the generator itself has no `DataSource`-shaped dependencies (keeps it
  trivially testable alone).
