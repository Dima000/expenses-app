## Why

With eight-plus user-managed categories all rendered as the same neutral badge, scanning the spending table or the category picker for a specific category means reading every label. A small set of user-assignable colors lets each category become instantly recognizable at a glance, without redesigning the badge itself.

## What Changes

- Add a fixed, 16-swatch categorical color palette (Gray, Brown, Red, Orange, Amber, Yellow, Lime, Green, Teal, Cyan, Sky, Blue, Indigo, Violet, Purple, Pink), held at matched lightness/chroma in OKLCH so no swatch reads louder than another, identical in light and dark themes.
- Every category has a `colorId` from that palette. New categories are auto-assigned the next unused swatch at creation time (falling back to reuse once all 16 are taken); the owner can change a category's color at any time from the same 16-swatch picker.
- The 8 seeded default categories ship with distinct pre-assigned colors. Categories persisted before this change (no `colorId` on the stored record) resolve to a deterministic fallback color so the UI never renders colorless.
- Render a small color dot next to the category name in the three places a category appears: the spending table's category badge, the category `<Select>` dropdown, and the categories manager row. The badge/row background stays neutral — only the dot carries color.
- Sort categories alphabetically by name wherever they're offered for **picking** (creating or assigning a spending) — the category `<Select>` component. The categories manager's own list is already sorted this way and is unaffected.

## Capabilities

### New Capabilities

(none — this extends the existing category-management domain)

### Modified Capabilities

- `category-management`: categories now carry a `colorId`; adding a category auto-assigns a color, the owner can change a category's color, and category selection lists are alphabetically sorted.

## Impact

- `shared/src/types.ts`, `shared/src/categories.ts`: `Category` gains `colorId`; new `CATEGORY_PALETTE` constant; `withCategoryAdded` assigns a color; new `withCategoryColorChanged` transform; `DEFAULT_CATEGORIES` gains pre-assigned colors; a resolver fallback for pre-existing categories without a stored `colorId`.
- `web/src/lib/categories.ts`: new `setCategoryColor` writer.
- `web/src/components/CategoriesPage.tsx`: color swatch + picker on each category row.
- `web/src/components/CategorySelect.tsx`: color dot per option; alphabetical sort.
- `web/src/components/SpendingTable.tsx`: color dot on the category badge.
- No changes to Firestore rules or the REST endpoint — `colorId` is just another field on the existing per-user `categories` array.
