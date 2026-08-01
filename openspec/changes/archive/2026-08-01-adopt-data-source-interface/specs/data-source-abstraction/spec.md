## ADDED Requirements

### Requirement: Spending and category access goes through a single DataSource abstraction

Web client code SHALL read and write spending and category data only through a
`DataSource` interface, obtained from the currently active data source rather
than by importing a specific backend implementation (e.g. Firestore) directly.
The interface SHALL cover every read/write operation the UI performs on
spendings and categories: subscribing to a month of spendings, subscribing to
categories, creating/updating/deleting a spending, and
adding/renaming/removing a category, setting its color, and adding/removing
its terms.

#### Scenario: A component reads or writes through the active DataSource

- **WHEN** a component (e.g. the spending form, the categories page, or the
  dashboard's own subscriptions) needs to read or write spending or category
  data
- **THEN** it obtains that operation from the currently active `DataSource`
  rather than importing a Firestore-specific function directly

#### Scenario: A new implementation requires no call-site changes

- **WHEN** a new `DataSource` implementation is introduced (e.g. a future
  non-Firestore data source)
- **THEN** it can be substituted for the active data source without changing
  any component that consumes the interface

### Requirement: The Firestore-backed implementation preserves existing behavior

The Firestore-backed `DataSource` implementation SHALL produce the same
Firestore reads and writes — same documents, same fields, same query results
— as the pre-refactor direct Firestore calls it replaces. This change SHALL
NOT alter the shape of any stored document or the behavior of any existing
capability (`spending-tracking`, `category-management`, `monthly-dashboard`,
`spending-reports`, `offline-data-persistence`, `voice-capture`).

#### Scenario: Spending writes are unchanged

- **WHEN** the signed-in owner creates, edits, or deletes a spending through
  the `DataSource`
- **THEN** the resulting Firestore document is identical in shape and content
  to what the pre-refactor implementation would have written for the same
  input

#### Scenario: Category writes are unchanged

- **WHEN** the signed-in owner adds, renames, or removes a category, changes
  its color, or adds/removes a term through the `DataSource`
- **THEN** the resulting `users/{uid}` document is identical in shape and
  content to what the pre-refactor implementation would have written for the
  same input
