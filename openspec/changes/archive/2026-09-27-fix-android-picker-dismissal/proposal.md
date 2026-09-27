## Why

On the Android PWA, the Currency and Category dropdowns in the add-spending dialog close as
soon as they open whenever the on-screen keyboard is up. The entry input is autofocused, so
this happens almost every time. Tapping a dropdown dismisses the keyboard, the window resizes,
and Radix Select closes any open dropdown on `window` `resize`.

## What Changes

- The add-spending Currency control becomes the device's native picker (`<select>`). It
  shows only the currency code (`RON`, `EUR`, …), both when closed and in the list, so it stays
  narrow next to the entry input. The longer labels (`EUR — euro`) are no longer shown.
- The Category control keeps the existing Radix dropdown, so its color dots stay. The shared
  `Select` wrapper ignores closes caused by a window resize, so an open dropdown stays open
  when the keyboard is dismissed. This applies to every Radix Select in the app, including
  the inline assign-category picker.

## Capabilities

### New Capabilities

_None._

### Modified Capabilities

- `spending-tracking`: the currency control is specified as a native picker showing
  currency codes only. A new requirement says open pickers stay open when the on-screen
  keyboard is dismissed.

## Impact

- `web/src/components/ui/select.tsx`: `Select` becomes a wrapper around the Radix `Root`
  with the resize guard.
- `web/src/components/ui/native-select.tsx` (new): a `<select>` styled like `SelectTrigger`.
- `web/src/components/SpendingForm.tsx`: the Currency control uses `NativeSelect`.
- No data, API or dependency changes. Web hosting deploy only.
