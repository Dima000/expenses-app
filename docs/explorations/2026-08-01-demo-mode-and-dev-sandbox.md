# Demo mode: shareable link + dev sandbox + marketing screenshots

- **Date:** 2026-08-01
- **Status:** Parts 1–3 shipped (`adopt-data-source-interface` #27,
  `add-demo-data-source` #28, `add-demo-routing`). Part 4 re-explored 2026-08-02
  and simplified — see "App modes" and "Proposed stack" below for the settled
  design. Part 3's three open questions were resolved in its design.md: banner
  copy is "Demo mode — sample data, nothing is saved"; the shared route tree is
  a function returning a JSX fragment; internal links use an explicit
  `withBase()` prefix helper.
- **Trigger:** friends without an account (or any data) can't explore the app. Want
  a "try it" path off the sign-in screen, seeded with fake data, that also turns
  out to double as a local dev sandbox and a source of clean marketing screenshots.
- **Audience:** friends with no account, local dev workflow, marketing/README assets.

> This is a thinking document, not a proposal. Nothing here is committed to.
> If a direction is chosen, it graduates into an OpenSpec change under
> `openspec/changes/`.

---

## The problem, restated

Three different needs turned out to be the same feature:

```
  "let a friend explore without      "speed up local dev without      "clean screenshots
   signing up"                        booting the emulator"             for README/store"
              \                              |                              /
               \                             |                             /
                \____________________________|____________________________/
                                             |
                                   ONE deterministic,
                                   in-memory demo dataset
                                   behind a /demo entry point
```

No separate engineering for the dev-sandbox and screenshot use cases — they fall
out of `/demo` existing and being reachable without auth.

## Architecture: `DataSource` interface, not a branch-in-`lib/` shortcut

Today `SpendingForm` and `CategoriesPage` statically `import { createSpending,
addCategory, ... } from '@/lib/spendings' / '@/lib/categories'`. The cheapest
fork would be making those functions branch internally on a sentinel `ownerUid`.
Rejected in favor of a real interface — better testability, and a cleaner seam
if a third mode ever shows up:

```ts
interface DataSource {
  subscribeToMonth(month: string, onData: (s: Spending[]) => void): Unsubscribe;
  subscribeToCategories(onData: (c: Category[]) => void): Unsubscribe;
  createSpending(input: SpendingInput, source: SpendingSource): Promise<string>;
  updateSpending(id: string, input: SpendingInput): Promise<void>;
  deleteSpending(id: string): Promise<void>;
  addCategory(name: string): Promise<void>;
  renameCategory(id: string, name: string): Promise<void>;
  removeCategory(id: string): Promise<void>;
  setCategoryColor(id: string, colorId: string): Promise<void>;
  addTerm(id: string, term: string): Promise<void>;
  removeTerm(id: string, term: string): Promise<void>;
}
```

`ownerUid` drops out of the interface — it becomes a construction detail
(`FirestoreDataSource(ownerUid)` vs `DemoDataSource()`), not something threaded
through every call site.

**Real cost, accepted deliberately:** `SpendingForm`, `CategoriesPage`, and the
subscriptions in `App.tsx` can no longer import Firestore functions by name —
they need the active `DataSource` via context (`useDataSource()`). This is a
wider call-site footprint than the shortcut, taken on purpose for testability
and the stacked-PR structure below (Part 1 is exactly this refactor, landed
before any demo behavior exists).

`FirestoreDataSource` is today's `lib/spendings.ts` + `lib/categories.ts`
bodies, unchanged, wrapped behind the interface. `DemoDataSource` holds an
in-memory array + listener set, firing listeners via microtask on mutation to
match Firestore's async snapshot timing (so the two implementations don't
develop different assumptions and mask timing bugs).

## App modes: demo is a data-source override, not an auth state

An earlier draft of this doc modelled a 3-valued `signed-out | demo | authed`
state machine. That conflates two independent things and forces every question
into a 2×2 matrix with one very awkward cell (authed user + demo link), which
is where an interstitial modal, a log-out→demo transition, and an auth-loading
race all had to be invented. Since `DataSource` is an interface, *which
implementation is provided* has nothing to do with auth. Two orthogonal axes:

