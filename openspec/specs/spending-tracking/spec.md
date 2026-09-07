# spending-tracking Specification

## Purpose
TBD - created by archiving change add-expense-tracker. Update Purpose after archive.
## Requirements
### Requirement: Spending record model

The system SHALL represent each spending as a record containing an amount (positive integer in whole currency units), a spending date, a free-text comment, and a category. The amount SHALL always be expressed in the base currency, RON; a record SHALL NOT carry a currency. The category SHALL be either a reference to one of the owner's managed categories or the reserved value `uncategorized`. A category reference SHALL be stored as a stable category identifier so that renaming a category does not require rewriting spendings, and so that a reference to a removed category is presented as "Uncategorised" rather than failing. Each record SHALL also carry a server-assigned creation timestamp and belong to the single owning user. When a category was assigned automatically by term matching, the record SHALL also carry the matched term. When the amount was converted from a non-base currency at entry, the record SHALL also carry an optional display-only text caption describing the original entry.

#### Scenario: Valid spending record is stored

- **WHEN** a spending with amount `12`, date `2026-07-04`, comment `"lunch"`, and a valid category reference is submitted through any input path
- **THEN** the system persists a record with those fields plus a server creation timestamp and the owner's user id

#### Scenario: Spending may be saved uncategorized

- **WHEN** a spending is submitted with category `"uncategorized"`
- **THEN** the system accepts and persists it, and it is later assignable to a real category

#### Scenario: Reference to a removed category presents as uncategorized

- **WHEN** a stored spending references a category id that no longer resolves to a category
- **THEN** the spending is presented as "Uncategorised" and remains reassignable, without any error

#### Scenario: Fractional amount is rounded up

- **WHEN** a spending with a fractional amount of `12.34` is recorded
- **THEN** the system stores the amount as the whole integer `13` (rounded up to the next whole unit)

#### Scenario: Whole amount is stored as-is

- **WHEN** a spending with amount `12` is recorded
- **THEN** the system stores `12` unchanged

#### Scenario: Missing required field is rejected

- **WHEN** a spending is submitted without an amount or without a category
- **THEN** the system rejects the write and returns a validation error identifying the missing field

#### Scenario: Converted record carries a caption

- **WHEN** a spending was entered in a non-base currency and converted at write time
- **THEN** the stored record holds the converted RON amount plus a display-only caption of the original entry, and holds no currency field

### Requirement: Automatic categorisation by term matching

When a spending is saved on any input path (web form, voice, or REST), the system SHALL attempt to categorise it from its comment using the owner's category terms. Matching SHALL be case-insensitive and SHALL match whole words only (a term SHALL NOT match inside a larger word). The system SHALL collect the set of distinct categories whose terms appear in the comment and SHALL assign the category only when exactly one distinct category matches; when zero or two-or-more distinct categories match, the spending SHALL be left `uncategorized`. Automatic assignment SHALL apply only when the owner left the category `uncategorized`, and SHALL NOT override a category the owner chose explicitly. When a category is assigned automatically, the system SHALL record which term triggered the match so it can be surfaced to the owner.

#### Scenario: Single matching term assigns the category

- **WHEN** a spending is saved uncategorized with comment `"weekly market run"` and the term `"market"` belongs to Groceries
- **THEN** the system assigns the spending to Groceries and records that it matched on `"market"`

#### Scenario: Whole-word, case-insensitive matching

- **WHEN** a spending comment contains `"Market"` and the term is `"market"`
- **THEN** it matches (case-insensitive); but a comment of `"supermarket"` does NOT match the term `"market"`

#### Scenario: Ambiguous match is left uncategorized

- **WHEN** a spending comment contains terms belonging to two different categories (for example `"pet"` for Pet and `"market"` for Groceries)
- **THEN** the system leaves the spending `uncategorized`

#### Scenario: No matching term leaves it uncategorized

- **WHEN** a spending comment contains none of the owner's terms
- **THEN** the spending remains `uncategorized`

#### Scenario: Explicit category is not overridden

- **WHEN** the owner explicitly selects a category and the comment also contains a term for a different category
- **THEN** the system keeps the owner's chosen category and does not auto-assign

### Requirement: Shared core write path

The system SHALL implement a single core write function (`recordSpending`) that validates a spending and persists it to Firestore, and all machine-facing input adapters SHALL create spendings through this one function so that validation and persistence behavior are identical across paths.

#### Scenario: Adapters share validation behavior

- **WHEN** the same spending is submitted via different input paths
- **THEN** each produces records with identical field structure and validation behavior, distinguishable only by an optional source marker

### Requirement: Authenticated REST write endpoint

The system SHALL expose an HTTP endpoint `POST /spending` that accepts a JSON spending payload and writes it via the core function. The endpoint SHALL require a valid shared secret and SHALL reject any request without it.

#### Scenario: Authorized request succeeds

- **WHEN** a `POST /spending` request arrives carrying the correct shared secret and a valid payload
- **THEN** the system records the spending and responds with success and the created record id

#### Scenario: Missing or wrong secret is rejected

