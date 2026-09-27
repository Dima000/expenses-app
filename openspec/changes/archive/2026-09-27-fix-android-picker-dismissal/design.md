## Context

`@radix-ui/react-select` (v2.3.3) closes an open dropdown on every window `resize` and `blur`:

```js
// node_modules/@radix-ui/react-select/dist/index.mjs
window.addEventListener("blur", close);
window.addEventListener("resize", close);
```

Both add-spending modes autofocus a text input, so the keyboard is usually up. On the Android
PWA, tapping a dropdown blurs the input, the keyboard slides down, `resize` fires, and the
dropdown closes. The fixes below were tested on the device in a test deploy.

## Goals / Non-Goals

**Goals:**
- Currency and Category pickers stay usable while the keyboard is up.
- Keep the Category dropdown's color dots.
- Keep the fix small, in one place, and easy to debug.

**Non-Goals:**
- Radix's window `blur` close. It hasn't been seen in practice, so it's left as is.
- Replacing Radix Select across the app.

## Decisions

**D1. Currency uses a native `<select>` showing the code only.** The OS picker is a system
dialog, so viewport changes don't affect it. The currency list has no custom content, so
nothing is lost. A native select shows the same option text when closed and in the list.
Showing only the code keeps the control narrow; the cost is losing the `— euro`-style labels,
which is fine for a handful of well-known codes. Adding MDL (planned separately) needs no
extra work here.

**D2. Category keeps Radix Select, with a resize guard in the shared wrapper.** `Select` in
`ui/select.tsx` controls `open` and registers its own `resize` listener when it mounts. That
listener sets a short-lived flag, which is cleared on the next task. Radix only adds its
listener once the dropdown content opens, so ours always runs first. When Radix then calls
`onOpenChange(false)` while the flag is set, the wrapper ignores it. Escape, tapping outside
and picking an option still close the dropdown normally. Because the guard lives in the
shared wrapper, every Select gets it, including the inline assign picker.

Alternatives considered:
- `interactive-widget=resizes-visual` viewport meta: one line, but the installed PWA
  ignored it on the device, so the dropdown still closed. Rejected.
- `patch-package` to remove the listener: the smallest diff, but it breaks silently on
  Radix upgrades. Rejected.
- Popover plus a custom list: no resize listener, but we would have to rebuild listbox
  accessibility, keyboard navigation and the check indicator ourselves. Rejected as more
  code to own.
- Blurring the input and delaying open until the keyboard settles: timing-based and feels
  laggy. Rejected.

## Risks / Trade-offs

- [The guard relies on Radix registering its `resize` listener after ours, which is
  internal behavior] → Documented in a comment on `Select`. Recheck on the device after
  any Radix Select upgrade.
- [Rotating the device no longer closes an open dropdown] → Harmless: the popper
  repositions itself.
- [Radix's window `blur` close still applies] → Out of scope. If it shows up, guard it the
  same way.
- [No automated test: web tests cover `lib/` only, and there's no component test setup] →
  Manual verification on the Android PWA. This is a deliberate choice to keep the test
  setup simple.

## Migration Plan

Web hosting deploy only. Roll back by redeploying the previous build.
