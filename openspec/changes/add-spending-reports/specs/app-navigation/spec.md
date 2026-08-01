## ADDED Requirements

### Requirement: Reports screen has its own route

The web app SHALL serve the Reports screen at `/reports`. Navigating to it SHALL push a new browser history entry, consistent with navigation to other routed screens.

#### Scenario: Reports screen is reachable at its own route

- **WHEN** the signed-in owner navigates to Reports from the dashboard
- **THEN** the browser URL becomes `/reports` (optionally carrying `unit`/`anchor` query parameters) and the Reports screen is shown

#### Scenario: Back button returns from Reports to the dashboard

- **WHEN** the owner navigates from the dashboard to `/reports` and then triggers back navigation
- **THEN** the app shows the dashboard at `/`, consistent with how back navigation from the categories manager behaves

## MODIFIED Requirements

### Requirement: View state for future screens lives in query parameters

Any screen-level view state that should survive a page refresh or be shareable (for example, the period selector on the Reports screen) SHALL be represented as URL query parameters on that screen's route, not as additional path segments. Path segments SHALL be reserved for identifying which screen/resource is shown, not for view configuration on that screen.

#### Scenario: A screen's view state is a query parameter

- **WHEN** a screen needs to persist a view selection (e.g. the Reports screen's period, expressed as `unit` and `anchor`) in the URL
- **THEN** that selection is expressed as a query parameter on the screen's route (e.g. `/reports?unit=month&anchor=2026-07`), not as an additional path segment
