## MODIFIED Requirements

### Requirement: Spending and category access goes through a single DataSource abstraction

Web client code SHALL read and write spending and category data only through a
`DataSource` interface, obtained from the currently active data source rather
than by importing a specific backend implementation (e.g. Firestore) directly.
The interface SHALL cover every read/write operation the UI performs on
spendings and categories: subscribing to a month of spendings, subscribing to
categories, creating/updating/deleting a spending, creating many spendings at
once as a single atomic operation, and adding/renaming/removing a category,
setting its color, and adding/removing its terms.

#### Scenario: A component reads or writes through the active DataSource

- **WHEN** a component (e.g. the spending form, the categories page, the
  import screen, or the dashboard's own subscriptions) needs to read or write
  spending or category data
- **THEN** it obtains that operation from the currently active `DataSource`
  rather than importing a Firestore-specific function directly

#### Scenario: A new implementation requires no call-site changes

- **WHEN** a new `DataSource` implementation is introduced (e.g. a future
  non-Firestore data source)
- **THEN** it can be substituted for the active data source without changing
  any component that consumes the interface

#### Scenario: Bulk create is all-or-nothing

- **WHEN** many spendings are created at once through the `DataSource` and any
  one of them fails validation
- **THEN** none of them are stored
