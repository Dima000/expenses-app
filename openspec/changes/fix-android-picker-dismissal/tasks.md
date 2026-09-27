## 1. Currency native picker

- [x] 1.1 Add `web/src/components/ui/native-select.tsx`, a `<select>` styled like `SelectTrigger`
- [x] 1.2 Replace the add-spending Currency Radix Select with `NativeSelect`, keeping the disabled-without-rates behaviour
- [x] 1.3 Show only the currency code as each option's text

## 2. Radix Select resize guard

- [x] 2.1 Wrap `SelectPrimitive.Root` in `ui/select.tsx` with controlled `open` and a mount-time `resize` listener that flags resize-caused closes
- [x] 2.2 Ignore `onOpenChange(false)` while the flag is set, and document the listener-order dependency in a comment
- [x] 2.3 Remove the `interactive-widget=resizes-visual` experiment from `web/index.html`

## 3. Verify and ship

- [x] 3.1 `npm run build:web` passes (typecheck + build)
- [ ] 3.2 Deploy and verify on the Android PWA: with the keyboard up, the Category dropdown stays open, and the Currency picker opens and shows codes only
- [ ] 3.3 Check that the inline assign-category picker still opens, selects and closes normally
- [x] 3.4 Rename the branch to `fix/android-picker-dismissal`, commit, push and open a PR
