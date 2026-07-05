## ADDED Requirements

### Requirement: Owner sign-in

The web app SHALL require the owner to sign in with Firebase Auth (Google sign-in) before any spending data is shown, and SHALL scope all data access to the signed-in owner.

#### Scenario: Signed-out user sees sign-in

- **WHEN** an unauthenticated visitor opens the web app
- **THEN** the app shows a sign-in screen and no spending data

#### Scenario: Owner signs in and sees their data

- **WHEN** the owner completes Google sign-in
- **THEN** the app loads and displays the owner's spendings for the current month

### Requirement: Current-month spending table

The web app SHALL display the selected month's spendings in a table ordered with the most recent spending first, showing at least the amount, date, category, and comment of each row.

#### Scenario: Latest spending appears on top

- **WHEN** the month table renders with multiple spendings
- **THEN** the spending with the most recent date appears in the first row and older spendings follow in descending date order

#### Scenario: Empty month

- **WHEN** the selected month has no spendings
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

The web app SHALL let the owner create, edit, and delete spendings, capturing amount, date, category (from the fixed list), and comment, with changes synced to Firestore and reflected across devices.

#### Scenario: Add a spending manually

- **WHEN** the owner submits the add-spending form with a valid amount, date, category, and comment
- **THEN** the spending is saved and appears in the month table for its date's month

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
