## Context

`SpendingForm` is one Radix `Dialog` shared by add and edit, rendered from `App.tsx` and
`CategoryDrilldownPage.tsx`. `DialogContent` (shadcn) is centred with
`top-[50%] translate-y-[-50%]` and has no height limit. The header shows a
`DialogDescription` with the rounding hint; add mode shows a second hint under the free-text
input and puts the currency `Select` in its own labelled block below.

On mobile Chrome the default `interactive-widget=resizes-visual` means the keyboard does not
shrink the layout viewport. A centred dialog therefore re-centres as the visual viewport
changes, and its lower half, including the submit button, can end up behind the keyboard.

## Goals / Non-Goals

**Goals:**
- Fewer visible lines in the form; hints available on demand.
- Amount entry and currency choice on one row.
- A dialog that stays still with the keyboard up and keeps the submit button reachable.

**Non-Goals:**
- The Android "first tap only dismisses the keyboard" dropdown bug (Radix Select closes on
  window `resize`). This is a separate change, and it keeps the current Radix `Select` here so
  that change can fix every dropdown in one place.
- Changing the shared `DialogContent` defaults used by other dialogs.
- Changing the free-text parsing, currency behaviour, or any data written.

## Decisions

### D1. Entry hint in a Popover, not a Tooltip
A small `InfoHint` ⓘ button (`lucide-react` `Info`, `aria-label="How amount and note work"`)
after the "Amount & note" label opens the existing `ui/popover.tsx` with the first-number rule
(add mode only). The rounding rule stays as the visible subtitle: it is one short line and
applies to both modes, so hiding it saved little (an ⓘ on the title was tried and dropped). The title is left-aligned in a row
nudged up (`-mt-2 h-4`) so it centres on the absolutely-positioned close button, with `pr-6`
to clear it. Touch devices have no hover, so a
tooltip would be unreachable on phones; a tap-toggled popover works everywhere.
*Alternative:* a collapsible "ⓘ" row inside the form, which is rejected because it moves the fields.

### D2. Keep `DialogDescription` as is
The visible `DialogDescription` ("Amounts are stored in whole units; fractional values round
up.") is unchanged and remains the dialog's accessible description.

### D3. Inline currency: flex row, code-only trigger
The row is `flex items-start gap-3`: the `Input` is `flex-1 min-w-0`, and the `SelectTrigger`
is `w-auto shrink-0`. The trigger renders the code through `SelectValue`'s children (the
selected code) while `SelectItem`s keep `c.label`, which gives `RON` when closed and `RON — lei` in the list. The single
`Label` "Amount & note" points at the input, and the trigger gets `aria-label="Currency"`
(the old `id="currency"` label is removed). The preview and no-rates text move below the row.
Three-letter codes keep the column's width fixed, and MDL (the `add-mdl-currency` change) fits
without layout changes.

### D4. Content height capped at 80dvh, top-anchored, override per call site
The override is applied through `className` on `SpendingForm`'s `DialogContent` only:
`top-[10dvh] translate-y-0 max-h-[80dvh] overflow-y-auto` on all screen sizes (an earlier
`top-4` on mobile sat too close to the top). `dvh` keeps the cap correct when mobile browser
toolbars show or hide. `max-h` rather than a fixed `h` keeps the
submit button directly under the fields ("up to 80%" is the lower-friction option: with a fixed
80% height and the button pinned to the bottom, the button sits behind the keyboard).
`tailwind-merge` in `cn()` resolves the conflicting `top`/`translate-y` classes in favour of
the override, and the base `translate-x-[-50%]` is unaffected.
*Alternative:* change `DialogContent` globally, which is rejected because the delete confirmation
does not need it.

## Risks / Trade-offs

- [Short phones: form + 10dvh offset may exceed the space above the keyboard] → Accepted:
  the keyboard may cover the submit button on small devices; the dialog still doesn't move.
  If that becomes a problem, `interactive-widget=resizes-content` in the viewport meta is the
  app-wide follow-up.
- [Hints are less discoverable] → The ⓘ sits next to the title, and the input placeholder
  (`e.g. 12 lunch with team`) already shows the format.
- [Top-anchored dialog looks off-centre on desktop] → `top-[10dvh]` keeps it visually
  balanced for a short dialog.
- [The zoom/slide-in animation classes assume centring] → The current `DialogContent` has
  no slide classes, only `duration-200`, so there is nothing to fix.
