## Context

Categories today are `{ id, name, terms }` (`shared/src/categories.ts`), rendered as a plain `Badge` everywhere they appear: the spending table, the `CategorySelect` picker, and the categories manager. There are 8 seeded defaults and users can add more; nothing currently distinguishes categories visually beyond their label. `CategorySelect` also renders in whatever order the `categories` prop arrives (Firestore document order), while `CategoriesPage` already sorts its own list alphabetically.

An exploration session prototyped a 16-swatch OKLCH palette (Gray, Brown, Red, Orange, Amber, Yellow, Lime, Green, Teal, Cyan, Sky, Blue, Indigo, Violet, Purple, Pink) held at matched lightness/chroma, rendered as a small dot next to the category name, and validated against the app's actual light/dark surfaces. This design covers wiring that palette into the data model and UI.

## Goals / Non-Goals

**Goals:**
- Every category has a color, auto-assigned on creation, changeable by the owner at any time.
- Categories already persisted before this change render with a sensible color with no migration write required.
- Category pickers (`CategorySelect`) list categories alphabetically, matching `CategoriesPage`'s existing order.

**Non-Goals:**
- No per-category custom/arbitrary colors (hex picker) — only the fixed 16-swatch palette.
- No uniqueness constraint on color, unlike name/term — two categories may share a color (expected once more than 16 categories exist, or by owner choice).
- No change to Firestore security rules or the REST write endpoint — `colorId` is just another field on the existing `categories` array.

## Decisions

**Store `colorId`, not a raw color value.** `Category` gains `colorId: string`, a key into a `CATEGORY_PALETTE` constant (`shared/src/categories.ts`) rather than a stored OKLCH/hex value. Reworking a swatch's exact value later needs no data migration — every category referencing that `colorId` picks up the new value automatically.

**Auto-assignment: next unused slot, not a hash.** On `withCategoryAdded`, a new `nextAvailableColorId(categories)` helper picks the first palette color not already used by the current set (falling back to the first palette color, cycling, once all 16 are taken). Rejected alternative: `hash(id) % 16` — simpler, but can collide between the very first two categories a user creates even though 14 unused slots remain, which defeats the point below 16 categories. Next-unused guarantees full distinctness up to 16 for free.

**Default categories get pre-assigned, hand-picked colors**, not the auto-assign algorithm, so the seeded set reads intentionally (e.g. Health → Red, Groceries → Green) rather than however the algorithm happens to walk the palette array.

**No color, no migration — resolve a fallback at read time instead.** Categories persisted before this change have no `colorId`. Rather than a backfill write (extra write path, races with the existing non-destructive-seed guarantees), a `colorIdFor(category, index)` helper falls back to `CATEGORY_PALETTE[index % 16]` (by the category's position in the array) whenever `colorId` is missing, mirroring how `resolveCategory` already computes derived display state rather than mutating stored data. The fallback is never written back; it only applies until the owner explicitly sets a color, at which point the real writer persists `colorId` like any other field.

**No uniqueness enforcement on color.** Unlike name/term, colors are allowed to repeat — enforcing distinctness would require rejecting a valid owner choice once the palette is exhausted, which contradicts "every category should have a color."

**Extract one shared sort helper.** `CategoriesPage`'s existing inline `.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))` becomes an exported `sortCategoriesByName(categories)` in `shared/src/categories.ts`, and `CategorySelect` calls the same helper. Keeps the collation rule (locale-aware, base sensitivity) single-sourced instead of duplicated across two components.

**Color picker UI: add the shadcn Popover primitive.** The project is already shadcn-CLI-managed (`web-theming` spec) but has no popover/menu primitive vendored yet. Rather than hand-roll a positioned `<div>`, add `popover` via the shadcn CLI and use it to host the 16-swatch grid, anchored off a new swatch button on each `CategoryRow` (alongside the existing rename/remove icons).

## Risks / Trade-offs

- **Palette exhaustion (>16 categories)** → colors repeat once the 17th category is added. Accepted: this is a labeling aid, not an identity guarantee; matches how Notion/Linear tag colors behave past their own limits.
- **OKLCH gamut clipping in some rendering engines** could shift a swatch's apparent hue slightly → mitigated by reusing the exact values already validated in the exploration prototype against both real app grounds.
- **Adding a new shadcn primitive (Popover)** is a small new dependency surface → scoped to the color picker only; no other component needs to change.

## Migration Plan

- No Firestore data migration. Existing `users/{uid}.categories` documents are read as-is; missing `colorId` is covered by the read-time fallback described above.
- No Firestore rules changes — `colorId` is an additional field on an already-permitted document shape.
- Roll out is a normal PR: ship `CATEGORY_PALETTE` + `colorId` + UI together; nothing to sequence or flag.

## Open Questions

None blocking — the popover-vs-inline-expand question raised during exploration is resolved above (popover, via the shadcn primitive).
