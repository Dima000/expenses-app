## Why

`DemoDataSource` exists and is fully tested (#28) but nothing in the running app
can reach it — there is no user-facing demo. Friends without an account still
can't explore the app, local dev still needs the Firestore emulator, and there's
no clean source of marketing screenshots. This change makes the demo reachable
at a shareable `/demo` URL, which is the single piece of wiring that unlocks all
three use cases at once.

## What Changes

- **New `/demo` route subtree.** The existing route tree (dashboard, categories,
  reports, category drilldown) is defined once and mounted at two bases: `/` and
  `/demo`. `/demo/reports` renders the same Reports screen as `/reports`.
- **Demo-ness is derived from the URL, continuously** — not an imperative
  "activate demo" step, not a query param, not an auth state. A `useIsDemo()`
  hook reads the current pathname.
- **Data source selection keys off the URL.** Under `/demo/*` the app provides a
  `DemoDataSource`; elsewhere it provides `FirestoreDataSource(user.uid)` as
  today. `FirestoreDataSource` is never constructed while demoing.
- **`isDemo` wins unconditionally, including for signed-in users.** A demo link
  behaves identically for everyone; demo rendering never waits on Firebase auth
  resolution.
- **`BrowserRouter` mounts unconditionally.** Today it only wraps the
  authenticated branch. The signed-out gate collapses to a single short-circuit
  above `<Routes>`: `if (!isDemo && authState === 'signed-out') return <SignIn/>`.
- **Demo banner with "Exit demo".** The banner is the only exit control; the
  header's sign-out icon is hidden in demo so "leaving demo" and "signing out of
  a real session" never look like the same action. Exit navigates to `/`.
- **Internal navigation is base-aware.** The six `navigate('/…')` call sites in
  `App.tsx` route through an explicit base-prefix helper so demo-ness survives
  navigation. `setSearchParams` call sites are deliberately left untouched —
  that's the reason for choosing a path prefix over `?demo=1`.
- **No persistence.** Demo state is in-memory only. Demo *mode* survives a hard
  refresh (it's in the URL); demo *edits* do not (a remount re-seeds).

Explicitly **not** in scope (Part 4 of the exploration): the "Try the demo" link
on the sign-in screen. Until then `/demo` is reachable by URL only.

Explicitly not built, versus earlier drafts of the exploration: no interstitial
modal, no log-out→demo transition, no auth-loading race handling, no
`RequireSession` guard, no mode-context provider, no `setSearchParams` wrapper.

## Capabilities

### New Capabilities
- `demo-mode`: the user-facing demo — the `/demo` entry point, URL-derived demo
  state, demo-vs-Firestore data source selection, precedence over auth, the
  banner and its exit control, and the no-persistence guarantee.

### Modified Capabilities
- `app-navigation`: routing structure changes. The route tree is now mounted at
  two bases; the auth gate no longer wraps the router (it becomes a
  short-circuit that demo bypasses); the unknown-path catch-all must resolve
  within the active base rather than always to `/`.

## Impact

- **Code:** `web/src/App.tsx` (router restructure, data source selection, route
  tree extracted for dual mounting, nav call sites), plus new
  `web/src/lib/demoRoutes.ts` (pure path helpers) and
  `web/src/components/DemoBanner.tsx`.
- **Unchanged:** `DataSource` interface, `DemoDataSource`, `FirestoreDataSource`,
  `demoSeedData`, `useAuth`, and every screen component
  (`ReportsPage`, `CategoriesPage`, `CategoryDrilldownPage`, `SpendingForm`, …)
  — they already consume the active data source via `useDataSource()` and take
  navigation as callbacks.
- **Tests:** new vitest unit tests for the pure path helpers. The vitest
  environment is `node` with no DOM, so router/component rendering is verified
  manually rather than by automated test; `npm run test:web` stays fast and CI
  stays lean.
- **Hosting:** none. The existing `**` → `/index.html` rewrite in
  `firebase.json` already serves `/demo/*`.
- **Security:** no new data exposure — `DemoDataSource` is in-memory and never
  touches Firestore, so an unauthenticated visitor at `/demo` reads nothing from
  the backend and Firestore rules are unaffected.
