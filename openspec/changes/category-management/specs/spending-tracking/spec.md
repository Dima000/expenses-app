## MODIFIED Requirements

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

## ADDED Requirements

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
