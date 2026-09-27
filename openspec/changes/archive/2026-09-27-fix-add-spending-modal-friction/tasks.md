## 1. Entry hint behind an info control

- [x] 1.1 Keep the rounding `DialogDescription` visible as the subtitle
- [x] 1.2 Add an `InfoHint` ⓘ button (`Info` icon + `Popover`) after the "Amount & note" label with the first-number hint (add only)
- [x] 1.3 Remove the inline "The first number becomes the amount…" line; keep "Entered as …", the auto-categorised note, the no-rates message, the preview, and errors inline
- [x] 1.4 Left-align the title on the close button's row, vertically aligned with it

## 2. Inline currency picker

- [x] 2.1 Wrap the free-text `Input` and the currency `Select` in one `flex items-start gap-3` row (input `flex-1 min-w-0`, trigger `w-auto shrink-0`)
- [x] 2.2 Show only the currency code in the closed trigger; keep full labels in `SelectItem`s
- [x] 2.3 Remove the separate "Currency" label/block; give the trigger `aria-label="Currency"`
- [x] 2.4 Move the conversion preview and missing-rates message below the row

## 3. Dialog sizing and position

- [x] 3.1 Pass a `className` to `SpendingForm`'s `DialogContent`: top-anchored (`top-[10dvh] translate-y-0`), `max-h-[80dvh] overflow-y-auto`
- [x] 3.2 Confirm the shared `DialogContent` defaults are unchanged (delete confirmation still centred)

## 4. Verification

- [x] 4.1 `npm run build` (typecheck) and the web unit tests pass
- [x] 4.2 Desktop: the add dialog's ⓘ popover shows the first-number hint; currency row lays out as specified; dialog top-anchored
- [x] 4.3 Android Chrome: with the keyboard up, the add dialog doesn't move; tapping each ⓘ toggles its popover
- [x] 4.4 Content taller than 80dvh (e.g. landscape phone) scrolls inside the dialog
