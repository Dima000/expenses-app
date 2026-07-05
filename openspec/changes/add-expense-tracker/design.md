## Context

Greenfield, single-user personal expense tracker. The overriding requirement is **frictionless voice logging** — the owner will only keep this up if capturing a spending takes a couple of taps and a sentence. Stack is fixed by preference: React + Vite + shadcn/ui on the frontend, Firebase (Firestore, Firebase Auth, Cloud Functions, Secret Manager) on the backend.

Owner constraints that shaped this design:
- **Android** (no iOS Siri Shortcuts available).
- **Fire-and-forget** is fine — no need for conversational read-back/confirmation.
- **Category can be assigned later**, outside any AI tool.
- The **outcome** (voice logging) matters, not the tool used to get there.

An earlier iteration routed voice through the Claude app via a hosted MCP server. That has been **removed**: it was conversational and Claude-locked, and the frictionless, fire-and-forget goal needs none of that.

## Goals / Non-Goals

**Goals:**
- The smallest possible system that gives frictionless Android voice logging.
- One canonical write path (`recordSpending`) shared by every input adapter.
- Voice capture with no extra backend service and no per-entry cost.
- Instant save now, tidy-up (category) later.
- Clean separation of the human (web) auth boundary from the machine (REST) auth boundary.

**Non-Goals:**
- MCP server / Claude custom connector (removed).
- Multi-user, multi-currency, budgets, recurring expenses, analytics beyond a month total.
- Server-side speech recognition or AI parsing in v1 (browser handles speech; a simple parser extracts the amount).
- Telegram bot (explicitly a future extension, not in this change).
- A native mobile app (the web app is an installable PWA).
- Charts, yearly view, smart category guessing, and user-editable categories — all planned but out of scope for this change (see **Future Directions**).

## Decisions

### D1 — Money stored as whole-unit integers, fractional inputs rounded up
Amounts are always whole currency units. Store `amount` as a plain integer number of whole units; any fractional input (from voice or manual entry) is **rounded up** (ceiling) before storage — e.g. `12.50` → `13`. This keeps sums exact (the month total is a core feature) with no minor-unit/cents bookkeeping. Rounding is applied once, at the point of entry, via a shared helper.

Fixed category list (v1): **Groceries, Health, Sports, Pet, Relationships, Kid, Utilities, Other** — plus the reserved `uncategorized` state (see D4).

### D2 — One `recordSpending()` core, thin adapters
A single validated write function is the canonical way to create a spending. Adapters over it:
- **React app (incl. voice mic)** → writes via the Firebase **client** SDK (guarded by Auth + security rules). The voice path is a client-side capture that funnels into the same client write.
- **REST `POST /spending`** (shared-secret) → testing (curl), plus a bonus scripted-entry path. Uses the Admin SDK server-side.

Because the browser path writes client-side and the REST path writes via Admin SDK, validation (amount is a positive integer, category ∈ list ∪ `uncategorized`, required fields) is enforced in a shared module imported by both, and mirrored in Firestore security rules. Keep the category list and validation constants in one place.

### D3 — Voice capture in the app via the browser (Web Speech API)
The primary voice path is a **mic button in the PWA** using the browser's Web Speech API (SpeechRecognition). No external service, no Claude, no MCP, no per-entry cost. Chrome on Android has solid support.
- Alternative considered: MCP via Claude — removed (heavy, Claude-locked, conversational).
- Alternative considered: server-side transcription (Whisper) — unnecessary when the browser transcribes for free.
- Risk: Web Speech API support varies by browser. Mitigation: target Chrome/Android; the manual add form is always available as a fallback, and the mic button is hidden/disabled where the API is absent.

### D4 — Deferred categorization: capture now, categorize later
Because category can be assigned later, v1 voice does **not** classify. A voice entry is saved as `uncategorized`; the amount is extracted and the remaining utterance becomes the comment. The web app surfaces `uncategorized` spendings for later assignment.
- This removes all NLU from the critical path — no Claude API call in v1.
- `uncategorized` is a first-class category value the whole system understands.
- **`uncategorized` ≠ `Other`.** `Other` is a real, deliberately-chosen category in the fixed list; `uncategorized` is the "not yet assigned" state. Assigning an uncategorized entry may resolve it to any of the 8 fixed categories, including `Other`.

### D5 — Amount extraction is a simple parser, not AI
Extract the amount from the transcribed text with a small deterministic parser, then **round up** to a whole unit per D1. No AI needed for a single number. The rule is **first number wins** — predictable beats clever:

1. Scan the transcript left→right; the **first numeric token** is the amount. It accepts an optional leading currency symbol and an optional decimal part (pattern shape: `£?$?\d+(\.\d+)?`).
2. A decimal amount is rounded **up** (ceil); an integer is used as-is.
3. The **comment** is the rest of the transcript with the currency symbol and amount token stripped, trimmed.
4. **Numbers are taken literally** — `"1250"` means `1250`, not `12.50`. This matches the owner's habit of speaking whole amounts, and the confirmation toast (D6) catches the rare misread. The optional "two trailing digits ⇒ decimal" heuristic (`"12 50"` ⇒ `12.50`) is **deliberately not** implemented in v1.
5. **No confidence/plausibility threshold** — the only branch is *is there a number?* A large value (e.g. `1200` rent) is never blocked. When **no recognizable number** is found, the app does not invent one: it saves the entry with the amount flagged as needing correction and the full raw text as the comment, surfaced for a fix (fire-and-forget must never silently store a wrong amount — see Risks). The visible, one-tap-correctable toast (D6) is the safety net in place of a threshold.

