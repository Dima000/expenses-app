## Why

I want to track my personal spending and see it from any device, and — most importantly — log expenses **frictionlessly by voice**. Today there is no app; spending goes unrecorded because capturing it is too much effort. The goal is: speak a spending in a couple of taps and have it saved, then tidy up details (like category) later at my leisure.

## What Changes

- Introduce a **single-user** expense tracker with cloud-synced storage (Firestore).
- Define the **spending record** model: amount (stored as integer minor units), spending date, comment, and category — where category may be **`uncategorized`** so voice entries can be saved instantly and categorized later.
- Provide a **core write path** (`recordSpending()`) used by every input path, plus an authenticated **REST endpoint** (`POST /spending`) for testing and scripted/bonus entry.
- Build a **React + Vite + shadcn/ui web app**, installable as a **PWA**: current-month spending table (latest first), previous/next month navigation, month-total card(s), and manual add/edit/delete.
- Add **in-app voice capture**: a mic button using the browser's Web Speech API that transcribes speech, extracts the amount, and saves the entry fire-and-forget as `uncategorized`. This is the primary voice path — no external service, no Claude, no MCP.
- Add a **"categorize later" flow**: surface `uncategorized` spendings in the web app so I can assign categories after the fact.
- **REMOVED from scope**: the MCP server / Claude custom-connector voice path. It was conversational and Claude-locked; the frictionless goal doesn't need it.
- **Future extensions (not in this change, recorded for forward-compatibility — see `design.md` → Future Directions)**:
  - A Telegram bot as a second always-in-pocket capture channel, calling the same `recordSpending()`.
  - A spending-by-category pie chart with drilldown/filter.
  - Smart category guessing from comment text (e.g. "lidl" → Groceries).
  - A yearly view (spendings/totals per year).
  - User-managed categories with per-category icon and color (categories become owner-editable data).

## Capabilities

### New Capabilities
- `spending-tracking`: The spending data model (including the `uncategorized` category), Firestore persistence, the shared `recordSpending()` core, the authenticated `POST /spending` REST adapter, and the Firestore security rules / secret-based backend auth.
- `monthly-dashboard`: The installable React/PWA web app — Firebase Auth sign-in, the current-month spending table (latest first), previous/next month navigation, month-total card(s), manual create/edit/delete, and the "categorize later" flow for `uncategorized` spendings.
- `voice-capture`: In-app voice logging — a mic button (Web Speech API) that transcribes speech, extracts the amount, and saves a fire-and-forget spending as `uncategorized` via the client write path.

### Modified Capabilities
<!-- None — greenfield project, no existing specs. -->

## Impact

- **New project scaffolding**: React + Vite + shadcn/ui frontend, installable as a PWA; Firebase project (Firestore, Firebase Auth, Cloud Functions, Secret Manager).
- **New backend code**: `recordSpending()` core, REST Cloud Function, Firestore security rules. (No MCP server.)
- **External dependencies**: Firebase SDK (client + Admin); shadcn/ui + Tailwind; PWA manifest/service worker. Browser Web Speech API (no dependency, but browser-support-dependent).
- **Cost**: Firebase free tier is expected to cover single-user usage; voice capture has no per-entry cost (on-device/browser speech recognition, no Claude API call in v1).
