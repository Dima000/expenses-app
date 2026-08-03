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

The seed generator SHALL produce spendings covering the whole of the prior
calendar year plus the current calendar year up to and including "today"
(relative to the "today" value it is given). No generated entry SHALL be dated
after "today".

Volume SHALL be governed by per-category cadences rather than a fixed
entries-per-month count, and SHALL land in the range of roughly 30–45 entries
for any fully-covered month. A partially-covered month (the current month)
SHALL contain only the entries its cadences produce for the elapsed days, so
its volume is proportional to how far into the month "today" falls, rather than
a full month's volume compressed onto those days.

The generated set SHALL include at least one entry with `category` equal to
`uncategorized`, at least one entry with `needsReview` set to `true`, and at
least one entry dated "today". Every generated entry SHALL have
`source: 'web'`.

#### Scenario: Generated set spans the full prior year and the current year to date

- **WHEN** the seed generator is invoked with a given "today"
- **THEN** the earliest generated date falls in January of the prior calendar
  year, the latest generated date is no later than "today", and every month
  from January of the prior year through the current month contains at least
  one entry

#### Scenario: No entry is dated in the future

- **WHEN** the seed generator's output is inspected
- **THEN** no entry has a `date` later than the "today" value the generator was
  given

#### Scenario: A fully-covered month has a plausible volume

- **WHEN** the entries for any month other than the current one are counted
- **THEN** the count falls within roughly 30–45 entries

#### Scenario: The current month is proportional, not compressed

- **WHEN** the generator is invoked with a "today" early in a month (e.g. the
  2nd)
- **THEN** the current month contains only the few entries its cadences produce
  for those elapsed days, rather than a full month's worth of entries, and none
  of them is dated after "today"

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

### Requirement: Per-category placement is dense enough for the drilldown heatmap

The seed generator SHALL place entries using a per-category cadence such that,
for any fully covered month, at least two categories have entries on eight or
more distinct days of that month. This exists because the category drilldown's
month view renders a calendar heatmap of a single category's daily totals, so a
category appearing on only one or two days renders an almost entirely empty
calendar.

The generator SHALL also retain at least one category whose cadence yields
roughly one day per month, so that different drilldowns show visibly different
densities rather than all looking alike.

#### Scenario: At least two categories fill the heatmap

- **WHEN** the entries of any fully covered month are grouped by category
- **THEN** at least two categories have entries on eight or more distinct days
  of that month

#### Scenario: Density varies across categories

- **WHEN** the entries of any fully covered month are grouped by category
- **THEN** at least one category has entries on approximately one day of that
  month, so category drilldowns differ in density from one another

### Requirement: Entry placement and amounts are keyed by category and date

Placement and amounts SHALL be determined by each category's own cadence and
its own authored amount cycle — not by a counter shared across all categories.
That is, whether a category produces an entry on a given date, and what amount
that entry carries, depend only on that category and that date. Consequently,
changing one category's cadence SHALL NOT alter the date, category, or amount
of any entry belonging to a different category.

Amounts SHALL come from a fixed, authored list per category cycled by that
category's own occurrence index, rather than being computed as an arithmetic
function of a running index. This SHALL NOT introduce any source of randomness;
the generator remains a pure function of "today".

#### Scenario: Changing one category's cadence does not disturb others

- **WHEN** one category's cadence definition is changed and the generator is
  re-run for the same "today"
- **THEN** every entry belonging to a different category is unchanged in date,
  category, and amount

#### Scenario: Amounts within a category vary non-monotonically

- **WHEN** one category's entries for a fully covered month are read in date
  order
- **THEN** their amounts do not form a single monotonic arithmetic progression,
  so the heatmap's intensity varies rather than ramping linearly

