## Context

The dashboard (`web/src/App.tsx`) filters the month's spendings through a single
boolean, `onlyUncategorized`. The visible list is computed as:

```ts
const visible = onlyUncategorized ? spendings.filter(isUncategorized) : spendings;
```

A single "Uncategorized" toggle button drives it. We now need two more quick
filters (Today, Yesterday). The filters are **exclusive** — at most one is
active at a time. `web/src/lib/date.ts` already provides `todayString()`
returning local `YYYY-MM-DD`, matching the `date` field on `Spending`.

## Goals / Non-Goals

**Goals:**
- Add Today and Yesterday quick filter buttons alongside Uncategorized.
- Make the quick filters exclusive — one active at a time; re-clicking clears it.
- Keep the current behaviour when nothing is selected (show the whole month).
- No Firestore query/index changes — filter the already-loaded month client-side.

**Non-Goals:**
- Additional category filters or arbitrary date-range pickers (Uncategorized is
  the only category-oriented filter for now).
- Persisting selected filters across reloads or navigation.
- Cross-month behaviour (e.g. auto-switching the month when Today is picked).

## Decisions

### Represent the active filter as a single nullable id

Replace `onlyUncategorized: boolean` with `activeFilter: FilterId | null` where
`FilterId = 'uncategorized' | 'today' | 'yesterday'`. Clicking a filter selects
it (deselecting any other); clicking the active filter clears it to `null`.
`null` preserves today's "show the whole month" behaviour.

- **Alternative considered:** a `Set<FilterId>` with OR/union combination.
  Rejected — the desired UX is exclusive single-select, so a nullable single id
  is simpler and models the state exactly.

### Each filter is a predicate; visible = the active predicate

Define a small map from filter id to a `(s: Spending) => boolean` predicate:

```ts
const predicates: Record<FilterId, (s: Spending) => boolean> = {
  uncategorized: isUncategorized,
  today: (s) => s.date === todayString(),
  yesterday: (s) => s.date === yesterdayString(),
};
```

Visible list:

```ts
const visible = activeFilter ? spendings.filter(predicates[activeFilter]) : spendings;
```

### Add `yesterdayString()` to `date.ts`

Mirror the existing `todayString()` using local time so it lines up with how
dates are stored and how `todayString()` behaves:

```ts
export function yesterdayString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toDateString(d);
}
```

`Date.setDate` handles month/year rollover correctly.

### Button rendering: keep the border box to avoid layout shift

Render the three buttons in the existing filter row at `size="sm"`. The
`default` button variant has no border while `outline` has a 1px border, so
swapping variants on toggle shifts the row by a pixel. Instead, keep every
filter button on `variant="outline"` (border always present) and layer an
active-state className (`border-primary bg-primary text-primary-foreground
hover:bg-primary/90`) when the filter is active — only the border/background
colour changes, not the box size. Keep the uncategorized count badge. The
Uncategorized button keeps its existing disabled rule (no uncategorized rows and
not currently active); Today/Yesterday need no disabled state.

## Risks / Trade-offs

- [Date filters can appear to "do nothing" when viewing a past month] → Expected
  per spec (they filter the loaded month); documented in the spec scenario. Not
  gating the buttons keeps the UI simple; revisit if it confuses users.
- [`todayString()`/`yesterdayString()` are evaluated during render] → They read
  the clock each render, which is cheap and always current; no memoization of the
  date string needed. The `visible` computation stays memoized on
  `spendings`/`activeFilters`.

## Migration Plan

Pure front-end change, no data or schema migration. Ships behind a normal PR;
rollback is reverting the commit.
