## Why

`SpendingForm`, `CategoriesPage`, and `App.tsx` call Firestore-backed functions
(`createSpending`, `addCategory`, `subscribeToMonth`, …) via static imports from
`web/src/lib/spendings.ts` and `web/src/lib/categories.ts`. A planned demo mode
(seeded, local-only data for users without an account) needs an alternate,
non-Firestore implementation of the same read/write operations. Today's static
imports have no seam for that — every call site would need to branch on mode
individually. This change introduces a `DataSource` interface and moves the
existing Firestore code behind it as `FirestoreDataSource`, so a future
`DemoDataSource` (proposed separately) is a drop-in second implementation with
no further call-site changes.

This is a pure refactor: no user-visible behavior changes, no new capabilities,
no requirement changes to any existing spec.

## What Changes

- Add a `DataSource` interface covering the operations currently split across
  `lib/spendings.ts` and `lib/categories.ts`: `subscribeToMonth`,
  `subscribeToCategories`, `createSpending`, `updateSpending`, `deleteSpending`,
  `addCategory`, `renameCategory`, `removeCategory`, `setCategoryColor`,
  `addTerm`, `removeTerm`.
- Add `FirestoreDataSource`, wrapping the existing Firestore-backed bodies of
  those functions unchanged. `ownerUid` becomes a constructor argument instead
  of a parameter on every call.
- Provide the active `DataSource` via React context and a `useDataSource()`
  hook, constructed once in `App.tsx` from the signed-in `user.uid`.
- Switch `SpendingForm.tsx`, `CategoriesPage.tsx`, and the subscriptions in
  `App.tsx` from static `lib/` imports to `useDataSource()`.
- Remove the now-unused direct exports from `lib/spendings.ts` /
  `lib/categories.ts` once nothing imports them directly (the Firestore logic
  itself moves, not duplicates).
- **BREAKING (internal only)**: the call signatures of the former `lib/`
  functions change shape (no more per-call `ownerUid`/`categories` args) when
  moved onto the interface. No public/external API is affected — this is
  app-internal wiring.

## Capabilities

### New Capabilities

- `data-source-abstraction`: the architectural guarantee that spending and
  category reads/writes flow through a single swappable interface rather than
  components calling Firestore directly, and that behavior is unchanged
  through that interface. Mirrors how `offline-data-persistence` already
  specs an architectural guarantee rather than a click-by-click feature.

### Modified Capabilities

_None._ No spec-level (user-visible) behavior changes for
`spending-tracking`, `category-management`, `monthly-dashboard`,
`spending-reports`, `offline-data-persistence`, `voice-capture`,
`app-navigation`, or `web-theming`. Existing specs' scenarios must continue to
hold unchanged after this refactor.

## Impact

- **Code:** `web/src/lib/spendings.ts`, `web/src/lib/categories.ts` (become the
  `FirestoreDataSource` implementation), new `web/src/lib/dataSource.ts` (or
  similar) for the interface + context/hook, `web/src/App.tsx`,
  `web/src/components/SpendingForm.tsx`, `web/src/components/CategoriesPage.tsx`.
- **Tests:** any existing test that imports `createSpending` / `addCategory` /
  etc. directly from `lib/spendings.ts` or `lib/categories.ts` needs updating
  to go through `FirestoreDataSource` instead. Firebase emulator suites
  (`npm run test:rules`, `npm run test:rest`) should continue to pass
  unchanged in behavior.
- **No dependency, schema, or security-rule changes.**
- **Groundwork only:** does not add demo mode, seed data, or any new UI. That
  is a separate, later change that consumes this interface.
