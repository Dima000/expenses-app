# spending-tracking Specification

## Purpose
TBD - created by archiving change add-expense-tracker. Update Purpose after archive.
## Requirements
### Requirement: Spending record model

The system SHALL represent each spending as a record containing an amount (positive integer in whole currency units), a spending date, a free-text comment, and a category. The category SHALL be either a reference to one of the owner's managed categories or the reserved value `uncategorized`. A category reference SHALL be stored as a stable category identifier so that renaming a category does not require rewriting spendings, and so that a reference to a removed category is presented as "Uncategorised" rather than failing. Each record SHALL also carry a server-assigned creation timestamp and belong to the single owning user. When a category was assigned automatically by term matching, the record SHALL also carry the matched term.

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

