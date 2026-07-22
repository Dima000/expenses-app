# monthly-dashboard Specification

## Purpose
TBD - created by archiving change add-expense-tracker. Update Purpose after archive.
## Requirements
### Requirement: Owner sign-in

The web app SHALL require the owner to sign in with Firebase Auth (Google sign-in) before any spending data is shown, and SHALL scope all data access to the signed-in owner.

#### Scenario: Signed-out user sees sign-in

- **WHEN** an unauthenticated visitor opens the web app
- **THEN** the app shows a sign-in screen and no spending data

#### Scenario: Owner signs in and sees their data

- **WHEN** the owner completes Google sign-in
- **THEN** the app loads and displays the owner's spendings for the current month

### Requirement: Current-month spending table

The web app SHALL display the selected month's spendings in a table whose
columns, in order, are **Date**, **Amount**, **Comment**, and **Category**. The
date SHALL be shown in a short human format of day-of-month followed by the
abbreviated month name (e.g. `7 Jun`). By default the table SHALL be ordered
with the most recent spending first (descending by the actual spending date).
The owner SHALL be able to sort the table by category; when category sort is
active the rows SHALL be grouped/ordered by category, and clearing it SHALL
return to the default descending-date ordering.

#### Scenario: Date is the first column in short format

- **WHEN** the month table renders a spending dated `2026-06-07`
- **THEN** its first column shows `7 Jun` and the columns appear in the order Date, Amount, Comment, Category

#### Scenario: Latest spending appears on top

- **WHEN** the month table renders with multiple spendings and no category sort is active
- **THEN** the spending with the most recent date appears in the first row and older spendings follow in descending date order

#### Scenario: Sort by category

- **WHEN** the owner activates sorting by the category column
- **THEN** the rows are ordered by category and this ordering persists until the owner clears it

#### Scenario: Category sort reverts to date default

- **WHEN** the owner clears the category sort
- **THEN** the table returns to descending order by the actual spending date

#### Scenario: Empty month

- **WHEN** the selected month has no spendings and its data has finished loading
- **THEN** the app shows an empty-state message instead of an empty table

### Requirement: Month navigation

The web app SHALL default to the current month and SHALL provide controls to move to the previous month and the next month, updating the table and totals to reflect the newly selected month.

#### Scenario: Navigate to previous month

- **WHEN** the owner activates the previous-month control
- **THEN** the app displays the prior month's spendings and its total, and the displayed month label updates accordingly

#### Scenario: Navigate to next month

- **WHEN** the owner activates the next-month control
- **THEN** the app displays the following month's spendings and its total

### Requirement: Month total card

The web app SHALL display a card showing the total spending amount for the currently selected month, and the total SHALL update whenever the month changes or spendings are added, edited, or removed.

#### Scenario: Total reflects the month's spendings

- **WHEN** the selected month contains spendings of `10` and `3`
- **THEN** the total card shows `13`

#### Scenario: Total updates after an edit

- **WHEN** the owner edits a spending's amount in the selected month
- **THEN** the total card recomputes to reflect the new amount

### Requirement: Manual spending management

The web app SHALL let the owner create, edit, and delete spendings, capturing
amount, date, category (from the fixed list), and comment, with changes synced
to Firestore and reflected across devices. For creating a new spending the form
SHALL accept the amount and comment together in a single free-text field: on
submit the system SHALL take the first number found in the text as the amount
and the remaining trimmed text as the comment, while date and category remain
separate inputs. Editing an existing spending SHALL continue to expose discrete
amount and comment fields.

#### Scenario: Add a spending from free text

- **WHEN** the owner submits the add-spending form with the free-text field `"12 lunch with team"`, a date, and a category
- **THEN** the spending is saved with amount `12` and comment `"lunch with team"` and appears in the month table for its date's month

#### Scenario: First number is chosen as the amount

- **WHEN** the owner submits the free-text field `"coffee 4 for 2 people"`
- **THEN** the amount is `4` and the comment is the remaining trimmed text `"coffee for 2 people"`

