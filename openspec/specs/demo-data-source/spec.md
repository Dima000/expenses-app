# demo-data-source Specification

## Purpose

An in-memory `DataSource` implementation seeded with a deterministic,
date-relative dataset. It fully implements the `DataSource` interface with
no Firestore access, enabling a future demo mode, local dev sandbox, and
marketing screenshots without an account or a running Firestore emulator.

## Requirements

### Requirement: DemoDataSource implements the full DataSource interface in memory

`DemoDataSource` SHALL implement every method of the `DataSource` interface
(`subscribeToMonth`, `subscribeToRange`, `subscribeToCategories`,
`createSpending`, `updateSpending`, `assignCategory`, `deleteSpending`,
`addCategory`, `renameCategory`, `setCategoryColor`, `removeCategory`,
`addTerm`, `removeTerm`) using only in-memory state. It SHALL NOT read from
or write to Firestore, or touch Firestore's IndexedDB offline persistence
cache, under any of its operations.

#### Scenario: A DemoDataSource instance is fully self-contained

- **WHEN** a `DemoDataSource` is constructed and any of its methods are
  called
- **THEN** no Firestore client call is made and no IndexedDB storage used by
  the Firestore SDK's offline cache is read or written

#### Scenario: Every DataSource operation is supported

- **WHEN** a caller invokes any method defined on the `DataSource` interface
  against a `DemoDataSource` instance
- **THEN** the call succeeds against the in-memory state (a subscription
  yields data, a write mutates the in-memory state) with no unimplemented
  method

### Requirement: Subscriptions notify listeners asynchronously via microtask

`DemoDataSource` subscription methods SHALL NOT invoke a newly registered or
already-registered listener synchronously from within the call that
triggered a write. Notification SHALL happen on a microtask following the
mutation, mirroring the asynchronous delivery of Firestore's `onSnapshot`.

#### Scenario: A write's listener notification is asynchronous

- **WHEN** a caller subscribes via `subscribeToMonth` or
  `subscribeToCategories` and then performs a write (e.g. `createSpending`)
  that affects the subscribed data
- **THEN** the registered `onData` callback is not invoked synchronously
  during the write call, and is invoked with updated data after a microtask
  has elapsed

### Requirement: Seed data generation is deterministic

Given the same "current date" input, the seed data generator SHALL produce
identical output (same spendings, same fields, same order) on every
invocation. The generator SHALL NOT use any source of randomness.

#### Scenario: Two generations on the same day produce identical output

- **WHEN** the seed generator is invoked twice with the same "today" value
- **THEN** both invocations produce the same set of generated spendings,
  field-for-field

#### Scenario: Dates are computed relative to "today", not hardcoded

- **WHEN** the seed generator is invoked with a given "today" value
- **THEN** every generated spending's `date` falls within the expected
  window relative to that "today" value, and no generated `date` is a
  literal value independent of the input

### Requirement: Seed data covers the required date range, volume, and mix

The seed generator SHALL produce spendings spanning 3–4 months of history in
the current year plus 2–3 months in the prior year (relative to "today"),
at a volume of approximately 30 transactions per covered month. The
generated set SHALL include at least one entry with `category` equal to
`uncategorized`, at least one entry with `needsReview` set to `true`, and at
least one entry dated "today". Every generated entry SHALL have
`source: 'web'`.

#### Scenario: Generated set spans the required range and volume

- **WHEN** the seed generator is invoked
- **THEN** the earliest generated date is within the prior-year window and
  the latest is within the current-year window described above, and the
  total count is consistent with ~30 entries per covered month

#### Scenario: Generated set includes the required mix

- **WHEN** the seed generator's output is inspected
- **THEN** it contains at least one `uncategorized` entry, at least one
  `needsReview` entry, and at least one entry whose `date` equals "today"

#### Scenario: All generated entries use the web source

- **WHEN** the seed generator's output is inspected
- **THEN** every entry's `source` field is `'web'`

### Requirement: Demo categories are seeded locally without affecting real defaults

`DemoDataSource` SHALL seed its internal category set from
`DEFAULT_CATEGORIES` with a small number of additional terms applied to that
local copy only. This SHALL NOT modify the `DEFAULT_CATEGORIES` export
itself or affect the categories seeded for any real, Firestore-backed
account.

#### Scenario: Demo terms do not leak into the shared default

- **WHEN** a `DemoDataSource` instance seeds and mutates its local category
  set (including adding terms)
- **THEN** `DEFAULT_CATEGORIES` as exported from `@expenses/shared` is
  unchanged, and a separate `FirestoreDataSource` seeding a new owner still
  seeds the unmodified defaults

### Requirement: Seeded auto-categorized entries are produced by the real matcher

Seed entries intended to demonstrate auto-categorization SHALL be generated
by constructing an uncategorized input whose comment contains one of the
demo category set's seeded terms, then applying `applyAutoCategory` from
`@expenses/shared` to it — not by directly assigning `category` or
`autoMatchedTerm` on the generated row.

#### Scenario: An auto-categorized seed entry matches what the matcher would produce

- **WHEN** the seed generator produces an entry intended to demonstrate
  auto-categorization
- **THEN** that entry's `category` and `autoMatchedTerm` are exactly what
  `applyAutoCategory` returns for its comment against the demo category set,
  not independently authored values
