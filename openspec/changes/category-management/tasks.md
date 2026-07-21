## 1. Shared domain: model, slug ids, matcher, validation

- [x] 1.1 In `shared/src/categories.ts`, keep the 8 names as the DEFAULT seed set and derive stable slug ids for each (`Groceries → "groceries"`); add a `slugify(name)` helper and a `DEFAULT_CATEGORIES` export of `{ id, name, terms: [] }`. Keep `UNCATEGORIZED` as the reserved pending value.
- [x] 1.2 In `shared/src/types.ts`, add a `Category` type (`{ id: string; name: string; terms: string[] }`), the `users/{uid}` categories document shape, the collection/doc constant, and add optional `autoMatchedTerm?: string` to the spending input/doc/read types.
- [x] 1.3 In `shared/src/validation.ts`, relax category validation: accept any non-empty string id or `uncategorized` (no fixed-list membership check); keep amount/date/comment rules unchanged.
- [x] 1.4 Add `categorize(comment, categories)` to the shared domain: lowercase + whole-word (word-boundary) matching, collect distinct matching categories, return `{ categoryId, matchedTerm }` only when exactly one distinct category matches, else `null`.
- [x] 1.5 Add a category-resolution helper used by the UI: given a stored category value and the owner's categories, resolve by exact id → case-insensitive name fallback → `uncategorized`.
- [x] 1.6 Add term/name uniqueness helpers (find the category owning a term; detect duplicate names) for the data-layer and UI to share.

## 2. Shared domain tests

- [x] 2.1 In `tests/domain.test.mjs`, add matcher tests: whole-word + case-insensitive (`"Market"` matches, `"supermarket"` does not), single-match assigns, 0-match and ≥2-distinct-match leave uncategorized, and `autoMatchedTerm` is returned on a match.
- [x] 2.2 Add validation tests: an arbitrary id string and `uncategorized` are accepted; category resolution falls back id → name → uncategorized.
- [x] 2.3 Add uniqueness tests: duplicate term across categories is detected and reports the owning category; duplicate category name is detected.

## 3. Web data layer for categories

- [x] 3.1 Add `web/src/lib/categories.ts` mirroring `web/src/lib/spendings.ts`: a live `subscribeToCategories(ownerUid, onData)` `onSnapshot` reader over `users/{uid}`.
- [x] 3.2 Add writers: `addCategory`, `renameCategory`, `removeCategory`, `addTerm`, `removeTerm` — each enforcing name/term uniqueness (via the shared helpers) before writing and updating the single doc.
- [x] 3.3 Add one-time seeding: if the categories doc is absent on first read, write `DEFAULT_CATEGORIES`; never re-seed once the doc exists.

## 4. Auto-categorisation on all write paths

- [x] 4.1 In `web/src/components/SpendingForm.tsx`, when the owner leaves the category `uncategorized`, run `categorize(comment, categories)` on save and apply the result (id + `autoMatchedTerm`); never override an explicit pick.
- [x] 4.2 Ensure the voice path (`web/src/components/VoiceButton.tsx` → prefilled form) flows through the same save-time categorisation (no separate logic).
- [x] 4.3 In `functions/src/recordSpending.ts`, load the owner's categories and run the shared `categorize` so REST writes categorise identically, persisting `autoMatchedTerm` when matched.

## 5. Categories management UI

- [x] 5.1 Build a categories-manager `Dialog` (mirroring `SpendingForm.tsx`: `Dialog` + `Input`/`Label` grid + `Button` footer) to add/rename/remove categories and add/remove terms, wired to `web/src/lib/categories.ts`.
- [x] 5.2 Surface duplicate-name and duplicate-term errors inline (e.g. "'market' is already in Groceries"); no auto-move.
- [x] 5.3 Add a header entry point next to sign-out in `web/src/App.tsx` to open the dialog.

## 6. Display: dynamic categories, resolution, tooltip

- [x] 6.1 Update `web/src/components/CategorySelect.tsx` to map over the live categories (not the shared const), keeping the `uncategorized`/assign-later behaviour.
- [x] 6.2 Update `web/src/components/SpendingTable.tsx` to resolve each spending's stored value id → name via the shared resolver, render "Uncategorised" when unresolved, and show a tooltip ("categorised via '<term>'") when `autoMatchedTerm` is present.
- [x] 6.3 Verify the existing "only uncategorized" filter/count in `App.tsx` still works against resolved categories (including removed-category rows now counted as uncategorised).

## 7. Firestore rules

- [x] 7.1 In `firestore.rules`, remove `allowedCategories()` and the `data.category in ...` check on `spendings` (category may be any string).
- [x] 7.2 Add owner-scoped read/write rules for the new `users/{uid}` document; keep the catch-all deny for everything else.
- [x] 7.3 Update `tests/rules.test.mjs` to cover: owner can read/write their own categories doc, another identity cannot, and a spending with an arbitrary category string is accepted.

## 8. Verify

- [ ] 8.1 Run `npm run typecheck` and the domain unit tests (`test:domain`) green.
- [ ] 8.2 Run the rules/rest emulator suites locally (`npm run test:rules`, `npm run test:rest`).
- [ ] 8.3 Manually verify end-to-end: seed on first run; add/rename/remove categories and terms with uniqueness errors; a comment with one term auto-categorises and shows the tooltip; an ambiguous comment stays uncategorised; removing a category shows its spendings as Uncategorised; renaming updates history without rewrites.
