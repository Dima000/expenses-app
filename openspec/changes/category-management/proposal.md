## Why

Categories are a hardcoded, fixed list of 8 ([`shared/src/categories.ts`](../../../shared/src/categories.ts)), so owners cannot tailor them to how they actually spend, and every new spending must be categorised by hand. Issue [#6](https://github.com/Dima000/expenses-app/issues/6) asks to make categories user-managed and to auto-categorise spendings by matching keywords ("terms") in the comment — e.g. a comment containing `market` is saved as Groceries automatically.

## What Changes

- **User-managed categories.** A new dialog (launched from the header) lets the owner add, remove, and rename categories, and edit each category's list of terms. Categories are stored per-user in Firestore instead of a hardcoded constant.
- **Editable auto-categorisation terms.** Each category owns a list of terms. On save, if a spending's comment contains a term (full-word, case-insensitive), the spending is auto-assigned to that category. Terms are globally unique across categories (adding a duplicate is rejected, naming the owning category). Categories start with no terms.
- **Auto-categorisation on every write path.** The matcher lives in the shared domain so the web form, voice capture, and the server REST path all categorise identically. It only fills the category when the owner left it Uncategorised, and only when exactly one distinct category matches — ambiguous comments stay Uncategorised.
- **Match transparency.** When a term triggers auto-assignment, the matched term is stored on the spending and surfaced as a tooltip on the category badge ("categorised via 'market'").
- **Non-destructive removal / stable identity.** Spendings store a stable category **id**, not the display name. Renaming a category is a single edit that all history follows; removing a category leaves existing spendings pointing at an id that no longer resolves, and they render as "Uncategorised". **BREAKING** (data): existing spendings that store a category *name* string are resolved via a case-insensitive name fallback for backward compatibility.
- **Rules no longer enforce a fixed category set.** Firestore rules stop validating `category` against a hardcoded enum; the category may be any string and the app validates it. This is safe because an unresolvable value simply renders as Uncategorised.
- **One-time seeding.** On first run (no categories document yet) the current 8 categories are seeded as defaults with slug ids. There is no minimum count and no auto-re-seed: if the owner deletes them all, they re-add manually.

Out of scope (deferred): category colors/icons, per-category spend breakdown/budgets, shared/household categories, and routing ambiguous matches to `needsReview`.

## Capabilities

### New Capabilities

- `category-management`: Per-user CRUD of categories and their globally-unique terms; one-time default seeding; non-destructive deletion; rename by stable id; the terms-management UI.

### Modified Capabilities

- `spending-tracking`: The category is now a resolvable user-managed id (or `uncategorized`) rather than a value from a fixed list; it is auto-assigned by full-word term matching on save across all write paths, records which term matched, and is no longer constrained to a static set by Firestore rules.

## Impact

- **Shared domain** (`shared/src/`): `categories.ts` (fixed list becomes the seed set + slug ids), `types.ts` (add `autoMatchedTerm?`, a `Category` type, the `users/{uid}` categories doc shape and collection constant), `validation.ts` (add the `categorize(comment, categories)` matcher; relax category validation to "resolvable id or legacy name or `uncategorized`").
- **Web** (`web/src/`): new categories-manager dialog + header entry in `App.tsx`; new `lib/` data-layer for the categories doc (live `onSnapshot` read + writes) mirroring `lib/spendings.ts`; `CategorySelect.tsx` reads dynamic categories; `SpendingForm.tsx` and `VoiceButton.tsx` run the matcher on save; `SpendingTable.tsx` resolves id→name, shows the match tooltip, and falls back to "Uncategorised".
- **Server** (`functions/src/recordSpending.ts`): runs the shared matcher so REST writes categorise identically.
- **Firestore** (`firestore.rules`): drop the static category-enum check on `spendings`; add owner-scoped read/write rules for the new `users/{uid}` document.
- **Tests** (`tests/domain.test.mjs`): matcher unit tests (full-word/case-insensitive, 0/1/≥2-distinct ambiguity, only-fills-when-uncategorised, `autoMatchedTerm` capture, term uniqueness).
- No new runtime dependencies. No change to the amount parser or the review-form flow beyond category assignment.
