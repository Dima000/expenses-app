## Context

`web/src/lib/spendings.ts` and `web/src/lib/categories.ts` export free
functions (`subscribeToMonth`, `createSpending`, `addCategory`, …) that call
the Firestore client SDK directly. `App.tsx` calls the `subscribe*` functions
in effects; `SpendingForm.tsx` and `CategoriesPage.tsx` import the mutation
functions and call them with `ownerUid` (and, for categories, the current
`categories` array) passed explicitly on every call.

A follow-up change (not part of this one) will add a `DemoDataSource` — an
in-memory, non-Firestore implementation of the same operations, for users
without an account. That change needs call sites that don't know or care
which implementation is active. Today's static imports don't allow that: every
call site would need its own `if (demoMode) ... else ...` branch, repeated
per component and easy to miss on one of them.

Full context in `docs/explorations/2026-08-01-demo-mode-and-dev-sandbox.md`
(exploration doc, not binding, but explains the motivating sequence).

## Goals / Non-Goals

**Goals:**
- Define a `DataSource` interface covering every read/write operation
  `SpendingForm`, `CategoriesPage`, and `App.tsx` currently perform against
  Firestore.
- Move the existing Firestore logic behind that interface as
  `FirestoreDataSource`, unchanged in behavior.
- Make the active `DataSource` available to components via context
  (`useDataSource()`), constructed once per signed-in session.
- Leave the interface's async/subscription semantics generic enough that a
  future `DemoDataSource` can implement it without another interface change.

**Non-Goals:**
- No demo mode, seed data, or new UI in this change — those are separate,
  later changes that consume this interface.
- No behavior change to any existing capability (`spending-tracking`,
  `category-management`, `monthly-dashboard`, `spending-reports`,
  `offline-data-persistence`, `voice-capture`). This is an internal seam, not
  a feature.
- No change to Firestore document shape, security rules, or the REST/voice
  capture path (`functions/src/recordSpending.ts` is untouched — it uses the
  Admin SDK server-side and never goes through this client-side interface).

## Decisions

### The interface drops `ownerUid` and `categories` as call-time arguments

Today: `createSpending(input, ownerUid, source)`, `addCategory(ownerUid,
categories, name)`. On the interface: `createSpending(input, source)`,
`addCategory(name)`.

- `ownerUid` becomes a constructor argument to `FirestoreDataSource(ownerUid)`
  — it's a property of *which* data source you have, not of each call.
- `categories` (today passed in by the caller from its own subscription state,
  because the category writers apply a pure transform over the current set
  before persisting) stays an implementation detail of `FirestoreDataSource`:
  it keeps its own last-known snapshot internally (from its own
  `subscribeToCategories`) and reads that instead of requiring the caller to
  pass it on every write. Simpler call sites; the category read-modify-write
  pattern doesn't leak into the interface.

*Alternative considered:* keep `ownerUid`/`categories` as call parameters,
only swap the function *source* by mode. Rejected — this is exactly the
shortcut described in the exploration doc's "branch inside `lib/`" option,
which keeps every call site coupled to Firestore's parameter shape and
doesn't give `DemoDataSource` a clean, minimal surface to implement.

### Subscriptions stay callback-based, not Promises/async iterables

`subscribeToMonth(month, onData): Unsubscribe` and `subscribeToCategories
(onData): Unsubscribe`, mirroring today's Firestore `onSnapshot` shape and
`App.tsx`'s existing effect-based usage. No React Query / observable library
introduced — would be a second cross-cutting change bundled into a refactor
that's supposed to be behavior-neutral.

### Delivery mechanism: React context + `useDataSource()`

`App.tsx` constructs `new FirestoreDataSource(user.uid)` once (memoized on
`user.uid`) after the existing auth gate, and provides it via
`<DataSourceContext.Provider>`. `SpendingForm`, `CategoriesPage`, and
`App.tsx`'s own subscriptions call `useDataSource()` instead of importing
`lib/spendings` / `lib/categories` functions by name.

*Alternative considered:* pass the `DataSource` down as an explicit prop
through `Dashboard` → `SpendingForm` / `CategoriesRoute` → `CategoriesPage`.
Rejected — adds a prop to thread through multiple intermediate components
(`Dashboard`, `CategoriesRoute`) that don't otherwise need it, for no benefit
over context at this component depth.

### `lib/spendings.ts` / `lib/categories.ts` become `FirestoreDataSource`'s body, not a second copy

The existing functions move (not duplicate) into a `FirestoreDataSource`
class/object in a new module (e.g. `web/src/lib/firestoreDataSource.ts`);
their Firestore query/write logic is unchanged line-for-line where possible.
`web/src/lib/spendings.ts` and `web/src/lib/categories.ts` are removed once
nothing imports them directly, rather than kept as a re-export shim —
per project convention, no backwards-compatibility shims for internal-only
call sites.

## Risks / Trade-offs

- **[Risk]** Moving Firestore logic into a class/constructor shape could
  subtly change closure/memoization behavior (e.g. `col()` helpers,
  `seedCategoriesIfAbsent`'s dedup) if not ported carefully.
  → **Mitigation**: port logic method-by-method against the existing
  functions as a checklist (see tasks.md); rely on the Firebase emulator
  suites (`npm run test:rules`, `npm run test:rest`) plus any existing
  unit/component tests to confirm identical behavior before/after.
- **[Risk]** `useDataSource()` throwing or returning `null` outside the
  provider (e.g. a future route rendered before `DataSourceContext` is set up)
  would be a new failure mode that doesn't exist today.
  → **Mitigation**: the provider wraps the app at the same point the existing
  `if (!user) return <SignIn/>` gate already sits, so no component that needs
  a `DataSource` can render before it's available — same guarantee the code
  already relies on for `user`.
- **[Trade-off]** Wider diff than the "branch inside `lib/`" shortcut for a
  change with zero user-visible behavior change. Accepted deliberately (see
  proposal) for testability and to unblock `DemoDataSource` as a clean,
  independent addition later.

## Migration Plan

1. Add the `DataSource` interface and `FirestoreDataSource` implementation
   alongside the existing `lib/spendings.ts` / `lib/categories.ts` (both exist
   simultaneously, nothing switched over yet).
2. Add `DataSourceContext` + `useDataSource()`, wire the provider into
   `App.tsx`.
3. Switch `App.tsx`'s own subscriptions to `useDataSource()`.
4. Switch `SpendingForm.tsx`, then `CategoriesPage.tsx`, one at a time,
   verifying against the emulator suites after each.
5. Delete `lib/spendings.ts` / `lib/categories.ts` once no import references
   remain (`grep` for their paths).
6. No server-side, schema, or security-rule migration — this is client-only.
   No rollback beyond reverting the PR; no data is reshaped in flight.

## Open Questions

- Exact file/module layout for the interface + `FirestoreDataSource` (single
  file vs. split by domain, mirroring today's `spendings.ts`/`categories.ts`
  split) — left to implementation; either is consistent with this design.
