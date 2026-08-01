## 1. Branch

- [x] 1.1 Create branch `feat/demo-routing` off `main`

## 2. Path helpers (pure, unit-tested)

- [x] 2.1 Add `web/src/lib/demoRoutes.ts` exporting `DEMO_BASE`, `isDemoPath(pathname)`, and `withBase(base, path)` per design Decision 2
- [x] 2.2 Add `web/src/lib/demoRoutes.test.ts`: `isDemoPath` returns true for `/demo` and `/demo/reports/x`, false for `/`, `/reports`, and the `/democracy` lookalike
- [x] 2.3 Extend the suite for `withBase`: root base passes paths through unchanged, demo base prefixes them, and `withBase(DEMO_BASE, '/')` yields `/demo` (no trailing slash)
- [x] 2.4 `npm run test:web` passes

## 3. Demo banner

- [x] 3.1 Add `web/src/components/DemoBanner.tsx`: persistent bar reading "**Demo mode** — sample data, nothing is saved" with an "Exit demo" button
- [x] 3.2 Wire the button to `useNavigate()` → `'/'`; give it an accessible label and match the existing shadcn/Tailwind styling used elsewhere

## 4. Router restructure in `App.tsx`

- [x] 4.1 Split `App` into a thin `App` that renders `<BrowserRouter><AppShell/></BrowserRouter>`, moving today's body into `AppShell`
- [x] 4.2 Add `useIsDemo()` in `AppShell` built on `useLocation()` + `isDemoPath`
- [x] 4.3 Replace the single `FirestoreDataSource` memo with the two-memo split from design Decision 5 (`demoSource` keyed on `[isDemo]` only; `firestoreSource` gated on `!isDemo`)
- [x] 4.4 Gate both early returns on `!isDemo` so the demo renders without waiting on auth
- [x] 4.5 Extract the route tree into `appRoutes(base)` returning a fragment with an `index` route, relative child paths, and a per-base `*` catch-all redirecting to `withBase(base, '/')`
- [x] 4.6 Mount it inside `<Routes>` at `path={DEMO_BASE}` and `path="/"`, demo first
- [x] 4.7 Thread `base` into `Dashboard`, `CategoriesRoute`, `ReportsRoute`, `CategoryDrilldownRoute` and wrap all six `navigate(...)` targets in `withBase(base, …)`
- [x] 4.8 Confirm both `setSearchParams({ unit, anchor })` call sites are left untouched
- [x] 4.9 Render `<DemoBanner/>` above `<Routes>` when `isDemo`, and pass `isDemo` to `Dashboard` so the header sign-out button is omitted in demo
- [x] 4.10 `npm run build:web` typechecks clean

## 5. Manual verification — demo (no automated router coverage; design Decision 8)

- [x] 5.1 Signed out, `/demo` renders the dashboard with seeded demo data and no sign-in screen
- [x] 5.2 Deep links `/demo/categories`, `/demo/reports`, `/demo/reports/<categoryId>` each render their screen directly on load
- [x] 5.3 In-app navigation (dashboard → Reports → drilldown → back) keeps every URL under `/demo`
- [x] 5.4 Changing the Reports period rewrites `unit`/`anchor` and stays under `/demo`
- [x] 5.5 Adding, editing, and deleting a spending and mutating a category all work in the demo; DevTools shows no Firestore network requests and no new IndexedDB/localStorage entries
- [x] 5.6 Reloading `/demo/reports` stays in demo; a spending added before the reload is gone (re-seeded)
- [x] 5.7 The banner is visible on all four demo screens and the header sign-out icon is absent
- [x] 5.8 "Exit demo" navigates to `/` and, signed out, shows the sign-in screen
- [x] 5.9 `/demo/nope` redirects to `/demo`, not `/`
- [x] 5.10 `/democracy` is not treated as a demo path (falls through to the auth gate / root catch-all)

## 6. Manual verification — signed-in regression

- [x] 6.1 Signed in, `/`, `/categories`, `/reports`, `/reports/:categoryId` all behave exactly as before, including back navigation and the header sign-out
- [x] 6.2 `/nope` still redirects to `/`
- [x] 6.3 Signed out, loading `/categories` shows sign-in without a URL redirect, and signing in resolves to `/categories`
- [x] 6.4 Signed in, opening `/demo` shows the demo (not real data), the session stays signed in, and "Exit demo" lands on the real dashboard with real data and no re-auth
- [x] 6.5 While a demo edit is pending and auth resolves in the background, the edit is not wiped (verifies the two-memo split) — confirmed by the owner via the two-tab test (sign out in a second tab while the demo tab holds an unsaved edit)

## 7. Ship

- [x] 7.1 Update `docs/explorations/2026-08-01-demo-mode-and-dev-sandbox.md` status to note Part 3 shipped
- [x] 7.2 Committed, pushed, PR #29 opened — all CI checks green. **Merge left to the user** (two signed-out verification items still open).