Alternative considered: a Haiku parse for robustness on phrasings like "twelve fifty" — deferred; drop it in later only if the simple parser proves flaky. Keeps v1 dependency-free and free.

### D6 — Fire-and-forget UX with a correctable toast
Voice flow: tap mic → speak → entry saved → brief confirmation toast ("Logged £13 · uncategorized"). No multi-step confirmation dialog. Make the installed PWA icon open directly into a ready-to-listen state to minimize taps.

The toast is the safety net for the literal-parse choice in D5, so it must show the parsed amount and offer:
- **Undo** — remove the just-saved entry.
- **Edit** — open the **standard edit form** (amount, date, category, comment) for immediate correction.

The toast has **no category chips** — categorization is deferred by design (D4), so its primary home stays the categorize-later flow in the list. A user who wants to categorize immediately can via **Edit**, but that's the exception path, not the default. This keeps capture fire-and-forget while making both amount correction and optional immediate categorization one tap away.

### D7 — Two auth boundaries, two mechanisms
- **Human ↔ web app (incl. voice)**: Firebase Auth (Google sign-in); Firestore security rules restrict every document to the owner's UID.
- **Machine ↔ REST endpoint**: a single long-lived **shared secret** (Secret Manager), verified server-side, after which the Admin SDK writes with full privileges.
Firebase Auth is not used for the REST path (machine caller, no browser identity, tokens too short-lived to paste).

### D8 — Firestore data shape
A single top-level `spendings` collection; each doc: `{ amount: number (whole units), date: 'YYYY-MM-DD', comment: string, category: string (one of the 8 fixed values or 'uncategorized'), createdAt: serverTimestamp, ownerUid: string, source?: 'web'|'voice'|'rest' }`. Month queries filter on `date`. Leaning `YYYY-MM-DD` string for simple month filtering.

### D9 — Installable PWA
Ship a web manifest + service worker so the app installs to the Android home screen and launches full-screen, so "voice logging" feels like tapping an app icon, not opening a browser tab.

### D10 — Build sequence (risk-first)
1. Shared module (category list + `uncategorized` + validation) + `recordSpending()` core + REST endpoint + Firestore rules → verify with curl.
2. React/PWA web app: auth, month table, month nav, total card, manual CRUD, categorize-later flow.
3. Voice: mic button (Web Speech API) + amount extraction → save as `uncategorized`, fire-and-forget.

## Risks / Trade-offs

- **Web Speech API browser variance** → target Chrome/Android; feature-detect and hide the mic where unsupported; manual form is always available.
- **Wrong amount saved silently** (fire-and-forget + mis-transcription) → show the parsed result in the confirmation toast with a quick "undo/edit"; if the amount can't be parsed confidently, save with amount flagged/zero and comment = raw text so nothing is lost and it's easy to fix in the list.
- **Validation drift between client, server, and rules** → one shared validation/category module (D2), mirrored in security rules.
- **`uncategorized` backlog grows** → the categorize-later flow makes assignment fast (a filter/badge for uncategorized); acceptable for a personal app.
- **PWA launch friction on Android** → installable manifest + open-to-mic reduces it; revisit a home-screen widget only if needed.

## Resolved

- **Fixed category list**: Groceries, Health, Sports, Pet, Relationships, Kid, Utilities, Other (plus the `uncategorized` state).
- **Amounts**: whole units only; round up any fractional input (D1).

## Open Questions

None outstanding — the amount-parser rule is resolved in D5 and the confirmation-toast behavior in D6.

## Future Directions

Planned but explicitly **out of scope for this change**. Recorded so v1 decisions don't preclude them; each notes any forward-compatibility to preserve now.

- **Spending-by-category pie chart with drilldown/filter.** A chart of total spend per category for the selected period; clicking a slice filters the list to that category. No data-model change needed — category totals derive from existing records over the month/year queries.

- **Smart category guessing from comment text** (e.g. "lidl" → Groceries). A keyword/rule engine that suggests or auto-assigns a category from the comment, especially for `uncategorized` voice entries. *Forward-compat now:* keep the full raw utterance in `comment` (already the case) so rules have text to match, and keep categorization decoupled from capture so a suggestion layer can slot in without touching the capture path.

- **Yearly view.** View spendings and totals per year, not just per month. *Forward-compat now:* the `YYYY-MM-DD` date field already supports year-range queries; this extends the month navigation/aggregation rather than changing storage.

- **User-managed categories with icon + color.** Add/edit/delete categories, each carrying an icon and a color tag. This is the biggest structural shift: categories move from a hardcoded constant to owner-editable data (a `categories` Firestore collection), and each spending's `category` becomes a stable value into that set. *Forward-compat now:* (a) keep the category list behind the **single shared module** so its source can change from constant → Firestore in one place; (b) store `category` as a stable string value on each spending (not an index/position); (c) structure the "category ∈ allowed set" validation so "allowed set" can later become dynamic. Do **not** build the collection now — just avoid hardcoding the 8 values anywhere except the shared module.
