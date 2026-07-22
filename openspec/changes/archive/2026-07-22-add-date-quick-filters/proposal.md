## Why

The monthly dashboard currently offers a single "Uncategorized" quick filter. When reviewing recent activity, the owner often wants to look at just today's or yesterday's spendings, which today requires scanning the whole month table. Adding **Today** and **Yesterday** quick filters alongside the existing Uncategorized filter makes the common "what did I spend recently / did I log everything?" review fast.

## What Changes

- Add two new quick filter buttons to the dashboard: **Today** and **Yesterday**, filtering the visible spendings to those dated on the current day and the previous day (local time), respectively.
- Make the quick filters **exclusive**: at most one filter is active at a time; activating one deactivates any other, and re-activating the active filter clears it. With no filter active, all spendings for the selected month are shown.
- The existing **Uncategorized** filter becomes one of the exclusive filters. It remains the only category-oriented quick filter for now.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `monthly-dashboard`: adds a "Quick spending filters" requirement defining the Today and Yesterday filters and the exclusive (single active filter) selection rule across all quick filters (which now includes the existing uncategorized filter).

## Impact

- `web/src/App.tsx`: replace the single `onlyUncategorized` boolean with an exclusive `activeFilter` (one id or none); compute the visible list from the active filter's predicate.
- `web/src/lib/date.ts`: add a `yesterdayString()` helper (a `todayString()` already exists).
- Filters operate on the already-loaded month; a date filter for a day outside the selected month simply yields no matches. No Firestore query or index changes.
