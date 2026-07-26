# category-management Specification

## Purpose

Per-user management of spending categories and their auto-match keywords: the owner creates, renames, and removes categories, and edits each category's globally-unique list of terms. Categories are stored as per-user data with stable identifiers, seeded once with defaults on first run, and removal is non-destructive (existing spendings keep their stored id and simply present as "Uncategorised").

## Requirements

### Requirement: User-managed category set

The system SHALL store each owner's categories as per-user data (a single `users/{uid}` document containing a `categories` array of `{ id, name, terms }`) rather than a hardcoded list. The owner SHALL be able to add, rename, and remove categories through a management UI. Each category SHALL have a stable identifier that does not change when the category is renamed. Category display names SHALL be unique within the owner's set.

#### Scenario: Owner adds a category

- **WHEN** the owner opens the categories manager and adds a category named "Travel"
- **THEN** the system persists a new category with a stable id and the name "Travel", and it becomes selectable when categorising spendings

#### Scenario: Rename keeps the same identity

- **WHEN** the owner renames a category from "Groceries" to "Food"
- **THEN** the category keeps its stable id, and every existing spending assigned to that id now displays as "Food" without any per-spending update

#### Scenario: Duplicate category name is rejected

- **WHEN** the owner adds or renames a category to a name that already exists in their set
- **THEN** the system rejects the change and reports that the name is already in use

### Requirement: Non-destructive category removal

Removing a category SHALL NOT modify or delete any existing spending. Spendings assigned to a removed category SHALL retain their stored category value, and because that value no longer resolves to a category they SHALL be presented as "Uncategorised". There SHALL be no minimum number of categories; the owner MAY remove all of them.

#### Scenario: Removing a category leaves its spendings intact

- **WHEN** the owner removes the "Pet" category while spendings are assigned to it
- **THEN** no spending is rewritten, and those spendings are presented as "Uncategorised" because their stored category id no longer resolves

#### Scenario: All categories removed

- **WHEN** the owner removes every category
- **THEN** the system persists an empty set, all spendings present as "Uncategorised", and the owner may add categories again later

### Requirement: Editable auto-categorisation terms with global uniqueness

Each category SHALL own an editable list of terms (keywords), and categories SHALL start with no terms. A term SHALL belong to at most one category across the entire owner's set. When the owner adds a term that already exists on another category, the system SHALL reject it and name the category that already owns it, and SHALL NOT move the term automatically.

#### Scenario: Owner adds a term to a category

- **WHEN** the owner adds the term "market" to the "Groceries" category
- **THEN** the system persists "market" under "Groceries" and uses it for auto-categorisation

#### Scenario: Duplicate term across categories is rejected

- **WHEN** the owner tries to add "market" to "Health" while "market" already belongs to "Groceries"
- **THEN** the system rejects the addition and reports that "market" is already in "Groceries", leaving it on "Groceries"

#### Scenario: New categories have no terms

- **WHEN** a category is created
- **THEN** it has an empty term list until the owner adds terms

### Requirement: One-time default category seeding

On first run for an owner — when the server authoritatively reports that no categories document exists — the system SHALL seed a default set of categories (Groceries, Health, Sports, Pet, Relationships, Kid, Utilities, Other) with stable slug ids and no terms. Seeding SHALL be triggered ONLY by a server-confirmed absence: a snapshot served from the local cache or observed while offline (i.e. not yet confirmed against the server) SHALL NOT trigger seeding, because an empty or cold cache does not prove the document is absent. The seed write SHALL be non-destructive — it SHALL NOT overwrite a categories document that already exists — so a seed that races a reconnect can never clobber the owner's real category set. The system SHALL NOT re-seed after the document exists, including when the owner has deleted some or all categories.

#### Scenario: Defaults seeded on first run

- **WHEN** an owner uses the app for the first time and the server confirms no categories document exists
- **THEN** the system creates the default categories with stable ids and empty term lists

#### Scenario: No re-seed after deletion

- **WHEN** an owner who already has a categories document deletes categories and reloads the app
- **THEN** the system does not re-create the defaults; the owner's current set is preserved

#### Scenario: Cold or offline start does not re-seed

- **WHEN** the owner opens the app (including the installed PWA) from a cold cache or while offline, so the first categories snapshot is served from cache and reports no document
- **THEN** the system does NOT seed defaults and does NOT queue a seed write, and once the server snapshot arrives the owner's real categories and keywords are shown unchanged

#### Scenario: Seed cannot overwrite existing data

- **WHEN** a seed write is somehow pending while the owner's categories document already exists on the server
- **THEN** the seed write does not overwrite the existing document, and the owner's categories and keywords are preserved
