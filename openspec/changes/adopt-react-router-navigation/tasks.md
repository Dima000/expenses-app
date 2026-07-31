## 1. Dependency

- [x] 1.1 Add `react-router-dom` to `web/package.json` and install.

## 2. Routing foundation

- [x] 2.1 Wrap the post-auth render tree in `web/src/App.tsx` with
      `<BrowserRouter>`, keeping the existing `loading` / `!user` early
      returns above it, unchanged.
- [x] 2.2 Define routes: `/` → dashboard content, `/categories` →
      `CategoriesPage`, and a catch-all `path="*"` that redirects to `/`.

## 3. Replace the boolean switch

- [x] 3.1 Remove the `showCategories` state and its conditional render in
      `web/src/App.tsx`.
- [x] 3.2 Wire the "Manage categories" button to `navigate('/categories')`
      (via `useNavigate()`), not `{ replace: true }`.
- [x] 3.3 Wire `CategoriesPage`'s close action to `navigate('/')`, not
      `{ replace: true }`.
- [x] 3.4 Remove the now-stale `App.tsx` comment describing the old
      "in-app view switch; no router" approach.

## 4. Verification

- [x] 4.1 Run typecheck/build (`npm run build` or equivalent) to confirm
      the route change compiles cleanly.
- [x] 4.2 Manually verify in a normal browser tab: `/` and `/categories`
      both load directly (confirms the existing Firebase Hosting SPA
      rewrite still covers routed paths) and browser back/forward navigate
      correctly between them.
- [x] 4.3 Manually verify in standalone/PWA mode (installed PWA, or Chrome
      DevTools "standalone" display-mode emulation): navigate dashboard →
      categories, then trigger back navigation, and confirm it returns to
      the dashboard instead of exiting the app.
- [x] 4.4 Manually verify: sign out, load `/categories` directly — confirm
      the sign-in screen shows (not a redirect to `/`), and that signing in
      from there lands on `/categories`, not the dashboard.
