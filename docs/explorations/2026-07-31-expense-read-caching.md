# Caching Firestore reads for the breakdown screen

- **Date:** 2026-07-31
- **Status:** Parked — not being actioned now, revisit when read volume or cost
  actually becomes a concern.
- **Trigger:** Split out of the
  [expense breakdown screen and datastore exploration](2026-07-26-expense-breakdown-screen-and-datastore.md)
  during a follow-up discussion about the breakdown screen's navigation, once
  period state (`unit`/`anchor`) was decided to live in the URL as query params.

> This is a thinking document, not a proposal. Nothing here is committed to.

---

## The question that started this

If a period (e.g. a year view, ~2,400 docs) lives in the URL and the page is
refreshed, does that risk exploding read costs? Answered inline in the parent
exploration: no — at this app's scale (10 users), even dozens of refreshes a
day stay far under Firestore's free tier. See that document's "Sizing reality
check" and the follow-up discussion for the numbers.

## The follow-up idea: a TTL cache

Raised alongside that: a short-lived (e.g. 10-minute) cache for reads made
while online, invalidated whenever a new expense is added.

## Why this needs a rethink before it's built

The app already has two caching layers doing most of this job for free:

```
persistentLocalCache (web/src/lib/firebase.ts)
  → IndexedDB-backed. Survives refresh. Serves instantly offline.

onSnapshot listener (web/src/lib/spendings.ts: subscribeToMonth)
  → Once a listener is open, it is ALREADY a live cache: local re-renders
    are free, and a write (from any device) pushes an update through the
    open listener at zero extra read cost. No TTL or manual invalidation
    needed — that's the whole point of a snapshot listener over a
    one-shot getDocs() read.
```

A bolted-on TTL cache with manual invalidation-on-write is the right shape
for a **request/response** read model (e.g. `getDocs()` called fresh each
time), where nothing tells the client "this is now stale" without asking
again. It's largely redundant on top of a **listener** model, where staleness
already can't happen while the listener is open — the server pushes the
update.

## Where the actual read cost comes from

Not from lack of caching — from **listener churn**. Every `subscribeToMonth`
call opens a brand-new query/listener with no reuse. Arrowing
month → month → back to the first month reopens three fresh listeners and
re-reads all three ranges from the server, even though the first one was
open moments ago. Same will apply to `subscribeToRange` once the breakdown
screen generalises it to month/year ranges.

## If/when this gets picked back up

The lever worth reaching for first is **listener lifecycle/reuse** — e.g. a
small LRU keeping the last N period listeners open (or debouncing
teardown) instead of a bare `useEffect` that unsubscribes on every
`(user, month)` change — not a generic TTL cache layered on top of an
already-live sync mechanism.

Revisit only if real usage shows listener churn is costing meaningful reads
in practice — no evidence of that yet, and the numbers in the parent
document suggest there won't be for a long time.