```
authState : 'loading' | 'signed-out' | 'authed'   ← owned by useAuth, untouched
isDemo    : boolean                                ← owned by the URL

dataSource = isDemo ? DemoDataSource()
                    : (authed ? FirestoreDataSource(user.uid) : none)
```

`DemoDataSource` is in-memory and never touches Firestore or its IndexedDB
persistence cache — it imports only `@expenses/shared`, `demoSeedData`, `date`,
and `dataSource`, so no Firestore path exists. `FirestoreDataSource` is simply
never constructed while demoing.

**`isDemo` wins unconditionally, including for signed-in users.** An
authenticated visitor who opens a demo link sees the demo, with the banner, and
"Exit Demo" returns them straight to their real dashboard — no logout, no
re-login, no modal. This is the strongest available fix for the original
concern ("redirecting straight to their dashboard makes the link look broken to
anyone with an account"): the link now behaves identically for everyone,
including a friend who signed up for real and later wants to show someone else.
It also means demo rendering never waits on Firebase auth resolution.

## Entry points

- **`/demo` route** — clean shareable URL for a README/portfolio link. The URL
  is *not* normalized away; demo-ness is read continuously from the URL rather
  than consumed once, which is what removes the need for any imperative
  "activate demo" step.
- **"Try the demo" link on the sign-in screen**, secondary to "Continue with
  Google". It's an ordinary link to `/demo` — same code path, no separate entry
  mechanism.

## Routing: path prefix over query param

Demo-ness lives in the **path** (`/demo/*`), not a `?demo=1` query param. Both
persist across navigation, but the path is immune to something the param isn't:
`ReportsRoute` / `CategoryDrilldownRoute` call `setSearchParams({unit, anchor})`,
and React Router's setter *replaces the whole query string* — a param-based
design would silently drop demo mid-browse on any period switch, and would
leave a permanent footgun for anyone later reaching for plain `useSearchParams`.

|                              | `?demo=1`                    | `/demo/*`   |
| ---------------------------- | ---------------------------- | ----------- |
| Hook wraps `navigate`        | yes                          | yes (prefix)|
| Hook wraps `setSearchParams` | **yes**                      | **no**      |
| Existing `unit`/`anchor` code| must be modified             | **untouched**|
| Latent footgun               | raw `setSearchParams` drops it | none      |

The route tree is defined once and mounted at two bases — not duplicated:

```tsx
const appRoutes = () => (<>
  <Route index element={<Dashboard/>}/>
  <Route path="categories" element={<CategoriesRoute/>}/>
  <Route path="reports" element={<ReportsRoute/>}/>
  <Route path="reports/:categoryId" element={<CategoryDrilldownRoute/>}/>
</>);

<Routes>
  <Route path="/demo">{appRoutes()}</Route>
  <Route path="/">{appRoutes()}</Route>
</Routes>
```

`BrowserRouter` mounts unconditionally (today it only wraps the authed branch),
so `isDemo` can be derived inside it. The signed-out gate then collapses to a
single short-circuit above `<Routes>`:

```tsx
if (!isDemo && authState === 'signed-out') return <SignIn />;
```

One line, no per-route guard component. New routes are protected automatically,
behaviour matches today (signed-out sees `SignIn` regardless of path), and the
attempted URL survives sign-in instead of being redirected away.

## Exit UX

Banner is the only exit control — no reuse of the header logout icon, so
"leaving demo" and "signing out of a real session" never look like the same
action:

```
┌────────────────────────────────────┐
│ ▌ Demo mode — nothing is saved      │
│ ▌                    [ Exit Demo ]  │  ← only exit control
├────────────────────────────────────┤
│ Expenses          📊 🏷️            │  ← no logout icon in demo
└────────────────────────────────────┘
```

Exit is a pure client-side state transition (`mode → signed-out`, navigate to
`/`) — no reload needed, nothing to flush since nothing persisted.

## Persistence: none, on purpose

No localStorage/IndexedDB — demo data is plain in-memory state, so there is no
storage cleanup to ever worry about and no way for demo rows to outlive the tab.

Note the two things that were originally coupled and are now decoupled:

- **Demo *mode* survives a hard refresh** — it's in the URL, so reloading
  `/demo/reports` stays in the demo. (Earlier drafts had refresh eject you;
  that requirement was dropped deliberately.)
- **Demo *edits* do not survive a refresh** — a full remount re-derives
  `isDemo` and constructs a fresh `DemoDataSource`, re-seeded from scratch.

So a visitor who adds a spending and then reloads keeps the demo but loses that
row. Accepted: the existing "Demo mode — nothing is saved" banner copy covers
it; no separate refresh warning.

Exiting demo is a navigation out of the `/demo` subtree, nothing more — mode
re-derives on its own, and there's no state to flush since nothing persisted.

## Seed data

- **Deterministic**, not randomized per session — reproducible for the dev
  sandbox and marketing screenshots, predictable to reason about. Dates are
  computed relative to "today" at demo-start (not hardcoded absolute dates),
  so `today` / `this month` filters always resolve correctly and the dataset
  never goes stale.
- **Range:** the whole of the prior calendar year plus the current year up to
  and including "today", so both Reports year-views are populated.
- **Placement:** each category declares its own cadence — a weekly rhythm
  (`groceries`, `relationships`) or a set of days-of-month (bills, one-offs) —
  and generation walks every date in the window asking each category whether it
  fires. Volume is emergent at ~35 transactions in a fully covered month; the
  current month holds only what the cadences produced for the elapsed days, so
  it is proportional rather than a full month compressed onto them.
- **Density:** `groceries` and `relationships` land on 9+ distinct days a month
  so the category-drilldown heatmap is populated, while `health` and `pet` stay
  at one day a month so drilldowns differ from one another.
- Mix includes: some uncategorized entries (exercises the Uncategorized
  filter), some `needsReview` entries, and some dated today (exercises the
  Today/Yesterday filters). Categories spread across the set for Reports/
  trend-chart variety.
- **One dataset serves all three use cases** — friends-demo, dev sandbox,
  marketing screenshots. No separate "pretty" profile; realistic messiness is
  fine to show off.

## Proposed stack (each a separate PR, branched off the previous)

1. **Refactor — `DataSource` interface, no behavior change.**
   Introduce the interface, `FirestoreDataSource` wrapping today's
   `lib/spendings.ts` / `lib/categories.ts` bodies, and switch `SpendingForm`,
   `CategoriesPage`, and `App.tsx`'s subscriptions to consume it via context
   instead of static imports. Existing emulator/unit tests should catch any
   regression; behavior is identical to today.

2. **New feature — `DemoDataSource` + seed data generator.**
   In-memory store + listener-based subscriptions conforming to the same
   interface, plus the deterministic, date-relative seed dataset described
   above. Purely additive; not yet wired into the running app, so it's
   testable in isolation (and can share contract tests with
   `FirestoreDataSource` since both implement the same interface).

3. **New feature — `/demo` routing + demo wiring.**
   Mount `BrowserRouter` unconditionally, mount the shared route tree at both
   `/` and `/demo`, derive `isDemo` from the URL, select the `DataSource`
   accordingly, and add the demo banner with its "Exit Demo" control. This is
   where `DemoDataSource` actually becomes reachable by a user.

   Surface area, after simplification:

   ```
   useIsDemo()      — 1 line, reads the URL (no context/provider needed)
   nav base helper  — ~3 lines, prefixes internal links with the current base
   DemoBanner       — the only exit control; header sign-out hidden in demo
   useMemo(() => isDemo ? new DemoDataSource() : null, [isDemo])
   short-circuit    — if (!isDemo && signed-out) return <SignIn/>
   ```

   Explicitly *not* built, versus earlier drafts: no interstitial modal, no
   log-out→demo transition, no auth-loading race handling, no `RequireSession`
   guard, no mode-context provider, no `setSearchParams` wrapper.

4. **Enhancement — sign-in entry point + polish.**
   "Try the demo" link on the sign-in screen, banner copy, aria-labels.
   Also where dev-sandbox and marketing-screenshot usage get validated
   end-to-end, since they're free consequences of Parts 2–3 rather than
   separate scope.

## Open questions for whoever writes the change proposals

- Exact banner copy (working text: "Demo mode — nothing is saved").
- Whether the shared route tree is reused via a function returning a JSX
  fragment (as sketched) or a plain route-config array — cosmetic, decide in
  Part 3's design.
- Whether internal links use an explicit base-prefix helper (recommended:
  explicit and debuggable) or React Router relative navigation (`navigate('reports')`,
  zero helper but subtler semantics — relative to route match, not path).
