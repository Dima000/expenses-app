## Why

On the Android PWA, tapping the Date field in the add/edit spending dialog selects a part of
the date (day, month or year) instead of opening the calendar. Only the calendar icon opens
it reliably, and that icon is hard to find: it sits mid-field and renders darker than the
dark background. Picking a date takes several tries.

The date input has not changed since the initial commit, and none of the recent dialog or
dependency changes (#33, #40, #41, #42) touch it or its styles. The most likely cause is a
Chrome for Android update that switched `<input type="date">` to the desktop-style segmented
field. That is **unconfirmed**. One task below checks a plain date input in Chrome on the
same phone to settle it. The fix does not depend on the answer: it works with both layouts.

## What Changes

- Tapping anywhere on the Date field opens the native calendar, through the standard
  `HTMLInputElement.showPicker()` API. The call is skipped where the API is missing, and
  errors from it are ignored, so the field falls back to the browser's default behaviour.
- The document declares `color-scheme: dark`, so native controls (the date field's calendar
  icon, the calendar dialog, the currency `<select>` list, scrollbars) render for a dark
  background and the icon is visible.
- The date stays a native control. No custom calendar component is added.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `spending-tracking`: adds a requirement that tapping the Date field in the spending form
  opens the date picker.
- `web-theming`: adds a requirement that the document declares a dark color scheme so
  native controls match the dark theme.

## Impact

- `web/src/components/SpendingForm.tsx`: click handler on the Date input.
- `web/src/index.css`: `color-scheme: dark` in the base layer.
- Native controls across the app render in their dark variants. This is expected to be an
  improvement but needs a visual check.
- No data, API, backend or dependency changes. Web hosting deploy only.
