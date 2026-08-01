## 1. Define the interface

- [x] 1.1 Add `DataSource` interface (`subscribeToMonth`, `subscribeToCategories`,
      `createSpending`, `updateSpending`, `deleteSpending`, `addCategory`,
      `renameCategory`, `removeCategory`, `setCategoryColor`, `addTerm`,
      `removeTerm`) — new module, e.g. `web/src/lib/dataSource.ts`.
      (Also added `subscribeToRange` and `assignCategory` — used by
      `useRangeSpendings`/`SpendingTable` and required to fully retire
      `lib/spendings.ts` per task 5.)
- [x] 1.2 Add `DataSourceContext` (React context) and `useDataSource()` hook in
      the same module, throwing a clear error if called outside the provider.

## 2. Implement `FirestoreDataSource`

- [x] 2.1 Create `FirestoreDataSource`, constructed with `ownerUid`, in a new
      module (e.g. `web/src/lib/firestoreDataSource.ts`).
- [x] 2.2 Port `subscribeToMonth`/`subscribeToRange` and `subscribeToCategories`
      bodies from `web/src/lib/spendings.ts` / `categories.ts` unchanged,
      closing over `ownerUid` instead of taking it as a parameter.
- [x] 2.3 Port `createSpending`, `updateSpending`, `deleteSpending` bodies
      unchanged.
- [x] 2.4 Port `addCategory`, `renameCategory`, `removeCategory`,
      `setCategoryColor`, `addTerm`, `removeTerm` bodies, having
      `FirestoreDataSource` keep its own last-known `categories` snapshot
      (from its own `subscribeToCategories`) instead of requiring callers to
      pass the current set on every write.
- [x] 2.5 Port `seedCategoriesIfAbsent`'s create-if-absent transaction logic
      and cache-vs-server-snapshot handling verbatim — this is the trickiest
      piece to get subtly wrong (see design.md Risks).

## 3. Wire the provider

- [x] 3.1 In `web/src/App.tsx`, construct `FirestoreDataSource` once per
      `user.uid` (memoized) after the existing `if (!user) return <SignIn/>`
      gate, and wrap the signed-in tree in `<DataSourceContext.Provider>`.
- [x] 3.2 Switch `App.tsx`'s own `subscribeToMonth` / `subscribeToCategories`
      effects to call through the `DataSource` (App itself constructs the
      instance, so it calls its methods directly rather than through
      `useDataSource()`, which is for descendant components).

## 4. Migrate call sites

- [x] 4.1 Switch `web/src/components/SpendingForm.tsx` from importing
      `createSpending`/`updateSpending` to `useDataSource()`; drop the
      `ownerUid` prop it currently takes just to forward to those calls.
- [x] 4.2 Switch `web/src/components/CategoriesPage.tsx` (including
      `CategoryRow`) from importing `addCategory`/`renameCategory`/
      `removeCategory`/`setCategoryColor`/`addTerm`/`removeTerm` to
      `useDataSource()`; drop the `ownerUid` prop threaded through
      `CategoriesRoute` → `CategoriesPage` → `CategoryRow` for that purpose
      (keep it only if still needed for anything else — check before removing).
      (Also migrated `SpendingTable.tsx` (`assignCategory`/`deleteSpending`)
      and `useRangeSpendings`/`ReportsPage`/`CategoryDrilldownPage`
      (`subscribeToRange`) to `useDataSource()` — same `ownerUid`-threading
      pattern, required to fully retire `lib/spendings.ts`.)

## 5. Clean up

- [x] 5.1 Grep for any remaining imports of `web/src/lib/spendings.ts` or
      `web/src/lib/categories.ts` outside the new `FirestoreDataSource` module
      and tests; update or remove them.
- [x] 5.2 Delete `web/src/lib/spendings.ts` and `web/src/lib/categories.ts`
      once no references remain (logic now lives in `firestoreDataSource.ts`).

## 6. Verify no behavior change

- [x] 6.1 Update any test that imports the old `lib/spendings.ts` /
      `lib/categories.ts` functions directly to go through
      `FirestoreDataSource` instead. (No test imported them directly; nothing
      to update.)
- [x] 6.2 Run `npm run test:rules` and `npm run test:rest` (Firebase emulator
      suites) locally and confirm they pass unchanged. (9/9 and 6/6 pass.)
- [x] 6.3 Run the app locally and manually verify: add a spending, edit a
      spending, delete a spending, add/rename/remove a category, change a
      category color, add/remove a term — all behave as before. Browser
      automation couldn't drive `signInWithPopup` (opens outside the tracked
      tab group), so the app was run against the local emulators
      (`firebase emulators:start --only auth,firestore` +
      `VITE_USE_EMULATORS=true npm run dev`) and the user confirmed the
      click-through by hand: all good.
- [x] 6.4 Run typecheck/build (per CLAUDE.md: install + build/typecheck +
      domain unit tests is what CI runs) and confirm it's green. (`tsc -b`
      + `vite build` clean; 36/36 domain tests pass.)
