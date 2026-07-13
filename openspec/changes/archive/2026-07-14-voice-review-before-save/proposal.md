## Why

The web voice flow saves a spending fire-and-forget the instant recognition ends,
then offers correction via an Undo/Edit toast. Misheard amounts, wrong words, or a
stray tap all write a row first and ask questions later. The owner wants to review
and edit the parsed values **before** anything is committed.

## What Changes

- **BREAKING (web voice UX):** Tapping the mic and speaking no longer writes a
  spending. Instead the transcript is parsed and the existing add/edit modal opens
  **prefilled** with the parsed amount, comment, category (`uncategorized`), and
  today's date. Nothing is written until the owner presses Save; Cancel writes
  nothing.
- On Save, the entry is created with `source: 'voice'` — the review step does not
  change where the capture originated.
- `SpendingForm` gains a prefill path for **add** mode (amount + comment +
  category), alongside today's `defaultDate`-only prefill. Edit mode is unchanged.
- `VoiceButton` drops the `createSpending` call, the `needsReview`/amount-0 branch,
  and the Undo/Edit toast. It keeps the tap gesture, the single-shot
  `useSpeechRecognition` hook, `autoStart` (PWA "Log by voice" shortcut → listen →
  open prefilled modal), and the error toast.
- The `needsReview` / amount-0 **flagged-ingress** behavior is explicitly retained
  for non-interactive server paths (the canonical `recordSpending` — REST now,
  Telegram later), which have no modal to review in. Shared validation, types,
  `recordSpending`, and the `SpendingTable` amber "?" rendering are untouched.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `voice-capture`: The "Fire-and-forget voice save as uncategorized" requirement is
  replaced by a "Review voice capture before saving" requirement (the modal is now a
  deliberate confirmation step, reversing the earlier no-multi-step-dialog decision
  **for the web voice path only**). A new requirement pins the non-interactive
  flagged-ingress behavior so it is protected from future cleanup.

## Impact

- `web/src/components/VoiceButton.tsx` — remove save + toast, emit parsed values to open the modal.
- `web/src/components/SpendingForm.tsx` — add prefill for add mode.
- `web/src/App.tsx` — wire VoiceButton to open the prefilled form instead of the toast Edit action.
- Unchanged: `web/src/hooks/useSpeechRecognition.ts`, `shared/*` (validation/types),
  `functions/src/recordSpending.ts`, `web/src/components/SpendingTable.tsx`.