- **WHEN** a `POST /spending` request arrives with no secret or an incorrect secret
- **THEN** the system responds with `401 Unauthorized` and does not write any record

### Requirement: Backend and data access authorization

The system SHALL grant privileged (Admin SDK) writes only to server-side code that has verified the shared secret, and Firestore security rules SHALL restrict all direct client reads and writes to documents owned by the authenticated owner's user id.

#### Scenario: Another identity cannot read the data

- **WHEN** a client authenticated as any user other than the owner attempts to read the spendings collection
- **THEN** Firestore security rules deny the read

#### Scenario: Unauthenticated direct client access is denied

- **WHEN** an unauthenticated client attempts to read or write the spendings collection directly
- **THEN** Firestore security rules deny the operation

### Requirement: Currency selection when adding a spending

The add-spending form SHALL provide a currency control offering the entry currencies defined
by the `currency-conversion` capability. The control SHALL default to RON every time the form
is opened and SHALL NOT remember a previously chosen currency, so that failing to change it
always produces a correct RON entry. When a non-RON currency is selected, the form SHALL show
the converted RON amount together with the rate used. When RON is selected, no conversion
preview SHALL be shown.

#### Scenario: Picker defaults to RON on every open

- **WHEN** the owner saves a spending in EUR and then opens the add form again
- **THEN** the currency control shows RON, not EUR

#### Scenario: Conversion preview for a foreign currency

- **WHEN** the owner enters `11` with EUR selected and the cached rate is `5.2584` RON per EUR
- **THEN** the form displays a preview reading approximately `≈ 58 RON · rate 5.2584`

#### Scenario: No preview for base currency

- **WHEN** RON is selected
- **THEN** no conversion preview is displayed

### Requirement: Convert before rounding

When a spending is entered in a non-RON currency, the system SHALL multiply the entered
amount by the cached RON-per-unit rate and SHALL apply the whole-unit round-up to the
resulting RON value. The round-up SHALL be applied exactly once, after conversion, and SHALL
NOT be applied to the entered foreign amount beforehand.

#### Scenario: Fractional conversion result is rounded up once

- **WHEN** `11` EUR is entered at a rate of `5.2584` RON per EUR
- **THEN** the stored amount is `58` (from `57.8424`, ceilinged once)

#### Scenario: Foreign amount is not pre-rounded

- **WHEN** `10.4` EUR is entered at a rate of `5.0` RON per EUR
- **THEN** the stored amount is `52` (from `52.0`), not `55` (which would result from
  rounding `10.4` up to `11` before converting)

#### Scenario: Base-currency entry is unaffected

- **WHEN** a spending is entered with RON selected
- **THEN** the amount is rounded up exactly as before, with no conversion applied

### Requirement: Original-entry caption

When a spending is created in a non-RON currency, the system SHALL persist an optional
free-text field recording what the owner actually entered, including the rate used — for
example `"11 euro @ 5.2584"`. This field SHALL be display-only: no part of the system SHALL
parse it, aggregate it, filter on it, or derive any value from it. It SHALL NOT be written
for RON entries. The edit form SHALL display it read-only alongside the stored RON amount.

#### Scenario: Caption is written for a foreign entry

- **WHEN** `11` EUR is saved at a rate of `5.2584`
- **THEN** the record stores amount `58` and a caption reading `"11 euro @ 5.2584"`

#### Scenario: No caption for a base-currency entry

- **WHEN** a spending is entered in RON
- **THEN** no caption field is written to the record

#### Scenario: Caption is shown when editing

- **WHEN** the owner opens a converted spending in the edit form
- **THEN** the amount is shown in RON and the caption is displayed read-only next to it

### Requirement: Editing does not re-open currency selection

The edit form SHALL NOT offer a currency control. A stored amount is already expressed in
RON, and currency selection is a one-time operation performed at entry. Correcting the
currency of an existing spending SHALL be done by deleting it and creating it again.

#### Scenario: Edit form has no currency control

- **WHEN** the owner opens any spending in the edit form
- **THEN** the amount field is in RON and no currency control is present

### Requirement: Caption is cleared only when the amount changes

The system SHALL retain the original-entry caption across edits that leave the amount
unchanged, because it still describes the stored value truthfully. The system SHALL clear the
caption when an edit changes the amount, because the caption would then misdescribe the
stored value.

#### Scenario: Editing the comment keeps the caption

- **WHEN** the owner edits only the comment, date or category of a converted spending
- **THEN** the caption is retained unchanged

#### Scenario: Editing the amount clears the caption

- **WHEN** the owner changes the amount of a converted spending from `58` to `70`
- **THEN** the caption is removed from the record

### Requirement: Machine-facing write paths remain base-currency only

The REST write path SHALL continue to accept and store RON amounts only. It SHALL NOT accept
a currency and SHALL NOT perform conversion, because exchange rates are cached per device and
are not available to server-side adapters.

#### Scenario: REST payloads are unchanged

- **WHEN** a spending is submitted through the REST endpoint
- **THEN** the amount is interpreted as RON and stored exactly as it is today, with no
  currency handling

