## 1. SpendingForm: add-mode prefill

- [x] 1.1 Add an optional `prefill` prop `{ amount?: string; comment?: string; category?: CategoryValue }` used only when `editing` is absent; seed amount/comment/category from it in the open-effect (fall back to today's blank-add defaults when unset).
- [x] 1.2 Thread the capture source through the add branch so a voice-originated save uses `source: 'voice'` while a plain add stays `'web'` (e.g. an optional `addSource` prop defaulting to `'web'`).
- [x] 1.3 Keep edit mode and the existing `defaultDate` behavior unchanged.

## 2. VoiceButton: review-before-save

- [x] 2.1 Remove `createSpending`, the `needsReview`/amount-0 branch, and the Undo/Edit toast from `handleTranscript`.
- [x] 2.2 On transcript, parse then call a new `onCapture(prefill)` prop with `{ amount, comment, category: uncategorized }` (amount blank when the parser returns `needsReview`); keep the recognition error toast.
- [x] 2.3 Keep the tap gesture, the single-shot `useSpeechRecognition` hook, and `autoStart` (listen on mount → emit capture → open the modal).
- [x] 2.4 Update the component doc comment to describe the review-before-save flow.

## 3. App wiring

- [x] 3.1 Add prefill + voice-source state; on `VoiceButton.onCapture`, set the prefill and open `SpendingForm` in add mode (not edit).
- [x] 3.2 Ensure `openAdd` (the + button) still opens a blank add with no prefill and `source: 'web'`.
- [x] 3.3 Remove the now-unused `onEditRequest`-from-voice toast wiring.

## 4. Verify

- [x] 4.1 Typecheck/build the web package.
- [x] 4.2 Manually verify: speak "12 lunch" → modal opens prefilled (amount 12, comment "lunch"), nothing saved; Save writes with `source: 'voice'`; Cancel writes nothing; "coffee" opens with a blank amount.
- [x] 4.3 Confirm the non-interactive path is untouched: `recordSpending`, shared validation/types, and the `SpendingTable` amber "?" are unchanged.
