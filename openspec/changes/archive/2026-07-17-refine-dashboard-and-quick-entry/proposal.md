## Why

Day-to-day logging and reading of spendings has some friction: the table leads
with the amount rather than the date (which is how the owner scans the month),
dates are shown in raw `YYYY-MM-DD`, categories can't be sorted, manual entry
splits amount and comment into two fields, and opening the PWA flashes an empty
state before the live data arrives. These are small UX tweaks (GitHub issue #14)
that make the app faster to read and quicker to log into.

## What Changes

- **Table column order & date format**: Make **Date** the first column,
  formatted as `Day MonthShort` (e.g. `7 Jun`), then **Amount**, **Comment**,
  and **Category**. The underlying sort stays chronological by the real date.
- **Sortable category column**: Let the owner sort rows by category. Descending
  date remains the default ordering; toggling category sort is an explicit,
  reversible action that reverts to the date default.
- **Free-text quick entry**: Replace the separate Amount and Comment inputs on
  the add form with a single free-text field. On submit, the first number in
  the text becomes the amount and the remaining trimmed text becomes the
  comment. Date and category stay as their own inputs. (Edit mode keeps its
  discrete fields.)
- **Initial loading state**: While the first month snapshot is loading after the
  PWA opens, show a loading indicator instead of the empty-state message so the
  page doesn't flash empty and jump when data arrives.

## Capabilities

### New Capabilities

<!-- None: all changes refine existing dashboard behavior. -->

### Modified Capabilities

- `monthly-dashboard`: The current-month table requirement changes its column
  order, adds a short human date format, and adds category sorting with a
  date-default; manual spending management gains a free-text quick-entry parse
  for new spendings; and a new loading-state behavior is added for the initial
  data fetch.

## Impact

- **Code**: `web/src/components/SpendingTable.tsx` (columns, date format, category
  sort), `web/src/components/SpendingForm.tsx` (free-text field + parse for add
  mode), `web/src/App.tsx` (loading flag for the first snapshot),
  `web/src/lib/date.ts` (short date formatter), and a small text-parsing helper.
- **Data**: No schema, Firestore, or query changes — display and input only.
- **Tests**: Domain unit tests for the free-text parser and the short date
  formatter.
