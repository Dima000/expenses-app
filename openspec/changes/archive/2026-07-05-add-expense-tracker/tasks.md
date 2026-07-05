## 1. Project & Firebase setup

- [x] 1.1 Scaffold the repo: Vite + React + TypeScript app and a `functions/` workspace
- [x] 1.2 Add and configure Tailwind + shadcn/ui in the web app
- [x] 1.3 Create the Firebase project; enable Firestore, Firebase Auth (Google provider), Cloud Functions, and Secret Manager _(project `expenses-app-7007d` created; Firestore, Auth/Google, Functions, and Secret Manager all enabled and deployed to)_
- [x] 1.4 Add Firebase client config to the web app and Firebase Admin SDK to `functions/`
- [x] 1.5 Configure local emulators (Firestore, Functions, Auth) for development

## 2. Shared domain module

- [x] 2.1 Define the fixed category list as a single exported constant — Groceries, Health, Sports, Pet, Relationships, Kid, Utilities, Other — plus the reserved `uncategorized` value
- [x] 2.2 Implement shared validation (amount is a positive whole integer, category ∈ list ∪ `uncategorized`, required fields present)
- [x] 2.3 Add a round-up helper that ceilings any fractional amount to a whole unit (e.g. `12.34` → `13`), applied once at entry
- [x] 2.4 Define the spending record type and Firestore document shape

## 3. Core write path + REST adapter (curl-testable backend)

- [x] 3.1 Implement `recordSpending()` using the Admin SDK and shared validation, writing to `spendings` with `createdAt`, `ownerUid`, and `source`
- [x] 3.2 Implement the `POST /spending` Cloud Function that verifies the shared secret and calls `recordSpending()`
- [x] 3.3 Provision the shared secret in Secret Manager and wire it into the function _(wired via `defineSecret`; local secret in `functions/.secret.local`; prod provisioning documented in README)_
- [x] 3.4 Return `401` for missing/incorrect secret; return created record id on success
- [x] 3.5 Verify end-to-end with curl: authorized write succeeds, unauthorized write rejected, invalid payloads rejected _(verified via `tests/rest.test.mjs` against the functions emulator — 6/6 pass)_

## 4. Firestore security rules

- [x] 4.1 Write rules restricting `spendings` reads/writes to the owner's UID
- [x] 4.2 Mirror core validation in rules (amount is a positive whole integer, category ∈ list ∪ `uncategorized`, required fields) for the client write path
- [x] 4.3 Test rules: owner allowed; other/unauthenticated identities denied; invalid client writes denied _(verified via `tests/rules.test.mjs` — 6/6 pass)_

## 5. Web app — auth & data layer

- [x] 5.1 Implement Google sign-in and a signed-out gate (sign-in screen when unauthenticated)
- [x] 5.2 Implement Firestore read/query for a given month, ordered latest-first
- [x] 5.3 Implement client-side create/edit/delete via the Firebase client SDK using the shared validation

## 6. Web app — monthly dashboard UI

- [x] 6.1 Build the current-month spending table (amount, date, category, comment), latest on top, with an empty state
- [x] 6.2 Build previous/next month navigation defaulting to the current month, with a month label
- [x] 6.3 Build the month-total card that recomputes on month change and on add/edit/delete
- [x] 6.4 Build the add/edit spending form (amount, date, category select, comment) and delete-with-confirm
- [x] 6.5 Verify cross-device sync: a spending added on one client appears on another for the same owner _(verified on-device against the live deployment)_

## 7. Categorize-later flow

- [x] 7.1 Surface `uncategorized` spendings (filter/badge/count) so they are easy to find
- [x] 7.2 Provide quick category assignment for an uncategorized spending, persisting the change so it leaves the uncategorized set

## 8. Installable PWA

- [x] 8.1 Add a web app manifest (name, icons, theme) and register a service worker
- [x] 8.2 Verify installability on Android (home-screen icon, full-screen launch) _(verified on-device: installs with icon, launches full-screen)_
- [x] 8.3 Make the installed app open into a ready-to-log state to minimize taps

## 9. Voice capture

- [x] 9.1 Add a mic control using the Web Speech API; feature-detect and hide/disable it where unsupported
- [x] 9.2 Implement the deterministic amount-extraction parser (amount out, remainder as comment)
- [x] 9.3 On capture, save fire-and-forget as `uncategorized` via the client write path with a brief confirmation toast (with undo/edit)
- [x] 9.4 Handle the ambiguous-amount case: preserve raw text and flag for correction rather than storing a wrong amount
- [x] 9.5 End-to-end voice test on Chrome/Android: speak a spending and confirm it appears in the current-month table and in the uncategorized set _(verified on-device on Chrome/Android)_

## 10. Wrap-up

- [x] 10.1 Document the secret-rotation procedure for the REST endpoint (update Secret Manager)
- [x] 10.2 Write a short README (setup, deploy, PWA install, curl example)
- [x] 10.3 Note the Telegram bot as a documented future extension (calls the same `recordSpending()`)
