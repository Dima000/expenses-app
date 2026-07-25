## Context

Newly added categories and their keywords disappear, reverting to the eight bare defaults. Root cause: `subscribeToCategories` (`web/src/lib/categories.ts`) seeds `DEFAULT_CATEGORIES` whenever a snapshot reports `!snap.exists()`, without distinguishing a *server-authoritative* absence (genuine first run) from a *cache-cold / offline* absence. The Firestore client is created with `getFirestore(app)` — an in-memory cache with no offline persistence — so every cold or offline start (notably the installed PWA) shows the document as absent, seeds the defaults, and the queued seed write flushes on reconnect, overwriting the owner's real category set.

Constraints:
- Single-user-per-owner app used by a handful of friends; each owner has their own `users/{uid}` document (no cross-owner data sharing), and each owner uses one device at a time.
- All app writes are single-document operations (`setDoc` / `addDoc` / `updateDoc`); the app uses no Firestore transactions. Voice/REST writes go through a Cloud Function and inherently require network.
- No changes to `firestore.rules`, stored document shapes, `functions/`, or `@expenses/shared`.

## Goals / Non-Goals

**Goals:**
- Stop destructive re-seeding: seed defaults only on a server-confirmed absence, never from a cached/offline snapshot, and never let a seed write overwrite an existing categories document.
- Enable Firestore offline persistence (IndexedDB) so cold, offline, and PWA starts read the owner's real data from the local cache, and offline writes queue durably and sync on reconnect.
- Keep the local-emulator development wiring working.

**Non-Goals:**
- Offline Firestore **transactions** (`runTransaction`) — these require a live server round-trip and cannot be queued offline. The app uses none, so this is not a regression.
- Conflict-free concurrent editing of the same category set from two devices at once. The category writers do a whole-array read-modify-write (last-write-wins). Given one-device-per-owner usage this is acceptable; the upgrade path (field-level `arrayUnion`/`arrayRemove`) is recorded below but out of scope here.
- Any UI for offline status/banners. Firestore serves cached data transparently; no blocking "you are offline" screen.

## Decisions

### D1: Gate seeding on server authority (`!snap.metadata.fromCache && !snap.exists()`)

Seed only when a snapshot is both server-confirmed (`metadata.fromCache === false`) and absent (`!snap.exists()`). A cached/offline "absent" snapshot is ignored for seeding purposes — the code simply waits for the server snapshot. This is the core fix and is independent of persistence: an empty or cold cache no longer proves the document is absent.

- Alternative — probe with a one-time `getDocFromServer` before seeding: extra round-trip and a second code path; the snapshot metadata already carries the needed signal. Rejected.
- Alternative — a blocking "offline" screen so users can't write offline: does **not** remove the need for this guard (the subscription still fires the cache-cold absent snapshot and could still seed), adds `navigator.onLine` gating that is unreliable on captive portals, and defeats PWA usability. Rejected.

### D2: Non-destructive seed write

Ensure a seed can never clobber existing data even if one races a reconnect. Because D1 already restricts seeding to online, server-confirmed-absent state, a create-guarded write is a lightweight belt-and-suspenders: perform the seed as a create-if-absent (e.g. a transaction that writes only when the document does not exist, or an equivalent guarded write). The existing per-operation writers keep using `setDoc(..., { merge: true })` unchanged — only the initial seed is guarded.

- Alternative — rely on D1 alone: probably sufficient in practice, but the guard is cheap insurance against any residual race and makes the invariant explicit. Kept.

### D3: Enable IndexedDB persistence via `initializeFirestore` + `persistentLocalCache`

Replace `getFirestore(app)` with `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`. The multi-tab manager avoids the single-tab persistence error when an owner has the app open in more than one tab. The emulator connection (`connectFirestoreEmulator`) still applies to the returned instance in development. Reads are served from the durable cache on cold/offline start; single-document writes queue in IndexedDB and sync automatically on reconnect.

- Alternative — `enableIndexedDbPersistence` (legacy API): deprecated in favour of the `localCache` config on `initializeFirestore`. Rejected.
- Alternative — keep in-memory cache and add a manual offline banner: worse UX, more code, and still needs D1. Rejected.

### D4: Recorded upgrade path for multi-device category edits (not implemented)

If concurrent multi-device editing ever becomes real, migrate the category writers from whole-array `setDoc` to field-level `arrayUnion`/`arrayRemove` operations, which merge correctly through the offline queue and avoid whole-document last-write-wins. Left out of scope by the one-device-per-owner assumption.

## Risks / Trade-offs

- **[Whole-array last-write-wins across two simultaneous offline devices]** → Out of scope by usage (one device per owner); documented upgrade path in D4.
- **[Brand-new owner opening the app offline sees no categories]** → With D1, a first-ever owner with an empty cache who is offline won't be seeded until they reach the server. This is an acceptable edge (a first run with no connectivity and no prior data); categories appear as soon as they connect.
- **[IndexedDB unavailable / private-browsing quota]** → `persistentLocalCache` can fail to initialize in some environments; initialization should degrade gracefully (fall back to memory cache) so the app still runs, just without offline caching.
- **[Stale `shared/dist` masking behavior in dev]** → Unrelated to this fix but noted: `web` bundles `@expenses/shared` from its gitignored `dist`; rebuild shared after editing it. No code change here.

## Migration Plan

1. Ship D1 (seed guard) and D2 (non-destructive seed) together — this alone stops the data loss.
2. Ship D3 (persistence) — enables offline reads/writes and keeps the cache warm so the false-absent path is effectively never hit.
3. Verify against the emulator: fresh owner seeds once; reload does not re-seed; simulated offline cold start does not re-seed and preserves data; an offline add syncs on reconnect.
4. Rollback: D3 can be reverted independently (back to `getFirestore`) without affecting D1/D2; the SDK discards the local cache. D1/D2 are pure logic reverts.

## Open Questions

- None blocking. (Graceful-degradation behavior when IndexedDB init fails is settled in the Risks section: fall back to memory cache.)
