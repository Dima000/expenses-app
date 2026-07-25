## Why

Newly added categories and their keywords silently disappear, reverting to the eight bare defaults. The category subscription treats a cache-cold or offline "document absent" snapshot the same as a genuine first-run absence, so it re-seeds `DEFAULT_CATEGORIES` and — because the Firestore client uses an in-memory cache with no offline persistence — the queued seed write flushes on reconnect and overwrites the owner's real category set. This is active data loss, hit reliably every time the PWA is opened cold or offline.

## What Changes

- Fix destructive re-seeding: default categories are seeded **only** when the server authoritatively reports no categories document — never from a cached or offline snapshot. A cold/offline read can no longer trigger a seed write.
- Make seeding non-destructive: the seed write can never overwrite a categories document that already exists, so a stale/queued seed can never clobber newer data even if it races a reconnect.
- Add Firestore offline persistence (IndexedDB local cache) so cold, offline, and PWA launches read the owner's real data from the local cache instead of seeing an empty cache, and so writes made while offline are queued locally and sync automatically on reconnect.
- **BREAKING** (client data layer only): the Firestore instance is constructed via `initializeFirestore` with a persistent local cache instead of `getFirestore`; the on-disk cache format is managed by the SDK. No document schema or security-rule changes.

## Capabilities

### New Capabilities
- `offline-data-persistence`: the web/PWA client persists Firestore data locally so reads succeed offline and from a cold cache, and writes made offline are queued and synced on reconnect without data loss.

### Modified Capabilities
- `category-management`: the "One-time default category seeding" requirement is tightened so seeding keys off *server-authoritative* absence (not a cache/offline read) and the seed write is non-destructive, closing the re-seed data-loss path.

## Impact

- `web/src/lib/firebase.ts` — construct Firestore with `initializeFirestore` + `persistentLocalCache` (IndexedDB), keeping the emulator wiring.
- `web/src/lib/categories.ts` — `subscribeToCategories` gates seeding on a server-authoritative absent snapshot (ignore `fromCache`); seed write guarded so it cannot overwrite an existing document.
- Behavior of all Firestore reads/writes in the web app while offline (spendings + categories) improves as a side effect of enabling persistence.
- No changes to `functions/`, `firestore.rules`, `@expenses/shared`, or stored document shapes.
