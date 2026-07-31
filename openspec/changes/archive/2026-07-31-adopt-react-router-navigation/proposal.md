## Why

The app's in-app navigation is a boolean/view-union cascade (`showCategories` state in `web/src/App.tsx`) that pushes no browser history entry. Because the PWA is installed with `display: 'standalone'` (`web/vite.config.ts`), there is no browser chrome — the Android system back button/gesture is the *only* way to navigate back, and it operates on browser history. Today, pressing back from the Categories screen exits the app instead of returning to the dashboard. This is a real, user-facing bug, and it will only get worse as more screens are added (the breakdown screen is already planned — see `docs/explorations/2026-07-26-expense-breakdown-screen-and-datastore.md`). Adopting `react-router` now, while there are only two screens, replaces the boolean cascade with real routes and fixes the back-button bug as a natural consequence, and establishes URL conventions the next screen can follow instead of retrofitting them later.

## What Changes

- Add `react-router` (`react-router-dom`) as a web dependency.
- Replace the `showCategories` boolean in `web/src/App.tsx` with real routes:
  - `/` — the existing dashboard.
  - `/categories` — the existing `CategoriesPage`, rendered as a routed screen instead of a conditional full-page swap.
- Wire navigation actions (the "Manage categories" button, `CategoriesPage`'s close action) to route transitions (`navigate('/categories')`, `navigate('/')`) instead of `setShowCategories(...)`.
- Establish the query-param convention for future per-screen view state carried in the URL (e.g. a future breakdown screen's period selector as `?unit=month&anchor=2026-07`) — this change does not introduce any screen that uses it yet, but the routing foundation should not need rework to support it.
- **BREAKING**: none for end users (no accounts, external links, or bookmarks depend on today's lack of URLs), but this does change the app's internal navigation mechanism from state-based to URL-based.

Explicitly out of scope:
- The expense breakdown screen itself and its data/aggregation logic (separate future change).
- The caching/listener-reuse discussion (parked in `docs/explorations/2026-07-31-expense-read-caching.md`).
- Category colours (separate future change per the original exploration doc's sequencing).

## Capabilities

### New Capabilities
- `app-navigation`: Routing structure and browser-history behavior for the app shell — which routes exist, how navigating between them affects browser/PWA history (so the system back button returns to the previous screen instead of exiting), and the URL convention (query params for view state) that future screens are expected to follow.

### Modified Capabilities
(none — `monthly-dashboard` and `category-management`'s existing requirements describe screen *behavior*, not how the app routes to them; this change is purely about the navigation mechanism between existing screens)

## Impact

- **Code**: `web/src/App.tsx` (route definitions, replace `showCategories` state), `web/src/components/CategoriesPage.tsx` (close action becomes a route transition), `web/package.json` (new dependency).
- **Dependencies**: adds `react-router-dom` (~10-15 KB gzip) to the web bundle.
- **Hosting**: none required — `firebase.json` already has the SPA catch-all rewrite (`"source": "**" → "/index.html"`), so direct loads/refreshes on `/categories` already resolve correctly.
- **Systems**: PWA back-button/back-gesture behavior in the installed (`standalone`) app.
