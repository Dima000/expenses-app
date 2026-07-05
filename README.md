# Expenses

A single-user, **voice-first** personal expense tracker. Speak a spending in a
couple of taps and it's saved as `uncategorized`; tidy up the category later.

**Live app:** https://expenses-app-7007d.web.app

> Built spec-first — the full design trail (proposal → design decisions → specs →
> tasks) lives in [`openspec/changes/add-expense-tracker/`](openspec/changes/add-expense-tracker).

- **Web app**: React + Vite + shadcn/ui, installable as a PWA (Android).
- **Backend**: Firebase — Firestore, Firebase Auth (Google), Cloud Functions,
  Secret Manager.
- **Voice**: the browser's Web Speech API (no external service, no per-entry cost).

## Layout

```
shared/     @expenses/shared — categories, validation, round-up, types, amount parser
functions/  recordSpending() core + authenticated POST /spending REST endpoint
web/        the React PWA (auth, month dashboard, categorize-later, voice)
tests/      domain unit tests + Firestore rules tests + REST endpoint tests
firestore.rules   owner-scoped access + validation mirror
firebase.json     emulator + hosting + functions config
```

The **category list, validation, and round-up live only in `@expenses/shared`**
and are mirrored in `firestore.rules`. Change categories there and nowhere else.

## Prerequisites

- Node 20+
- Java 17+ (for the Firestore emulator)
- Firebase CLI (`npm i -g firebase-tools`), for deploy/emulators

## Local development

Works out of the box against the local emulators — no real Firebase project or
secrets needed (committed dev defaults live in `web/.env.development`):

```bash
npm install
npm run build:shared        # web/functions import @expenses/shared's built output

# Terminal 1 — emulators (Firestore, Functions, Auth, UI on :4000)
npm run emulators

# Terminal 2 — web app against the emulators
npm run dev
```

Open the printed Vite URL. The Auth emulator lets you "sign in with Google"
using a synthetic account, and data lives in the emulator, so the full flow —
manual entry, voice capture, month navigation, categorize-later — works with no
real project and no live data.

> To run against a real project instead, see *Connecting a real Firebase project*
> below and set `VITE_USE_EMULATORS=false` in `web/.env.local`.

## Tests

```bash
node --test tests/domain.test.mjs                                              # pure domain logic
npx firebase emulators:exec --only firestore "node --test tests/rules.test.mjs"     # security rules
npx firebase emulators:exec --only functions,firestore "node --test tests/rest.test.mjs"  # REST endpoint
```

## Connecting a real Firebase project

1. Create a project in the [Firebase console](https://console.firebase.google.com/)
   and enable **Firestore**, **Authentication → Google provider**,
   **Cloud Functions**, and **Secret Manager**.
2. Put the project id in `.firebaserc` (replace `expenses-app-dev`).
3. Copy `web/.env.example` → `web/.env.local`, fill the values from
   *Project settings → Your apps → SDK config*, and set `VITE_USE_EMULATORS=false`.
4. Set `OWNER_UID` (your Firebase Auth UID) as a Functions param — see below.

## The REST endpoint

`POST /spending` writes a spending via the shared `recordSpending()` core, for
testing and scripted entry. It requires the shared secret.

> **Status:** deployed but **private** (`invoker: 'private'` in `functions/src/index.ts`).
> Cloud Run blocks unauthenticated callers at the network layer, so the endpoint
> is not reachable yet — the web + voice app does not use it. To enable it,
> change `invoker` to `'public'` and `firebase deploy --only functions`; the
> shared-secret check is then the auth gate. The web app and voice logging work
> regardless of this setting.

```bash
curl -X POST "$FUNCTIONS_URL/spending" \
  -H "authorization: Bearer $SPENDING_REST_SECRET" \
  -H "content-type: application/json" \
  -d '{"amount": 12.34, "date": "2026-07-04", "comment": "lunch", "category": "Groceries"}'
# → {"id":"<record id>"}   (amount stored as 13, rounded up)
```

Responses: `200` `{id}` on success · `401` missing/wrong secret · `400` invalid
payload (`{error, details}`) · `405` non-POST.

Against the emulator the URL is
`http://127.0.0.1:5001/<project>/us-central1/spending` and the local secret is
in `functions/.secret.local`.

## Deploy

```bash
npm run build:web
# Provision the REST secret (first time), then set the owner uid param:
firebase functions:secrets:set SPENDING_REST_SECRET     # prompts for the value
firebase deploy --only firestore:rules,functions,hosting
```

`OWNER_UID` is a non-secret param: set it in `functions/.env` (committed default)
or `functions/.env.<projectId>` for the deployed project.

## Rotating the REST secret

The endpoint auth is a single long-lived shared secret in Secret Manager
(`SPENDING_REST_SECRET`). To rotate:

```bash
firebase functions:secrets:set SPENDING_REST_SECRET     # writes a new version, prompts for value
firebase deploy --only functions                        # binds functions to the new version
firebase functions:secrets:prune                        # (optional) remove old, unused versions
```

Update any caller (curl scripts, future bots) with the new value. There is no
overlap window — set, deploy, then switch callers.

## Installing as a PWA (Android)

Open the deployed URL in Chrome on Android → menu → **Add to Home screen**. The
app installs with an icon and launches full-screen. Long-pressing the icon
offers a **Log by voice** shortcut that opens straight into listening.

## Future extensions

Recorded in `openspec/changes/add-expense-tracker/design.md → Future Directions`;
out of scope for this change:

- **Telegram bot** — a second always-in-pocket capture channel that calls the
  same `recordSpending()` core (the REST/Admin write path is already the shared
  seam it would plug into).
- Spending-by-category pie chart, yearly view, smart category guessing from the
  comment text, and user-managed categories with icon + color.
```
