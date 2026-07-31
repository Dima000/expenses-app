## 1. Shared domain: palette and color assignment

- [x] 1.1 Add `CATEGORY_PALETTE` (16 named `{ id, name, oklch }` entries: Gray, Brown, Red, Orange, Amber, Yellow, Lime, Green, Teal, Cyan, Sky, Blue, Indigo, Violet, Purple, Pink) to `shared/src/categories.ts`, reusing the OKLCH values validated in exploration.
- [x] 1.2 Add `colorId: string` to the `Category` type in `shared/src/types.ts`.
- [x] 1.3 Add `nextAvailableColorId(categories)`: first palette id unused by the current set, falling back to `CATEGORY_PALETTE[0].id` (cycling) once all are used.
- [x] 1.4 Add `colorIdFor(category, index)`: returns `category.colorId` if present, else `CATEGORY_PALETTE[index % 16].id` — a pure, read-time fallback with no write side effect.
- [x] 1.5 Update `withCategoryAdded` to assign `nextAvailableColorId(categories)` to the new category.
- [x] 1.6 Add `withCategoryColorChanged(categories, id, colorId)` pure transform, following the shape of `withCategoryRenamed`.
- [x] 1.7 Update `DEFAULT_CATEGORIES` to hand-assign 8 distinct colors (e.g. Groceries→Green, Health→Red, Sports→Orange, Pet→Brown, Relationships→Pink, Kid→Yellow, Utilities→Blue, Other→Gray).
- [x] 1.8 Add `sortCategoriesByName(categories)` (locale-aware, base sensitivity) as a shared exported helper.

## 2. Web data layer

- [x] 2.1 Add `setCategoryColor(ownerUid, categories, id, colorId)` in `web/src/lib/categories.ts`, mirroring `renameCategory`.

## 3. Color picker UI

- [x] 3.1 Add the shadcn `popover` primitive to `web/src/components/ui/`.
- [x] 3.2 In `CategoriesPage.tsx`, add a color-swatch button on each `CategoryRow` (alongside rename/remove) that opens a `Popover` with a 16-swatch grid; selecting a swatch calls `setCategoryColor` and shows a selected indicator on the current color.
- [x] 3.3 Wire `colorIdFor(category, index)` so a row without a stored `colorId` still shows a swatch and a working picker.

## 4. Color dots in existing surfaces

- [x] 4.1 Add a small dot component/utility (palette id → OKLCH value) shared by all three render sites.
- [x] 4.2 `SpendingTable.tsx`: render the resolved category's color dot inside the existing badge, next to the name.
- [x] 4.3 `CategorySelect.tsx`: render each option's color dot next to its name.
- [x] 4.4 `CategoriesPage.tsx`: render each row's color dot next to its name (independent of the swatch-picker button from task 3.2).

## 5. Alphabetical ordering in pickers

- [x] 5.1 `CategorySelect.tsx`: sort the `categories` prop with `sortCategoriesByName` before rendering options.
- [x] 5.2 `CategoriesPage.tsx`: replace its inline sort comparator with `sortCategoriesByName`.

## 6. Tests

- [x] 6.1 Unit tests for `nextAvailableColorId` (unused slot picked; all-16-used falls back to reuse).
- [x] 6.2 Unit tests for `colorIdFor` (stored id wins; missing id falls back deterministically; no mutation).
- [x] 6.3 Unit tests for `withCategoryColorChanged` and `sortCategoriesByName`.
- [x] 6.4 Update/add tests asserting `DEFAULT_CATEGORIES` all have distinct `colorId`s.

## 7. Manual verification

- [x] 7.1 Run the app locally; add several categories and confirm distinct auto-assigned colors, then exhaust the palette and confirm graceful reuse.
- [x] 7.2 Confirm the color picker popover works and persists across reload.
- [x] 7.3 Confirm category pickers (add-expense form, assign-uncategorized) list alphabetically, in both light and dark theme.