#### Scenario: Edit a spending

- **WHEN** the owner edits an existing spending and saves
- **THEN** the updated values are persisted and shown in the table

#### Scenario: Delete a spending

- **WHEN** the owner deletes a spending and confirms
- **THEN** the spending is removed from Firestore and no longer appears in the table

#### Scenario: Changes are cloud-synced across devices

- **WHEN** a spending is added on one device
- **THEN** it appears for the same owner when the app is opened on another device

### Requirement: Categorize-later flow

The web app SHALL let the owner find spendings whose category is `uncategorized` and assign each a category from the fixed list after the fact, so voice entries can be captured instantly and tidied up later.

#### Scenario: Uncategorized spendings are discoverable

- **WHEN** the owner has one or more `uncategorized` spendings
- **THEN** the app surfaces them (e.g. a filter, badge, or count) so they can be found and reviewed

#### Scenario: Assign a category to an uncategorized spending

- **WHEN** the owner selects a category from the fixed list for an `uncategorized` spending
- **THEN** the spending's category is updated and persisted, and it no longer appears as uncategorized

### Requirement: Installable PWA

The web app SHALL be installable as a Progressive Web App on Android, providing a home-screen icon and a full-screen launch so voice logging feels like opening an app rather than a browser tab.

#### Scenario: App can be installed to the home screen

- **WHEN** the owner opens the app in a supporting browser and chooses install/add-to-home-screen
- **THEN** the app installs with an icon and launches full-screen from that icon

### Requirement: Initial data loading state

The web app SHALL show a loading indicator for the current-month spendings while
the first Firestore snapshot for the signed-in owner is still pending, and SHALL
NOT show the empty-state message until that first snapshot has arrived, so the
page does not flash an empty state and shift when data loads.

#### Scenario: Loading indicator before first snapshot

- **WHEN** the PWA opens and the first month snapshot has not yet arrived
- **THEN** the app shows a loading indicator in place of the table and does not show the empty-state message

#### Scenario: Empty state only after load completes

- **WHEN** the first month snapshot arrives and contains no spendings
- **THEN** the loading indicator is replaced by the empty-state message

### Requirement: Quick spending filters

The web app SHALL provide quick filter buttons on the dashboard that narrow the
displayed spendings for the selected month. The filters SHALL be **exclusive**:
at most one filter is active at a time, and activating a filter SHALL deactivate
any other active filter. Activating the already-active filter SHALL clear it.
When no filter is active, all of the selected month's spendings SHALL be shown.

The available quick filters SHALL be:

- **Uncategorized** — spendings whose stored category does not resolve to a
  current category (the existing categorize-later filter).
- **Today** — spendings dated on the current day (local time).
- **Yesterday** — spendings dated on the previous day (local time).

The date filters SHALL operate on the already-loaded month; a date filter for a
day that falls outside the selected month therefore contributes no matches.

#### Scenario: No filter active shows all spendings

- **WHEN** no quick filter button is active
- **THEN** the table shows all of the selected month's spendings

#### Scenario: Today filter shows only today's spendings

- **WHEN** the owner activates the **Today** filter and no other filter is active
- **THEN** the table shows only spendings dated on the current day

#### Scenario: Yesterday filter shows only yesterday's spendings

- **WHEN** the owner activates the **Yesterday** filter and no other filter is active
- **THEN** the table shows only spendings dated on the previous day

#### Scenario: Selecting a filter deactivates the previous one

- **WHEN** the **Today** filter is active and the owner activates the **Yesterday** filter
- **THEN** the **Today** filter becomes inactive and the table shows only spendings dated on the previous day

#### Scenario: Toggling the active filter off

- **WHEN** the owner activates the currently active quick filter again
- **THEN** no filter is active and the table shows all of the selected month's spendings

#### Scenario: Date filter outside the selected month

- **WHEN** the selected month is not the current month and the owner activates the **Today** filter
- **THEN** the table shows no spendings for that filter, since the current day is not in the loaded month

