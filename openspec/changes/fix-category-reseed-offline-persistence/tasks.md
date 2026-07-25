## 1. Stop destructive re-seeding (data-loss fix)

- [x] 1.1 In `web/src/lib/categories.ts`, change the seed condition in `subscribeToCategories` so defaults are seeded only on a server-authoritative absence: require `!snap.metadata.fromCache && !snap.exists()`. A cached/offline absent snapshot must not seed and must not queue a write; simply wait for the server snapshot (do not call `onData(DEFAULT_CATEGORIES)` off a `fromCache` absent snapshot in a way that could trigger a write).
- [x] 1.2 Make the seed write non-destructive (D2): perform it as a create-if-absent (e.g. a transaction that writes only when the doc does not exist), so a seed that races a reconnect cannot overwrite an existing categories document. Leave the per-operation writers (`writeCategories` with `{ merge: true }`) unchanged.
- [x] 1.3 Preserve the existing invariant: once the document exists, never re-seed — including when the owner has deleted some or all categories.

## 2. Enable Firestore offline persistence

- [x] 2.1 In `web/src/lib/firebase.ts`, replace `getFirestore(app)` with `initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) })`, importing the new symbols from `firebase/firestore`.
- [x] 2.2 Degrade gracefully if IndexedDB persistence cannot initialize (e.g. private browsing / unsupported): fall back to a memory cache so the app still runs without offline caching.
- [x] 2.3 Keep the emulator wiring: `connectFirestoreEmulator` still applies to the returned instance when `VITE_USE_EMULATORS === 'true'`.

## 3. Verify (emulator + offline simulation)

- [x] 3.1 Fresh owner: server-confirmed no document → defaults seeded exactly once with stable ids and empty terms.
- [x] 3.2 Reload after deletion: an owner who deleted categories and reloads is NOT re-seeded; their current set is preserved.
- [x] 3.3 Cold/offline start: with the client offline and a cache-cold (or emptied) cache, the first categories snapshot (fromCache, absent) does NOT seed and does NOT queue a write; when the server snapshot arrives, real categories and keywords are shown unchanged.
- [x] 3.4 Offline write round-trip: add a category/keyword (and a spending) while offline → reflected locally immediately, survives an offline reload, and syncs to the server automatically on reconnect with no lost writes.
- [x] 3.5 Confirm no changes were needed to `firestore.rules`, stored document shapes, `functions/`, or `@expenses/shared`; run the existing domain unit tests.

## 4. Wrap up

- [x] 4.1 Rebuild `@expenses/shared` if touched (it is not expected to change here) and typecheck the web build.
- [ ] 4.2 Manual smoke test in the installed/served PWA: cold open shows real data (not bare defaults), added categories and keywords persist across reloads.
