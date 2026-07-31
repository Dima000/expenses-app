## Context

`web/src/App.tsx` currently renders exactly one of two screens based on a
`showCategories` boolean: the dashboard, or a full-page `<CategoriesPage>`.
There is no router dependency in `web/package.json`. The app is installed as
a PWA with `display: 'standalone'` (`web/vite.config.ts`), so the installed
app has no browser chrome — the Android system back button/gesture is the
only way to go back, and it acts on browser history. Toggling a boolean
pushes no history entry, so back from Categories currently exits the app.

`firebase.json` already has a SPA catch-all rewrite
(`"source": "**" → "/index.html"`), so any path served by real routing
already resolves correctly on refresh/direct load — no hosting change is
needed to support this.

Auth gating (`loading` / `!user` → `<SignIn>`) happens above the two-screen
switch today and is orthogonal to which of the two post-auth screens is
shown.

## Goals / Non-Goals

**Goals:**
- Replace the `showCategories` boolean with real routes (`/`, `/categories`).
- Fix the PWA back-button bug: navigating dashboard → categories → back
  must return to the dashboard, not exit the app.
- Establish a routing foundation (route structure, URL state convention)
  that a future `/breakdown` screen can slot into without rework.

**Non-Goals:**
- Building the breakdown screen or its query-param state (future change).
- Category colours (future change).
- The caching/listener-reuse discussion (parked separately).
- Changing the auth-gating mechanism (`loading` / `!user` → `<SignIn>` stays
  exactly as it is, just above the routed tree instead of above the boolean
  switch).

## Decisions

**1. Library: `react-router-dom` (`BrowserRouter`), over `HashRouter` or a
lighter alternative (`wouter`).**
`react-router` is the ecosystem-standard choice, so future contributors need
no unfamiliar API. `BrowserRouter` (real paths, no `#`) is viable specifically
*because* the SPA catch-all rewrite already exists — there's no infra reason
to fall back to `HashRouter`'s uglier URLs. A lighter router isn't worth
evaluating for two-to-three routes total; `react-router`'s ~10-15 KB gzip
cost is not meaningful at this app's scale, and using the standard library
now avoids a migration if routing needs (loaders, nested routes) grow later.

**2. Route structure: flat, sibling routes — not nested.**
```
/              → dashboard (today's default view)
/categories    → CategoriesPage
```
Matches the current two-screen shape exactly. A future `/breakdown` route
is a sibling, added the same way — no restructuring of existing routes.

**3. Navigation actions use `navigate(path)`, never `{ replace: true }`, for
dashboard ⇄ categories transitions.**
This is the crux of the back-button fix: a plain `navigate('/categories')`
push a history entry; `replace: true` would silently reproduce today's bug
(no entry to go back to). This is called out explicitly because it's easy
to reach for `replace` out of habit and quietly undo the fix.

**4. Auth gating stays above the routed tree, unchanged — and takes precedence over routing, including the catch-all.**
`App.tsx` keeps its `loading` / `!user` early returns exactly as they are
today; `<BrowserRouter><Routes>...</Routes></BrowserRouter>` only mounts once
`user` exists. There is no `/login` route — an unauthenticated visitor sees
`<SignIn>` at whatever path they requested (the URL is left as-is, not
redirected to `/` or anywhere else), and only after sign-in does the router
take over and render whatever that path resolves to. This means the auth
gate and the routing layer are two independent checks that do not compose:
the auth gate is evaluated first and short-circuits routing entirely, so an
unauthenticated hit on a garbage path shows sign-in — the `path="*"` → `/`
catch-all (Decision 5) never runs for a signed-out visitor, only for a
signed-in one. A `/login` route was deliberately not introduced: this is a
single-owner app with one auth method and no page that links to a login
screen, so there is no "redirect back to the originally-requested page
after sign-in" flow to justify — building one would be scope creep with no
current benefit.

**5. Unknown paths redirect to `/`, for signed-in visitors only.**
A catch-all route (`path="*"`) redirects to `/`. Cheap, and avoids a blank
screen if a stale/bad URL is ever hit (e.g. a future route that gets removed
later). Small addition beyond the letter of the proposal, but standard
practice for any router setup and low-risk enough not to warrant its own
change. As noted in Decision 4, this only applies once `user` exists — it
sits inside the routed tree, after the auth gate.

**6. Query-param convention documented, not implemented.**
No screen in this change carries view state in the URL. The convention
(`useSearchParams()` for view/filter state like a future breakdown screen's
`?unit=month&anchor=2026-07`, not path segments) is recorded in the
`app-navigation` spec so the next screen follows it rather than
reinventing it.

## Risks / Trade-offs

- **[Risk] Bundle size increases by ~10-15 KB gzip.** → Mitigation: none
  needed — negligible at this app's scale (10 users), and it's the standard
  library rather than a bespoke smaller one, trading a few KB for zero
  future migration risk.
- **[Risk] A future PR reaches for `replace: true` on a dashboard ⇄
  categories transition (e.g. "cleaner" history), silently reintroducing
  the back-button bug.** → Mitigation: Decision 3 is called out explicitly
  here and should be called out again in code comments at the navigation
  call sites.
- **[Risk] PWA back-gesture behavior can't be verified in CI** (no
  standalone-mode/Android back-gesture simulation in the test suite).
  → Mitigation: manual verification step in tasks.md (install as PWA or use
  Chrome's "standalone" DevTools emulation, confirm back navigates
  dashboard ⇄ categories instead of exiting).

## Migration Plan

1. Add `react-router-dom` to `web/package.json`.
2. Wrap the post-auth render tree in `App.tsx` with `<BrowserRouter>` /
   `<Routes>`, defining `/`, `/categories`, and a catch-all `*` → `/`
   redirect.
3. Replace `showCategories` state and its setters with `useNavigate()` calls
   at the two call sites (the "Manage categories" button, `CategoriesPage`'s
   close action).
4. Remove the now-dead `showCategories` state and the `App.tsx` comment
   describing the old boolean-switch approach.
5. Manually verify: navigate dashboard → categories → system back (or
   browser back) → lands on dashboard, not outside the app.
6. No rollback complexity — this is a pure client-side navigation change
   with no data migration; reverting the commit fully reverts behavior.

## Open Questions

- None outstanding — the one open item from the originating exploration doc
  (nested-route vs. router-library choice) is resolved by Decision 1/2
  above.
