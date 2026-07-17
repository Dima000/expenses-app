## Context

The web app renders the current month from a live Firestore snapshot
(`subscribeToMonth`), already ordered `date desc` with a same-day creation-time
tiebreak. The table (`SpendingTable.tsx`) leads with Amount and shows the raw
`YYYY-MM-DD` date; the add form (`SpendingForm.tsx`) has separate Amount and
Comment inputs; and `App.tsx` initializes `spendings` to `[]`, so before the
first snapshot arrives the table's empty-state renders and then jumps when data
loads. These are display/input refinements — no data model, query, or security
changes.

## Goals / Non-Goals

**Goals:**
- Date-first table with a `7 Jun`-style short date, keeping true-date sort.
- Client-side category sort that is reversible back to the date default.
- Single free-text field for amount+comment on the add form, parsed on submit.
- A distinct loading state so the initial render doesn't flash empty and jump.

**Non-Goals:**
- No change to Firestore schema, indexes, or the `date desc` query.
- No change to voice capture or REST paths beyond what they already reuse.
- No server-side sorting or persisted sort preference.
- Edit mode keeps its discrete amount/comment fields (unchanged).

## Decisions

- **Short date formatting** — Add a `shortDate(dateStr)` helper in
  `web/src/lib/date.ts` that parses the fixed-width `YYYY-MM-DD` string and
  returns `"7 Jun"` via `toLocaleDateString(undefined, { day: 'numeric', month: 'short' })`.
  Parse the string parts explicitly (not `new Date(str)`) to avoid UTC-shift
  off-by-one on local dates, consistent with the existing helpers. The stored
  value and sort key stay the raw date string.

- **Category sort is client-side and reversible** — Keep the snapshot's
  `date desc` array as the source of truth. Hold a small sort state in
  `SpendingTable` (`'date'` default vs `'category'`); when `'category'`, render a
  `.slice().sort()` copy keyed by category with the existing date order as the
  stable tiebreak. Clicking the Category header toggles it on; toggling off (or a
  third click) returns to `'date'`. Chosen over adding a Firestore `orderBy`
  because the month set is small, it needs no new composite index, and it keeps
  the default ordering untouched.

- **Free-text parse on add only** — Replace the add form's Amount + Comment
  inputs with one text input. On submit, a pure helper `parseAmountComment(text)`
  extracts the **first** number via a regex (`/-?\d+(?:[.,]\d+)?/`, normalizing a
  decimal comma) as the amount and returns the text with that one match removed
  and whitespace collapsed as the comment. The result feeds the existing
  `validateSpending` / `createSpending` path unchanged, so round-up and
  validation behavior are identical. Edit mode still binds discrete fields, so
  `SpendingForm` branches its rendered inputs on `editing`. The helper lives in a
  small lib module so it is unit-testable without the DOM.

- **Loading state via a nullable initial value** — Represent "not loaded yet" as
  `spendings === null` in `App.tsx` (initialize to `null`, set to `[]`/rows on
  the first snapshot, reset to `null` when there is no user or the month
  changes). Pass a `loading` boolean to `SpendingTable`; when loading it renders
  a lightweight indicator (reusing the existing `Loading…` treatment) instead of
  the empty-state. Chosen over a separate `loading` flag to make "pending" and
  "empty" unambiguous in one value.

## Risks / Trade-offs

- **Ambiguous free-text (no number / multiple numbers)** → "first number" rule is
  explicit per the issue; if no number is found the amount is empty and the
  existing validation surfaces the error, so behavior degrades gracefully rather
  than guessing.
- **Decimal comma vs thousands separator** ("1,5" vs "1,000") → normalize a single
  `,` between digits to a decimal point; document the first-match rule in a
  comment and cover both in unit tests to lock the intended behavior.
- **Category sort loses the newest-first feel within a category** → acceptable:
  date order is preserved as the in-category tiebreak, and the default view is
  unchanged; sort is an explicit opt-in.

## Migration Plan

Pure front-end change shipped in one PR; no data migration. Rollback is reverting
the PR. No feature flag needed.

## Open Questions

- None blocking. Sort affordance (header click vs an explicit control) is a small
  UI choice left to implementation, matching the existing table styling.
