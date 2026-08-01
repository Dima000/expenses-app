# Demo mode: shareable link + dev sandbox + marketing screenshots

- **Date:** 2026-08-01
- **Status:** Exploration — direction settled in conversation, not yet split into change proposals
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

## App modes

```
              ┌───────────────┐
   loading ──▶│  signed-out   │──── click "Try the demo" ───────┐
              └───────┬───────┘                                 │
                      │                                          ▼
              Google sign-in                              ┌────────────┐
                      │                                    │    demo    │
                      ▼                                    └─────┬──────┘
              ┌───────────────┐                                  │
              │    authed     │◀──── "Exit Demo" (banner) ───────┘
              └───────────────┘
```

- `authed` → `FirestoreDataSource(user.uid)`
- `demo` → `DemoDataSource()` (in-memory, never touches Firestore or its
  IndexedDB persistence cache — must stay fully isolated from real data)

## Entry points

- **`/demo` route** — clean shareable URL for a README/portfolio link. On
  activation, normalize the URL back to `/` immediately, so a refresh never
  silently re-enters or re-exits demo based on stale query state, and exiting
  lands on a plain sign-in URL.
- **"Try the demo" link on the sign-in screen**, secondary to "Continue with
  Google".
- **Already-authenticated user hits `/demo`:** never silently redirect either
  way (redirecting straight to their dashboard makes the link look broken to
  anyone with an account, including a friend who signed up for real and later
  wants to show someone else the demo). Show an interstitial: *"You're signed
  in — log out and view the demo, or back to your dashboard?"* with both
  choices explicit.

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

Originally proposed localStorage/IndexedDB, but the actual requirement
("refresh logs you out of demo") argues for plain in-memory state instead —
survives SPA navigation between `/`, `/categories`, `/reports` (no remount),
gone on hard refresh, no storage cleanup to ever worry about.

## Seed data

- **Deterministic**, not randomized per session — reproducible for the dev
  sandbox and marketing screenshots, predictable to reason about. Dates are
  computed relative to "today" at demo-start (not hardcoded absolute dates),
  so `today` / `this month` filters always resolve correctly and the dataset
  never goes stale.
- **Range:** 3–4 months of history in the current year + 2–3 months in the
  prior year.
- **Volume:** ~30 transactions/month.
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

3. **New feature — mode state machine + demo wiring.**
   `signed-out / demo / authed` app state, `/demo` route (normalizes to `/`),
   demo banner with the "Exit Demo" control, and the already-authenticated
   interstitial modal. This is where `DemoDataSource` actually becomes
   reachable by a user.

4. **Enhancement — sign-in entry point + polish.**
   "Try the demo" link on the sign-in screen, banner/modal copy, aria-labels.
   Also where dev-sandbox and marketing-screenshot usage get validated
   end-to-end, since they're free consequences of Parts 2–3 rather than
   separate scope.

## Open questions for whoever writes the change proposals

- Exact banner/modal copy.
- Whether the seed generator runs fresh (same PRNG seed) on every `/demo`
  visit, or is a literal committed fixture object — both are "deterministic"
  but have different maintenance tradeoffs; worth deciding in Part 2's design.
