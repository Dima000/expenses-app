## ADDED Requirements

### Requirement: Import screen has its own route

The web app SHALL serve the CSV Import screen at `/import`, as part of the shared route tree, so it also exists under every other mounted base (for example `/demo/import`). The dashboard SHALL provide a control that navigates to it. Navigating to it SHALL push a new browser history entry, so that back navigation returns to the dashboard.

#### Scenario: Import screen is reachable from the dashboard

- **WHEN** the signed-in owner taps the import control on the dashboard
- **THEN** the browser URL becomes `/import` and the Import screen is shown

#### Scenario: Back button returns from Import to the dashboard

- **WHEN** the owner navigates from the dashboard to `/import` and then triggers back navigation
- **THEN** the app shows the dashboard at `/`
