## 1. Confirm the cause

- [x] 1.1 On the Android phone, open a plain `<input type="date">` in Chrome (for example `data:text/html,<input type="date">`) and note whether tapping its digits selects them; record the result and the Chrome version (`chrome://version`) for the PR

## 2. Date field opens the picker

- [x] 2.1 Add an `onClick` to the Date input in `web/src/components/SpendingForm.tsx` that calls `e.currentTarget.showPicker()` when it exists, inside `try/catch`, with a short comment explaining why
- [x] 2.2 Add `color-scheme: dark` to the `html` rule in `@layer base` in `web/src/index.css`

## 3. Verify and ship

- [x] 3.1 `npm run build:web` passes (typecheck + build)
- [ ] 3.2 Deploy and verify on the Android PWA: in both add and edit, tapping the date digits opens the calendar first time, including right after typing in the entry field with the keyboard up; picking a date updates the field and is saved
- [ ] 3.3 Check that the calendar icon is visible, and that the currency picker, the category picker and the scrolling dialog still look right with the dark color scheme
- [ ] 3.4 Create branch `fix/android-date-picker-tap`, commit, push and open a PR noting the root-cause result from 1.1
