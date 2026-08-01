## Why

Friends without an account can't explore the app, local dev work still requires booting the Firestore emulator, and there's no clean, reproducible dataset for marketing screenshots. All three turn out to be the same underlying need: a deterministic, in-memory demo dataset reachable without auth (see `docs/explorations/2026-08-01-demo-mode-and-dev-sandbox.md`). Part 1 (`adopt-data-source-interface`) already landed the `DataSource` seam this depends on. This change builds the `DemoDataSource` implementation and its seed data generator — purely additive, not yet reachable from the running app.

## What Changes

- Add `DemoDataSource`, a `web/src/lib/` class implementing the full `DataSource` interface (`subscribeToMonth`, `subscribeToRange`, `subscribeToCategories`, `createSpending`, `updateSpending`, `assignCategory`, `deleteSpending`, `addCategory`, `renameCategory`, `setCategoryColor`, `removeCategory`, `addTerm`, `removeTerm`) over an in-memory array + listener set. Listeners fire via microtask on mutation to mirror `FirestoreDataSource`'s async snapshot timing.
- Add a deterministic seed data generator: rule-based (no PRNG), keyed by day-index, producing ~30 transactions/month across 3–4 months of the current year plus 2–3 months of the prior year, with dates computed relative to "today" at generation time. Explicitly places some uncategorized entries, some `needsReview` entries, some dated today, and spreads categories for Reports/trend-chart variety. All rows use `source: 'web'`.
- Seed a demo-only copy of `DEFAULT_CATEGORIES` (from `@expenses/shared`) with a handful of terms layered on via `withTermAdded`, so the generator can demonstrate real auto-categorization (`applyAutoCategory`) instead of hand-faking `autoMatchedTerm`. `shared`'s `DEFAULT_CATEGORIES` and real user onboarding are untouched.
- Introduce vitest to `web/` (its first test runner) scoped narrowly to `DemoDataSource` + the seed generator — fast, no Firestore emulator needed. Wire the new `web` test run into `.github/workflows/ci.yml` alongside the existing build/typecheck/`test:domain` steps.
- **Out of scope**: wiring `DemoDataSource` into the app (mode state machine, `/demo` route, banner) — that's the next change in the stack. Also out of scope: any shared "contract test" suite run against both `DemoDataSource` and `FirestoreDataSource` — `FirestoreDataSource` has never been unit tested (only exercised via the local-only, emulator-gated `test:rules`/`test:rest` suites) and retrofitting it is a separate initiative.

## Capabilities

### New Capabilities
- `demo-data-source`: an in-memory `DataSource` implementation seeded with a deterministic, date-relative dataset, usable standalone (not yet wired into the app) for a future demo mode, local dev sandbox, and marketing screenshots.

### Modified Capabilities
(none — the `data-source-abstraction` interface itself is unchanged; this change adds a new implementation of it)

## Impact

- New files: `web/src/lib/demoDataSource.ts`, a seed data generator module (e.g. `web/src/lib/demoSeedData.ts`), and `web/src/lib/demoDataSource.test.ts`.
- New dev dependency: `vitest` (+ minimal config) in `web/`.
- `.github/workflows/ci.yml`: add a `web` test step.
- No changes to `FirestoreDataSource`, `shared/src/categories.ts`'s `DEFAULT_CATEGORIES`, or any component — nothing user-visible changes yet.
