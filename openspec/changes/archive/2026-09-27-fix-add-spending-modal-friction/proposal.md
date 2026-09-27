## Why

The add/edit spending dialog creates friction on every entry: two always-visible hint lines
push the fields down, the currency picker takes a full row of its own, and the centred dialog
jumps whenever the mobile keyboard opens or closes. Spending entry is the most frequent action
in the app, so these small costs add up.

## What Changes

- Move the add-mode line (*"The first number becomes the amount; the rest is saved as the
  comment."*) behind an info (ⓘ) icon next to the "Amount & note" label that reveals it on
  tap/click. The rounding subtitle stays visible. The title is left-aligned on the same row as
  the close button.
- Put the currency picker on the same row as the "Amount & note" input: two columns, the input
  filling the remaining width and the currency control only as wide as it needs. The closed
  control shows the currency code only (e.g. `RON`); the open list keeps the full labels.
- Size the dialog to its content up to a maximum of 80% of the dynamic viewport height
  (scrolling internally beyond that), on all screen sizes, and anchor it 10% of the viewport
  height from the top instead of vertically centring it, so it stays still when the on-screen
  keyboard opens (on small devices the keyboard may cover its lower part).

Out of scope: the Android bug where the first tap on a dropdown only dismisses the keyboard
(Radix Select closes on window `resize`). That is tracked as a separate change.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `monthly-dashboard`: adds requirements for the add/edit dialog's layout — entry hint behind an
  info control, inline currency picker, and viewport-bounded, top-anchored sizing.

## Impact

- `web/src/components/SpendingForm.tsx` — header, add-mode entry row, hint removal.
- `web/src/components/ui/dialog.tsx` — possibly a `className` override only; the shared
  primitive's defaults stay unchanged so the delete-confirmation dialog is unaffected.
- Uses the existing `ui/popover.tsx`; no new dependencies.
- Both call sites (`App.tsx`, `CategoryDrilldownPage.tsx`) get the change through the shared
  form; no prop changes.
