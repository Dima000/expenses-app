## ADDED Requirements

### Requirement: CSV import format

The system SHALL accept a comma-separated file whose first non-blank line is a header row. Header names SHALL be matched case-insensitively after trimming, in any column order. The recognised columns are `date` (required), `amount` (required), `comment` (optional) and `category` (optional); any other column SHALL be ignored. Fields MAY be double-quoted, with `""` as an escaped quote, and quoted fields MAY contain commas and line breaks. A double quote SHALL open a quoted field only at the start of a field; elsewhere it SHALL be read as a literal character. A quoted field left unterminated at the end of the file SHALL be rejected as a file-level error naming the line where it began. Both LF and CRLF line endings SHALL be accepted, a leading UTF-8 byte-order mark SHALL be ignored, and blank lines SHALL be skipped. All amounts SHALL be interpreted as RON.

#### Scenario: Minimal file is accepted

- **WHEN** the owner picks a file containing `date,amount` followed by `2026-03-02,45`
- **THEN** the preview shows one valid row dated `2026-03-02` with amount `45`, an empty comment and no category

#### Scenario: Columns in any order and any case

- **WHEN** the header is `Category,Comment,AMOUNT,Date`
- **THEN** each column is read by its name, not its position

#### Scenario: Quoted field with a comma

- **WHEN** a row contains the comment `"coffee, croissant"`
- **THEN** the comment is read as `coffee, croissant`

#### Scenario: Missing required header

- **WHEN** the header row has no `amount` column
- **THEN** the whole file is rejected with an error naming the missing column, and no preview rows are shown

### Requirement: Import size limit

An import SHALL contain at most 500 data rows. A file with more than 500 data rows SHALL be rejected as a whole, with an error stating the limit, and SHALL NOT be truncated. A file with a header but no data rows SHALL be rejected as empty.

#### Scenario: Oversized file is rejected

- **WHEN** the owner picks a file with 501 data rows
- **THEN** no preview is shown and an error says that at most 500 rows can be imported at once

#### Scenario: Exactly 500 rows is accepted

- **WHEN** the owner picks a file with exactly 500 data rows
- **THEN** all 500 rows appear in the preview

### Requirement: Row validation

Each row SHALL be validated with the same rules as every other write path. The date SHALL be a valid `YYYY-MM-DD` calendar date. The amount SHALL be a non-negative decimal number using `.` as the decimal point, with no sign or thousands separators, and SHALL be rounded up to a whole unit. The resulting amount SHALL be positive. A row that fails validation SHALL be shown greyed out with the reason and its line number in the file, and SHALL be skipped on apply. An invalid row SHALL NOT prevent the valid rows from being imported.

#### Scenario: Fractional amount rounds up

- **WHEN** a row has amount `12.34`
- **THEN** the preview shows amount `13`

#### Scenario: Invalid amount is greyed out

- **WHEN** a row has amount `12,50`
- **THEN** that row is shown greyed out with a reason explaining the expected amount format, and is excluded from the import count

#### Scenario: Invalid date is greyed out

- **WHEN** a row has date `02.03.2026`
- **THEN** that row is shown greyed out with a date-format reason, and is excluded from the import count

#### Scenario: Zero amount is greyed out

- **WHEN** a row has amount `0`
- **THEN** that row is shown greyed out as invalid

### Requirement: Category resolution on import

For each row, the system SHALL resolve the category in this order:

1. If the `category` value case-insensitively matches the name of one of the owner's existing categories, the row SHALL take that category.
2. Otherwise the row SHALL be automatically categorised from its comment by the existing term-matching rule, recording the matched term.
3. Otherwise the row SHALL be uncategorized.

The import SHALL NOT create categories, and SHALL NOT mention category names from the file that do not exist.

#### Scenario: Matching category name is applied

- **WHEN** a row's category is `groceries` and the owner has a category named `Groceries`
- **THEN** the row is assigned to Groceries

#### Scenario: Unknown category falls back to keyword matching

- **WHEN** a row's category is `Travel`, no such category exists, and the comment `weekly market run` contains the Groceries term `market`
- **THEN** the row is assigned to Groceries via the term `market`, no category is created, and `Travel` is not mentioned anywhere

#### Scenario: No match leaves the row uncategorized

- **WHEN** a row has no category value and its comment matches no term
- **THEN** the row is uncategorized in the preview

#### Scenario: Explicit category beats keywords

- **WHEN** a row's category is `Health` (an existing category) and its comment contains a Groceries term
- **THEN** the row is assigned to Health

### Requirement: Import preview and editing

The system SHALL show the parsed rows on a dedicated Import screen before anything is saved, in a table with the same columns as the dashboard's spending table. The owner SHALL be able to edit any field of any row (amount, date, comment, category) through the same edit dialog used for existing spendings, without a currency control. The owner SHALL be able to assign a category inline to an uncategorized row and to remove any row from the import. Edits SHALL be applied only to the in-memory preview until the owner applies the import. The screen SHALL show how many rows will be imported, how many are skipped as invalid, and how many are uncategorized.

#### Scenario: Assigning a category in the preview

- **WHEN** the owner picks a category for an uncategorized row in the preview
- **THEN** the row shows that category and the uncategorized count drops by one, and nothing is written yet

#### Scenario: Fixing an invalid row

- **WHEN** the owner edits a greyed-out row and corrects its date
- **THEN** the row becomes valid and is included in the import count

#### Scenario: Removing a row

- **WHEN** the owner removes a row from the preview
- **THEN** it disappears from the table and will not be imported

#### Scenario: Leaving discards the draft

- **WHEN** the owner cancels or navigates away from the Import screen before applying
- **THEN** nothing is written

### Requirement: Applying an import

When the owner applies the import, the system SHALL write every valid row in one atomic operation: either all valid rows are stored or none are. Each stored spending SHALL have `source` `web` and a shared `importId` that is unique to this apply and is not shown in the UI. Imported spendings SHALL otherwise be indistinguishable from spendings added through the form. On success the system SHALL confirm how many spendings were imported and return to the dashboard. On failure the system SHALL show an error and keep the preview so the owner can retry.

#### Scenario: Successful apply

- **WHEN** the preview has 41 valid rows and 2 invalid rows and the owner taps Apply
- **THEN** exactly 41 spendings are stored, all with `source` `web` and the same `importId`, the owner sees a confirmation for 41 spendings, and the dashboard is shown

#### Scenario: Two imports get different ids

- **WHEN** the owner applies two separate imports
- **THEN** the spendings from each import carry a different `importId`

#### Scenario: Failed apply keeps the draft

- **WHEN** the write fails
- **THEN** no spending from this import is stored, an error is shown, and the preview with the owner's edits is still present

#### Scenario: Nothing valid to apply

- **WHEN** the preview has no valid rows
- **THEN** the Apply action is disabled

### Requirement: Import works in demo mode

The Import screen SHALL also be available under the demo base. There, applying an import SHALL write to the in-memory demo data source and never to Firestore.

#### Scenario: Importing in the demo

- **WHEN** a visitor at `/demo/import` applies an import
- **THEN** the rows appear on the demo dashboard and nothing is written to Firestore
