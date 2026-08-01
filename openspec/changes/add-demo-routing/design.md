## Context

Parts 1–2 of the demo-mode exploration have shipped: `DataSource` is an
interface consumed via `useDataSource()` (#27), and `DemoDataSource` is a fully
tested in-memory implementation seeded with deterministic, date-relative data
(#28). Neither is reachable from the running app — `App.tsx` still constructs
`FirestoreDataSource` unconditionally for the signed-in owner.

Current shape of `web/src/App.tsx`:

- `useAuth()` gives `{ user, loading, signIn, logOut }`.
- `App` holds all app state (month, spendings, categories, filters, form state),
  memoizes `new FirestoreDataSource(user.uid)` on `[user]`, and runs the two
  subscription effects.
- Two early returns: `loading → "Loading…"`, `!user → <SignIn/>`.
- Only then does it render `<DataSourceProvider><BrowserRouter><Routes>` with
  four flat routes plus a `*` catch-all redirecting to `/`.
- All six `navigate(...)` calls and both `setSearchParams(...)` calls live in
  `App.tsx`; no other file navigates.

Constraints:

- **Vitest runs in the `node` environment** (`web/vitest.config.ts`), with no
  jsdom and no React Testing Library. Anything that needs a DOM or a rendered
  router cannot be unit-tested without adding dependencies and slowing CI, which
  the project's CI guidance explicitly resists.
- `firebase.json` already rewrites `**` → `/index.html`, so `/demo/*` deep links
  are served without hosting changes.

## Goals / Non-Goals

**Goals:**

- `/demo` and its subtree render the app against `DemoDataSource`, with no
  account and no Firestore access.
- Demo-ness is a pure function of the URL, re-derived every render — no state
  that can disagree with the URL.
- The route tree is declared once and mounted at both bases.
- Existing signed-in behavior is byte-for-byte unchanged outside the demo.
- Keep the new surface area small enough to hold in one's head: a path-helper
  module, a banner component, and a router restructure inside `App.tsx`.

**Non-Goals:**

- The "Try the demo" link on the sign-in screen (Part 4).
- Any persistence of demo data or demo mode beyond the URL.
- Adding jsdom / React Testing Library to make the router testable.
- Any change to `DataSource`, `DemoDataSource`, `FirestoreDataSource`,
  `demoSeedData`, `useAuth`, or any screen component.

## Decisions

### 1. Demo-ness lives in the path (`/demo/*`), not a query param

Settled in the exploration and carried here unchanged. Both survive navigation,
but `ReportsRoute` and `CategoryDrilldownRoute` call
`setSearchParams({ unit, anchor })`, and React Router's setter **replaces the
whole query string**. A `?demo=1` design would silently drop demo on any period
switch, and would leave a permanent footgun for anyone later reaching for plain
`useSearchParams`. With a path prefix, both `setSearchParams` call sites stay
untouched.

*Alternative considered:* `?demo=1` plus a `setSearchParams` wrapper. Rejected —
it adds a wrapper that must be remembered forever, to solve a problem the path
prefix doesn't have.

### 2. `useIsDemo()` reads the URL; there is no demo context or provider

```ts
// web/src/lib/demoRoutes.ts
export const DEMO_BASE = '/demo';

/** True for `/demo` and `/demo/...`, false for lookalikes such as `/democracy`. */
export function isDemoPath(pathname: string): boolean {
  return pathname === DEMO_BASE || pathname.startsWith(`${DEMO_BASE}/`);
}

/** Prefix an app-relative path (`/reports?unit=month`) with the active base. */
export function withBase(base: string, path: string): string {
  return base === '/' ? path : `${base}${path === '/' ? '' : path}`;
}
```

```ts
// in App.tsx
function useIsDemo(): boolean {
  return isDemoPath(useLocation().pathname);
}
```

The exact-match arm is what stops `/democracy` from being a demo path, and the
`path === '/'` arm is what makes `withBase('/demo', '/')` produce `/demo`
rather than `/demo/`.

Both helpers are pure string functions, so they are unit-testable in the
existing `node` vitest environment — which is the main reason for extracting
them into a module instead of inlining them in `App.tsx`.

*Alternative considered:* a `DemoModeProvider` context. Rejected — the URL is
already global, reactive, and shared; a context around it is a second copy of
the same fact that can drift.

### 3. The route tree is a function returning a fragment, mounted twice

```tsx
const appRoutes = (base: string) => (
  <>
    <Route index element={<Dashboard base={base} … />} />
    <Route path="categories" element={<CategoriesRoute base={base} … />} />
    <Route path="reports" element={<ReportsRoute base={base} … />} />
    <Route path="reports/:categoryId" element={<CategoryDrilldownRoute base={base} … />} />
    <Route path="*" element={<Navigate to={withBase(base, '/')} replace />} />
  </>
);

<Routes>
  <Route path={DEMO_BASE}>{appRoutes(DEMO_BASE)}</Route>
  <Route path="/">{appRoutes('/')}</Route>
</Routes>
```

A parent `<Route>` with no `element` renders its matched child directly, so no
layout component is needed. Child paths become relative (`categories`, not
`/categories`) and the flat routes become an `index` route plus siblings — a
mechanical restructure with no behavior change at the `/` base.

The per-base `*` catch-all is what makes an unknown `/demo/nope` land on
`/demo` instead of `/`, satisfying the modified `app-navigation` requirement.
Because React Router ranks `/demo` above `/` for demo paths, the demo tree's
catch-all wins there and the root tree's wins everywhere else.

*Alternative considered:* a plain route-config array plus `useRoutes`. Cosmetic
difference; the fragment form is a smaller diff from today's JSX `<Routes>` and
keeps the whole tree readable in one place.

### 4. Navigation uses an explicit `withBase` helper, not relative navigation

Every `navigate('/x')` becomes `navigate(withBase(base, '/x'))`, with `base`
threaded to the four route components as a prop.

*Alternative considered:* React Router relative navigation (`navigate('reports')`
with no helper). Rejected as recommended in the exploration: relative navigation
resolves against the *route match*, not the URL path, which is subtle enough to
produce surprising results when a route is nested or an `index` route is
involved. The helper is one pure function, explicit at every call site, and
debuggable by reading the string.

### 5. Data source selection: two separate memos, so the demo instance is stable

```ts
const isDemo = useIsDemo();

// Depends on `isDemo` only — auth resolving mid-demo must NOT rebuild this,
// or the visitor's in-demo edits would silently vanish.
const demoSource = React.useMemo(
  () => (isDemo ? new DemoDataSource() : null),
  [isDemo],
);

// Never constructed while demoing.
const firestoreSource = React.useMemo(
  () => (!isDemo && user ? new FirestoreDataSource(user.uid) : null),
  [isDemo, user],
);

const dataSource = isDemo ? demoSource : firestoreSource;
```

The two-memo split is load-bearing. A single
`useMemo(..., [isDemo, user])` would rebuild the `DemoDataSource` the moment
Firebase auth resolved from `null` to a `User` — re-seeding the demo and
discarding anything the visitor had added seconds earlier. Splitting the memos
makes the demo instance depend on nothing but the URL.

`FirestoreDataSource` is gated on `!isDemo` so it is genuinely never constructed
in demo mode, matching the demo-mode spec rather than merely not being used.

### 6. `BrowserRouter` mounts unconditionally; the auth gate becomes one line

The router moves above the gates so the URL is readable before deciding what to
render. `App` becomes a thin wrapper and today's body moves into an inner
`AppShell` rendered inside the router:

```tsx
export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
```

Inside `AppShell`, the two early returns become:

```tsx
if (!isDemo && loading) return <Loading />;
if (!isDemo && (!user || !dataSource)) return <SignIn onSignIn={signIn} />;
```

Both are gated on `!isDemo`, which is what makes the demo render without
waiting on auth. No `RequireSession` component and no per-route guard: new
routes are protected automatically, and the requested URL survives sign-in
exactly as it does today.

*Alternative considered:* a 3-valued `signed-out | demo | authed` mode machine
(an earlier draft of the exploration). Rejected there and not revisited: it
conflates two independent axes and forces an interstitial modal, a
log-out→demo transition, and an auth-loading race into existence.

### 7. `DemoBanner` renders above `<Routes>`; sign-out is hidden in demo

The banner must appear on every demo screen, so it renders once in `AppShell`
above `<Routes>` rather than inside each screen. Copy — resolving the
exploration's open question:

> **Demo mode** — sample data, nothing is saved. `[ Exit demo ]`

The button navigates to `/` (`useNavigate()`), which drops out of the demo
subtree; demo mode then ends because `useIsDemo()` re-derives it. No state to
reset, nothing to flush.

`Dashboard` takes an `isDemo` prop (it already receives props from `AppShell`)
and omits the sign-out `<Button>` when true, so the banner's exit control is the
only way out and the two actions never look alike.

### 8. Testing: pure helpers get unit tests; the wiring is verified manually

`demoRoutes.ts` gets a vitest suite covering `isDemoPath` (exact match, subtree,
`/democracy` lookalike, root and non-demo paths) and `withBase` (root base
passthrough, demo prefixing, the `'/'` special case).

Router behavior, banner rendering, and data source selection are **not**
automatically tested — the `node` vitest environment has no DOM, and adding
jsdom + React Testing Library for this change would contradict the project's
"keep CI lean and fast" guidance for a component layer that has no automated
coverage today either. Those are verified by a manual checklist in `tasks.md`
(deep links, refresh, signed-in visitor, exit, period switching), which is also
where the dev-sandbox and screenshot use cases get exercised for free.

## Risks / Trade-offs

- **Router behavior has no automated coverage** → the manual checklist in
  `tasks.md` is explicit and short, and the pieces most likely to be subtly
  wrong (path matching, base prefixing) are the ones extracted into pure,
  unit-tested functions.
- **The `base` prop must be threaded to every route component, and a future
  screen could forget it and escape the demo** → all navigation lives in
  `App.tsx` today and stays there; `withBase` at every call site makes an
  omission visible in review as a bare `'/…'` literal.
- **Restructuring flat routes into nested ones could change matching at `/`** →
  the transformation is mechanical (absolute child paths become relative, the
  `/` route becomes `index`); the manual checklist re-walks every existing route
  signed in to confirm no regression.
- **A signed-in owner might not realize `/demo` is showing fake data** → the
  banner is persistent, on every screen, and says "sample data, nothing is
  saved"; exit returns them to their real dashboard in one click with no
  logout.
- **Demo edits vanish on refresh** → accepted deliberately (exploration); the
  banner copy covers it and no separate refresh warning is added.
- **`/demo` is publicly reachable with no auth** → no exposure: `DemoDataSource`
  is in-memory, imports no Firestore module, and Firestore rules are untouched.

## Open Questions

None blocking. The exploration's three open questions are resolved above:
banner copy (Decision 7), route-tree form — fragment function (Decision 3), and
explicit base helper over relative navigation (Decision 4).
