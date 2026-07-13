## Context

Today the web voice flow (`VoiceButton.tsx`) is fire-and-forget: on transcript it
parses, calls `createSpending` immediately, and shows a toast with Undo/Edit. The
edit form (`SpendingForm.tsx`) already exists and is opened from `App.tsx` via
`openEdit`. `SpendingForm` supports two modes today — **edit** (seeded from an
existing `Spending`) and **add** (blank, with an optional `defaultDate`). The
`needsReview` / amount-0 concept is a first-class data flag validated in
`shared/`, written by the canonical server path `recordSpending`, and rendered as
an amber "?" in `SpendingTable`.

This change moves the web voice path from "save then correct" to "review then
save" (B1), while leaving the non-interactive server ingress untouched.

## Goals / Non-Goals

**Goals:**
- Speaking opens the prefilled modal; no write happens until Save. Cancel = no trace.
- Preserve capture provenance: a saved voice review still records `source: 'voice'`.
- Reuse the existing `SpendingForm` rather than build a second modal.
- Keep `needsReview`/amount-0 flagged ingress intact for REST/Telegram (no human, no modal).

**Non-Goals:**
- Push-to-talk / hold-to-record — explicitly deferred; the tap gesture and the
  single-shot `useSpeechRecognition` hook are unchanged.
- Any change to `shared/` validation/types, `recordSpending`, or the
  `SpendingTable` "?" rendering.

## Decisions

**D1 — Reuse `SpendingForm` with a new add-mode prefill, not a new modal.**
Add an optional `prefill` prop carrying `{ amount?, comment?, category? }` used only
when `editing` is absent. `App.tsx` holds the prefill in state alongside the
existing `editing`/`formOpen`. Voice sets the prefill and opens the form.
_Alternative:_ a bespoke "confirm voice" dialog — rejected as duplicate UI; the
add/edit form already validates amount, date, category, and comment.

**D2 — Empty/unparseable transcript prefills a blank amount, no flagged row.**
When the parser returns `needsReview` (no number found), the web path opens the
modal with amount blank and the raw text as the comment. The owner fills or cancels
— the modal is the review, so the web path never persists a flagged row.
_Alternative:_ keep writing amount-0 + flag as today — rejected; that is the
fire-and-forget behavior we are removing for the interactive path.

**D3 — `source: 'voice'` on Save.** Provenance reflects origin, not the correction
step. `SpendingForm` currently hardcodes `source: 'web'` in its add branch, so the
save path must carry the source through when the add originated from voice.
_Alternative:_ mark it `'web'` because a human confirmed it — rejected; loses the
voice origin for later analytics.

**D4 — `autoStart` (PWA shortcut) funnels through the same flow.** It auto-listens
on mount, then opens the prefilled modal exactly like a tap. No separate code path.

## Risks / Trade-offs

- **Extra tap to log a spending** → Accepted: the whole point is deliberate review;
  the amount is pre-filled so it is one confirm tap in the common case.
- **`SpendingForm` add-branch hardcodes `source: 'web'`** → the save path must thread
  the source through so voice-originated saves stay `'voice'` (D3). Small, contained edit.
- **Spec reversal** (removing a stated no-multi-step-dialog decision) → scoped to the
  web voice path only; the non-interactive ingress requirement is added to make the
  boundary explicit and prevent accidental future removal.

## Open Questions

_None — scope and decisions settled during exploration._
