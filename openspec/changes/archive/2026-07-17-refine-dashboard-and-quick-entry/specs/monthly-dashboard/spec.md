## MODIFIED Requirements

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

## ADDED Requirements

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
