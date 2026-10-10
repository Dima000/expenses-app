## Context

The spending form's date is a plain native input (`SpendingForm.tsx`):

```tsx
<Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
```

On the Android PWA this now renders as a segmented field: tapping the digits selects a part
of the date for editing, and only the calendar icon opens the picker. The icon is placed
right after the date text rather than at the field's end, and it is drawn for a light
background, so it is barely visible on the dark theme. The app is dark-only
(`<html class="dark">` in `index.html`) but never declares `color-scheme`, so the browser
draws native controls in their light variants.

The input and the shared `Input` component are unchanged since the initial commit. The
likely trigger is a Chrome for Android update to how `type="date"` renders. This is
unconfirmed (see Open Questions). The design below works with either layout.

## Goals / Non-Goals

**Goals:**
- One tap anywhere on the Date field opens the calendar on the Android PWA.
- The native calendar icon and calendar dialog render for a dark background.
- Keep the fix small, native and easy to debug, in line with the #42 picker fix.

**Non-Goals:**
- A custom calendar component.
- Changing the date's value format, default or validation.
- A light theme or theme switching.

## Decisions

**D1. Open the picker with `showPicker()` on click.** The Date input gets an `onClick` that
calls `e.currentTarget.showPicker()`. A click counts as a user gesture, which the API
requires. The call is guarded in two ways: it is skipped when `showPicker` is not a function
(older browsers), and it is wrapped in `try/catch`, because the API throws in some states
(for example `InvalidStateError` / `NotAllowedError` when a picker is already showing or the
input cannot show one). On any failure the browser's default tap behaviour remains, so the
fix can't make things worse. The handler lives inline on the one Date input. There is only
one date field, so a shared component is not needed yet.

Alternatives considered:
- CSS trick: stretch `::-webkit-calendar-picker-indicator` over the whole input with
  `opacity: 0`. Pure CSS, but it relies on a Chrome-only pseudo-element whose layout has
  just changed under us. Rejected.
- Custom date picker (for example react-day-picker in a Popover): full control, but more
  code to own, and Popover-based UI is exposed to the same viewport-resize issues #42 dealt
  with. The native dialog is a system dialog and is not affected. Rejected.
- `onFocus` instead of `onClick`: focus is not always a user gesture (autofocus, keyboard
  navigation), so `showPicker()` would throw. Rejected.

**D2. Declare `color-scheme: dark` in the base layer.** Add it to the `html` rule in
`@layer base` in `index.css`, rather than to the `.dark` token block. The `.dark` block is
owned by the shadcn CLI and may be regenerated (see `web-theming`), while the base layer is
already required to survive regeneration. Because the app is dark-only, applying it to
`html` unconditionally matches the hardcoded `class="dark"`. Alternative: a
`<meta name="color-scheme" content="dark">` in `index.html`. It does the same thing but
puts theme decisions in two places. Rejected for one source of truth.

## Risks / Trade-offs

- [The root cause is unconfirmed] → The fix works whether the segmented layout comes from
  Chrome or from something else, so it doesn't block the change. Task 1 records the answer.
- [On desktop, clicking the date digits now opens the calendar instead of selecting a part
  for typing] → Typing still works with the keyboard once the field has focus. The app is
  used mainly on the phone. Accepted.
- [`color-scheme: dark` restyles every native control] → Expected to help (dark scrollbars,
  dark `<select>` list). Visual check of the currency picker and the scrolling dialog in the
  verify tasks.
- [No automated test: web tests cover `lib/` only] → Manual verification on the Android
  PWA, as in #42.

## Migration Plan

Web hosting deploy only. Roll back by redeploying the previous build.

## Open Questions

- ~~Is Chrome for Android the cause?~~ **Resolved:** a plain `<input type="date">` in Chrome
  on the same phone behaves the same: tapping the digits selects them, and only the calendar
  icon opens the picker. The behaviour comes from Chrome, not from the app.
