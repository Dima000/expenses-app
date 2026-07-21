## Context

Categories today are a hardcoded 8-item tuple in `shared/src/categories.ts`, imported everywhere (`CategorySelect` maps over it, `validation.ts` checks against it, and `firestore.rules` duplicates the list in `allowedCategories()`). `uncategorized` already exists as a first-class "pending" state distinct from `Other`, and the UI already renders an inline picker + "only uncategorized" filter for it. Spendings live in one top-level `spendings` collection and store the category as its **display name** string. There is no per-user settings collection, no router (single `App.tsx`), and the web app talks to Firestore directly via a thin functional data-layer (`web/src/lib/spendings.ts`) with live `onSnapshot` reads.

Issue #6 turns categories into user-managed data with per-category "terms" that auto-categorise new spendings. The design must keep all three write paths (web form, voice, server REST via `recordSpending`) behaving identically, so category logic belongs in the shared domain.

## Goals / Non-Goals

**Goals:**
- Per-user categories the owner can add / remove / rename, each with an editable, globally-unique list of terms.
- Auto-categorise a spending from its comment on save, on every write path, deterministically.
- Removal and rename never rewrite or orphan history in a surprising way.
- Reuse the existing `uncategorized` state, data-layer pattern, and shadcn dialog conventions.

**Non-Goals:**
- Category colors/icons, per-category spend breakdown/budgets (deferred).
- Shared/household categories and routing ambiguous matches to `needsReview` (maybe later).
- A "restore defaults" button, a migration script, or any minimum-category enforcement.

## Decisions

- **Storage: one `users/{uid}` document with a `categories` array of `{ id, name, terms: string[] }`.**
  At this scale (a handful of categories) a single doc is read in one shot, makes global term-uniqueness a single in-memory check, and makes term edits atomic.
  - *Alternative considered:* a `users/{uid}/categories/{id}` subcollection — rejected; uniqueness would need a collection query and there's no scale benefit here.

- **Identity: spendings store a stable category `id`, not the name (Tension B → B2).**
  Rename becomes a single O(1) field edit that all history follows; a removed category's id simply stops resolving and renders "Uncategorised". Default ids are slugs of the current names (`Groceries → "groceries"`).
  - *Legacy fallback (no migration):* existing spendings store a name string. Resolution is: exact id match → else case-insensitive match of the stored value against category names → else "Uncategorised". So old rows keep resolving until their category is renamed/removed, at which point they fall to "Uncategorised" — exactly the non-destructive-removal behaviour. New writes always store an id.
  - *Alternative considered:* store the name and cascade-update every spending on rename — rejected; O(n), non-atomic, and can partially orphan history (the accidental version of removal).

- **Validation & rules: drop the static enum (Tension A → A1).**
  Remove `allowedCategories()` / `data.category in ...` from `firestore.rules`; `category` may be any string. `shared/src/validation.ts` stops checking membership in a fixed list and only requires a non-empty string (id, legacy name, or `uncategorized`). This is safe because an unresolvable value renders "Uncategorised" — a bad value is inert, not corrupting.
  - *Alternative considered:* have rules `get()` the categories doc and validate the id — rejected; extra read per write for protection the render-fallback already provides.

- **Matcher lives in the shared domain: `categorize(comment, categories) → { categoryId, matchedTerm } | null`.**
  Case-insensitive, **whole-word** matching (word-boundary, so `market` ∤ `supermarket`). Because terms are globally unique, collect the set of **distinct categories** whose terms appear: exactly one → assign it and return the matched term; zero or ≥2 → return `null` (stay `uncategorized`). Callers apply the result **only when the owner left the category `uncategorized`** — an explicit pick is never overridden. All three write paths call this: `SpendingForm`/`VoiceButton` (client) and `recordSpending` (server).
  - *Whole-word implementation:* normalise to lowercase and test each term with a word-boundary match; keep terms simple strings (no regex/phrases) for now.

- **Match transparency: persist `autoMatchedTerm?: string` at write time.**
  Set only when auto-assignment fires; `SpendingTable` shows it as a tooltip on the category badge ("categorised via 'market'"). Stored (not recomputed at render) so it stays truthful after terms are later edited.

- **Seeding: once, on absence of the categories doc.**
  On load, if `users/{uid}` has no categories doc, write the 8 defaults (slug ids, empty terms). Never re-seed once the doc exists — deleting all categories is a valid, persistent state. No minimum count.

- **UI: a categories-manager Dialog from the header; dynamic `CategorySelect`.**
  No router exists, so follow the established dialog pattern (mirroring `SpendingForm.tsx`: `Dialog` + `Input`/`Label` grid + `Button` footer), launched from a header entry next to sign-out. `CategorySelect` maps over the live categories from the new data-layer instead of the shared const. A new `web/src/lib/categories.ts` mirrors `spendings.ts`: a live `onSnapshot` subscription plus add/rename/remove/edit-terms writers, each enforcing name/term uniqueness before writing.

## Risks / Trade-offs

- **Weak rules validation (A1) lets a client write an arbitrary category string** → acceptable: it can only ever render as "Uncategorised" for that owner's own data; owner-scoping rules are unchanged, so no cross-user exposure.
- **Legacy name-fallback is ambiguous if a name is reused** (e.g. old "Groceries" rows after the owner renames a *different* category to "Groceries") → low-likelihood at single-user scale; the fallback is a convenience, and any mismatch degrades to "Uncategorised", never to a wrong write.
- **Auto-categorisation can surprise** by assigning from a stray comment word → mitigated by whole-word matching, the single-distinct-category rule, only-when-uncategorised application, and the visible "categorised via …" tooltip so the owner can see and correct it.
- **Uniqueness is enforced app-side, not by rules** → two rapid concurrent edits could in principle both pass the check; negligible for a single owner editing their own doc, and the worst case is a duplicate term the owner can remove.
- **Terms edited after the fact don't re-run on history** → intentional; auto-categorisation is a save-time convenience, and past spendings stay reassignable by hand.

## Migration Plan

- No data migration or backfill. New writes store category ids; existing spendings keep their stored name string and resolve via the case-insensitive name fallback until their category is renamed/removed.
- Deploy order: ship the shared domain (`categorize`, relaxed validation, `autoMatchedTerm`, slug ids) and the relaxed `firestore.rules` together, then the web categories UI. Because rules only *relax*, older clients keep working during rollout.
- Rollback: revert `firestore.rules` and the shared/web changes together; already-written category ids will fall back to "Uncategorised" under the old name-based render, with no data loss.

## Open Questions

- None blocking. Defer to future changes: whether ambiguous matches should flag `needsReview`, and whether legacy name-based spendings should be one-time backfilled to ids once the feature is stable.
