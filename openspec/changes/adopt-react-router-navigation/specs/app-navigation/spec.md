## ADDED Requirements

### Requirement: Routed screens

The web app SHALL use client-side routing (real URL paths, not in-memory view state) to present its post-authentication screens. At minimum the dashboard SHALL be served at `/` and the categories manager SHALL be served at `/categories`. Navigating between them SHALL update the browser URL.

#### Scenario: Dashboard is the root route

- **WHEN** the signed-in owner loads `/`
- **THEN** the app shows the monthly dashboard

#### Scenario: Categories manager has its own route

- **WHEN** the signed-in owner navigates to manage categories
- **THEN** the browser URL becomes `/categories` and the categories manager is shown

#### Scenario: Unknown path redirects to the dashboard

- **WHEN** a signed-in owner loads a path that does not match any defined route
- **THEN** the app redirects to `/`

### Requirement: Back navigation returns to the previous screen

Navigating from the dashboard to another routed screen SHALL push a new browser history entry (not replace the current one), so that going back (via the browser back button or, in the installed PWA where there is no browser chrome, the OS back button/gesture) returns to the previous screen rather than exiting the app or the browser tab.

#### Scenario: Back button returns from categories to the dashboard

- **WHEN** the owner navigates from the dashboard to `/categories` and then
  triggers back navigation
- **THEN** the app shows the dashboard at `/`, and no further back
  navigation exits the app as a direct result of this transition

### Requirement: The authentication gate takes precedence over routing

There SHALL be no dedicated route for sign-in. Authentication SHALL be checked before routing is evaluated: while unauthenticated, the app SHALL show the sign-in screen at whatever path was requested, without redirecting the URL, and none of the app's routes (including the unknown-path catch-all) SHALL be evaluated until authentication completes. Once the owner signs in, routing SHALL then resolve using the URL already present in the browser, without forcing a redirect to `/`.

#### Scenario: Unauthenticated visitor sees sign-in without a URL redirect

- **WHEN** an unauthenticated visitor loads any path, including one that
  matches no defined route
- **THEN** the app shows the sign-in screen, the browser URL is left
  unchanged, and the unknown-path catch-all does not redirect it to `/`

#### Scenario: Signing in resolves the originally-requested path

- **WHEN** an unauthenticated visitor at `/categories` completes sign-in
- **THEN** the app renders the categories manager at `/categories`, rather
  than forcing a redirect to the dashboard

### Requirement: View state for future screens lives in query parameters

Any screen-level view state that should survive a page refresh or be shareable (for example, a period selector on a future breakdown screen) SHALL be represented as URL query parameters on that screen's route, not as additional path segments. Path segments SHALL be reserved for identifying which screen/resource is shown, not for view configuration on that screen.

#### Scenario: A future screen's view state is a query parameter

- **WHEN** a future screen needs to persist a view selection (e.g. a period
  such as month or year) in the URL
- **THEN** that selection is expressed as a query parameter on the screen's
  route (e.g. `/breakdown?unit=month&anchor=2026-07`), not as an additional
  path segment
