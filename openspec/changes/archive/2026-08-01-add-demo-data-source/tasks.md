## 1. Test infra

- [x] 1.1 Add `vitest` as a dev dependency in `web/`, with minimal config
      (no jsdom needed — `DemoDataSource` and the generator are plain TS with
      no DOM dependency).
- [x] 1.2 Add a `test` script to `web/package.json`.
- [x] 1.3 Add a `web` test step to `.github/workflows/ci.yml`, alongside the
      existing build/typecheck/`test:domain` steps.

## 2. Seed data generator

- [x] 2.1 Add `web/src/lib/demoSeedData.ts`: a pure function taking "today"
      as an injectable input (default `todayString()`/`new Date()`), with no
      `DataSource` dependency.
- [x] 2.2 Implement the date-range walk: 3–4 months of the current year plus
      2–3 months of the prior year, relative to "today", reusing
      `shared/src/date.ts` helpers (`toDateString`, `addMonths`, etc.) rather
      than reimplementing date math.
- [x] 2.3 Implement the day-index-keyed placement rule (no PRNG) producing
      ~30 entries/month from a small fixed pool of
      `(category, comment template, amount range)` tuples.
- [x] 2.4 Explicitly place the required mix: at least one `uncategorized`
      entry, at least one `needsReview` entry, at least one entry dated
      "today". All entries `source: 'web'`.
- [x] 2.5 Build the demo category set: clone `DEFAULT_CATEGORIES` and apply a
      handful of `withTermAdded` calls to the local copy (do not mutate the
      shared export).
- [x] 2.6 For entries meant to demonstrate auto-categorization: construct an
      uncategorized `SpendingInput` with a comment containing a seeded term,
      then run it through `applyAutoCategory` against the demo category set
      before finalizing the row.
- [x] 2.7 Write `web/src/lib/demoSeedData.test.ts`: determinism (same "today"
      → identical output), range/volume, the required mix, `source: 'web'`
      on every row, `DEFAULT_CATEGORIES` untouched after generation, and at
      least one entry whose `category`/`autoMatchedTerm` matches what
      `applyAutoCategory` independently returns for its comment.

## 3. DemoDataSource

- [x] 3.1 Add `web/src/lib/demoDataSource.ts`: a `DemoDataSource` class
      implementing `DataSource`, holding `spendings: Spending[]` and
      `categories: Category[]` seeded via `demoSeedData.ts` at construction.
- [x] 3.2 Implement `subscribeToRange`/`subscribeToMonth`/
      `subscribeToCategories`: register the listener, deliver an initial
      snapshot and subsequent updates via microtask (never synchronously
      inside a write), return an unsubscribe function that removes the
      listener.
- [x] 3.3 Implement `createSpending`/`updateSpending`/`assignCategory`/
      `deleteSpending` against the in-memory `spendings` array, notifying
      spending listeners after each mutation.
- [x] 3.4 Implement `addCategory`/`renameCategory`/`setCategoryColor`/
      `removeCategory`/`addTerm`/`removeTerm` against the in-memory
      `categories` array using the existing shared transforms
      (`withCategoryAdded`, `withCategoryRenamed`, etc.), notifying category
      listeners after each mutation.
- [x] 3.5 Write `web/src/lib/demoDataSource.test.ts`: every interface method
      is implemented and behaves against in-memory state; a subscription's
      listener is not invoked synchronously from a write and is invoked
      after a microtask; no Firestore/IndexedDB API is touched (e.g. no
      import of `firebase/firestore` in this file).

## 4. Wrap-up

- [x] 4.1 Run `npm run build:web` (typecheck) and the new `web` test script
      locally; confirm CI's new step passes.
- [x] 4.2 Confirm `DemoDataSource` is not imported or constructed anywhere
      in application code yet (`grep` for `DemoDataSource` outside
      `web/src/lib/` and its tests) — wiring is out of scope for this change.
