## MODIFIED Requirements

### Requirement: Routed screens

The web app SHALL use client-side routing (real URL paths, not in-memory view state) to present its post-authentication screens. At minimum the dashboard SHALL be served at `/` and the categories manager SHALL be served at `/categories`. Navigating between them SHALL update the browser URL.

The route tree SHALL be defined once and mounted at more than one base path
(today: the normal base `/` and the demo base `/demo`), so that adding a screen
adds it under every base without duplication. An unknown path SHALL redirect to
the dashboard of the base it was requested under, rather than always to `/`.

#### Scenario: Dashboard is the root route

- **WHEN** the signed-in owner loads `/`
- **THEN** the app shows the monthly dashboard

#### Scenario: Categories manager has its own route

- **WHEN** the signed-in owner navigates to manage categories
- **THEN** the browser URL becomes `/categories` and the categories manager is shown

#### Scenario: Unknown path redirects to the dashboard

- **WHEN** a signed-in owner loads a path that does not match any defined route
- **THEN** the app redirects to `/`

#### Scenario: A screen added to the route tree exists under every base

- **WHEN** a new screen is added to the shared route tree
- **THEN** it is reachable at the corresponding path under each mounted base,
  without the route being declared more than once

#### Scenario: Unknown path under a non-root base redirects within that base

- **WHEN** a visitor loads a path under a non-root base that matches no defined
  route (e.g. `/demo/nope`)
- **THEN** the app redirects to that base's dashboard (e.g. `/demo`), not to `/`

### Requirement: The authentication gate takes precedence over routing

There SHALL be no dedicated route for sign-in. Authentication SHALL be checked before the app's routes are evaluated: while unauthenticated, the app SHALL show the sign-in screen at whatever path was requested, without redirecting the URL, and none of the app's routes (including the unknown-path catch-all) SHALL be evaluated until authentication completes. Once the owner signs in, routing SHALL then resolve using the URL already present in the browser, without forcing a redirect to `/`.

The router itself SHALL be mounted unconditionally, so the current URL is
readable before the authentication gate is applied. The gate SHALL be a single
short-circuit evaluated ahead of the app's routes, and SHALL NOT apply to paths
that are exempt from authentication (today: the demo subtree), which render
without waiting on authentication to resolve.

#### Scenario: Unauthenticated visitor sees sign-in without a URL redirect

- **WHEN** an unauthenticated visitor loads any non-exempt path, including one
  that matches no defined route
- **THEN** the app shows the sign-in screen, the browser URL is left
  unchanged, and the unknown-path catch-all does not redirect it to `/`

#### Scenario: Signing in resolves the originally-requested path

- **WHEN** an unauthenticated visitor at `/categories` completes sign-in
- **THEN** the app renders the categories manager at `/categories`, rather
  than forcing a redirect to the dashboard

#### Scenario: An auth-exempt path bypasses the gate

- **WHEN** an unauthenticated visitor loads a path exempt from authentication
- **THEN** the app renders that path's screen rather than the sign-in screen,
  and does not wait on the authentication state to resolve first
