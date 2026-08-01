# demo-mode Specification

## Purpose

The user-facing demo: a `/demo` entry point that renders the whole app against
the in-memory `DemoDataSource`, reachable without an account. Demo state is
derived from the URL rather than stored, takes precedence over authentication,
and persists nothing. One feature serves three needs — letting a friend explore
without signing up, a local dev sandbox that needs no emulator, and a clean
source of marketing screenshots.

## Requirements

### Requirement: The app is reachable in demo mode at a `/demo` URL

The web app SHALL serve a demo of itself under the `/demo` path prefix, without
requiring an account or any authentication. Every screen available under the
normal base SHALL be available under the demo base at the corresponding path
(`/demo` for the dashboard, `/demo/categories`, `/demo/reports`,
`/demo/reports/:categoryId`), rendering the same screens with the same
behavior.

#### Scenario: A visitor with no account opens the demo

- **WHEN** an unauthenticated visitor loads `/demo`
- **THEN** the app shows the monthly dashboard populated with demo data, and
  the sign-in screen is not shown

#### Scenario: Every screen is available under the demo base

- **WHEN** an unauthenticated visitor loads `/demo/categories`,
  `/demo/reports`, or `/demo/reports/<categoryId>`
- **THEN** the app shows the categories manager, the Reports screen, or the
  category drilldown respectively, and the sign-in screen is not shown

#### Scenario: The demo URL is a stable, shareable link

- **WHEN** the `/demo` URL is opened directly (e.g. from a README or a link
  shared with a friend), rather than reached by navigating within the app
- **THEN** the demo renders, and the URL is not rewritten, normalized, or
  redirected away

### Requirement: Demo state is derived from the URL, not from an activation step

Whether the app is in demo mode SHALL be a function of the current URL path
alone, re-derived on every render. There SHALL be no imperative "enter demo"
action, no stored demo flag, and no state that can disagree with the URL. A
path SHALL be treated as a demo path when it is exactly `/demo` or begins with
the `/demo/` segment, and SHALL NOT be treated as a demo path merely because it
begins with the characters `/demo` (e.g. `/democracy`).

#### Scenario: Demo mode survives a hard refresh

- **WHEN** a visitor in the demo at `/demo/reports` reloads the page
- **THEN** the app is still in demo mode and still shows the Reports screen

#### Scenario: A path that merely starts with the same characters is not demo

- **WHEN** a path such as `/democracy` is evaluated for demo-ness
- **THEN** it is not treated as a demo path

### Requirement: Demo mode selects the in-memory data source

While in demo mode the app SHALL provide `DemoDataSource` as the active
`DataSource` to all consumers of `useDataSource()`, and SHALL NOT construct a
Firestore-backed data source. While not in demo mode, data source selection
SHALL be unchanged from today (a Firestore-backed data source for the signed-in
owner, none when signed out).

#### Scenario: Demo reads and writes never reach Firestore

- **WHEN** a visitor in the demo views the dashboard, adds a spending, edits a
  category, or opens Reports
- **THEN** every read and write is served by the in-memory demo data source,
  and no Firestore-backed data source is constructed

#### Scenario: Leaving the demo restores the real data source

- **WHEN** a signed-in owner in the demo navigates out of the `/demo` subtree
- **THEN** the app provides the Firestore-backed data source for that owner
  again and shows their real data

### Requirement: Demo mode takes precedence over authentication state

Demo mode SHALL be independent of, and take precedence over, authentication
state. A visitor at a demo path SHALL see the demo regardless of whether they
are signed out, signed in, or whether authentication has finished resolving.
Rendering the demo SHALL NOT be blocked on the authentication state settling,
and entering or leaving the demo SHALL NOT sign the visitor in or out.

#### Scenario: A signed-in owner opens a shared demo link

- **WHEN** a signed-in owner opens `/demo`
- **THEN** the app shows the demo with demo data, their real data is not shown,
  and they remain signed in

#### Scenario: The demo renders before auth resolves

- **WHEN** a visitor loads a demo path while the authentication state is still
  loading
- **THEN** the demo renders immediately rather than showing a loading state
  until authentication resolves

#### Scenario: Exiting the demo returns a signed-in owner to their own data

- **WHEN** a signed-in owner in the demo exits it
- **THEN** they land on their real dashboard without being signed out, without
  re-authenticating, and without an intermediate prompt or confirmation step

### Requirement: The demo banner is the only exit control

While in demo mode the app SHALL display a persistent banner stating that this
is a demo and that nothing is saved. The banner SHALL contain the only control
for leaving the demo. The header's sign-out control SHALL be hidden while in
demo mode, so that leaving the demo and signing out of a real session are never
presented as the same action.

#### Scenario: The banner is visible on every demo screen

- **WHEN** a visitor in the demo is on the dashboard, categories, Reports, or a
  category drilldown
- **THEN** the demo banner is visible with its exit control

#### Scenario: Sign-out is not offered in the demo

- **WHEN** a visitor in the demo views the dashboard header
- **THEN** no sign-out control is present

#### Scenario: Exiting leaves the demo subtree

- **WHEN** a visitor activates the banner's exit control
- **THEN** the app navigates to `/`, which is outside the demo subtree, and
  demo mode ends because it is re-derived from the new URL

### Requirement: Navigation within the demo stays in the demo

All in-app navigation SHALL preserve the active base. Navigating between
screens while in the demo SHALL produce demo URLs and remain in demo mode.
Screen-level view state that lives in query parameters (e.g. the Reports
period's `unit` and `anchor`) SHALL continue to be written as query parameters
without affecting demo-ness.

#### Scenario: Navigating between screens preserves the demo base

- **WHEN** a visitor in the demo navigates from the dashboard to Reports, then
  to a category drilldown, then back
- **THEN** each resulting URL is under `/demo` and the app remains in demo mode

#### Scenario: Changing the Reports period preserves the demo base

- **WHEN** a visitor in the demo changes the Reports period, which replaces the
  screen's query parameters
- **THEN** the path remains under `/demo` and the app remains in demo mode

### Requirement: The demo persists nothing

Demo data SHALL live only in memory for the lifetime of the page. The demo
SHALL NOT write to `localStorage`, `sessionStorage`, IndexedDB, cookies, or any
backend, and SHALL NOT leave anything behind after the tab is closed. Changes
made in the demo SHALL therefore not survive a page reload, which the banner's
"nothing is saved" copy covers; no additional refresh warning is required.

#### Scenario: Demo edits do not survive a reload

- **WHEN** a visitor in the demo adds a spending and then reloads the page
- **THEN** the app is still in demo mode, the demo data is re-seeded from
  scratch, and the added spending is gone

#### Scenario: Nothing is written to browser storage

- **WHEN** a visitor uses the demo and then leaves it
- **THEN** no demo data has been written to any persistent browser storage and
  there is nothing to clean up
