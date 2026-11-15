## Context

The owner wants to bulk-add spendings from a CSV they write themselves, in the app's own format. This was explored interactively. The decisions below come out of that conversation:

- RON only.
- Preview before apply, with every field editable.
- Categories matched by name, then by keyword, and never created.
- `importId` kept for manual cleanup, with no undo feature.
- At most 500 rows.

Relevant existing pieces:

- `validateSpending` / `assertValidSpending` and `roundUpAmount` are the shared validation and rounding rules.
- `findCategoryByName` and `applyAutoCategory` already implement name lookup and the keyword policy.
- `DataSource` is the only way components read or write data, with a Firestore and a demo implementation.
- `SpendingForm` has an edit mode that already omits the currency control.
- The Firestore rules check required keys, field types and `source in ['web','voice','rest']`. They do **not** reject extra keys.

## Goals / Non-Goals

**Goals:**
- Get a few to 500 owner-authored rows into the app with a review step.
- Use exactly the same validation, rounding and categorisation rules as the existing write paths.
- An import is atomic: either every applied row lands or none do.
- Every imported row can be found later by `importId`.

**Non-Goals:**
- Bank or third-party CSV formats, column mapping, `;` separators, `,` decimals, other date formats.
- Foreign currencies or historical FX.
- Undo, duplicate detection, re-import detection.
- Persisting a draft across reloads or app kills.
- Creating categories from the file.

## Decisions

1. **Parsing lives in `shared/` as pure functions.** `parseSpendingsCsv(text, categories)` returns either a file-level error or a list of draft rows. It is unit-tested in the existing `node --test` domain suite, which already runs in CI. The web layer only reads the file (`File.text()`) and renders.

2. **A small hand-written CSV reader, no dependency.** It handles RFC 4180 basics: comma separator, double-quoted fields, `""` escapes, commas and newlines inside quotes, CRLF/LF, a leading UTF-8 BOM, and skipping blank lines. A library such as PapaParse would mostly bring dialect detection, which we deliberately don't want.

3. **The header row is required and matched by name.** Header names are trimmed and case-insensitive, and columns can be in any order. Columns other than `date`, `amount`, `comment` and `category` are ignored. A missing `date` or `amount` header is a file-level error. Rows with more or fewer cells than the header are tolerated: missing cells read as empty and extra cells are ignored. This keeps hand-edited files forgiving.

4. **File-level vs row-level errors.**
   - File-level errors block the whole file: empty file, missing required headers, more than 500 data rows, or no data rows.
   - Row-level errors grey out and skip only that row: unparseable or non-positive amount, invalid date.
   - The 500 cap matches the Firestore `writeBatch` limit, so one apply is one atomic batch.

5. **Strict amounts: `^\d+(\.\d+)?$` after trimming.** No sign, no thousands separators, no `,` decimal. A valid value is rounded up with `roundUpAmount`. Anything else is a row error whose message says the expected format. Zero fails the existing `validateSpending` positive-integer rule.

6. **Category resolution happens at parse time, using the shared helpers.**
   1. A non-empty CSV category goes through `findCategoryByName` (case-insensitive). On a match, the row stores that category's id.
   2. Otherwise the row starts `uncategorized`, and `applyAutoCategory` runs against the comment. That sets `autoMatchedTerm` on a single match.
   3. An unmatched CSV category name is dropped silently, as the owner chose.
   
   The `uncategorized` literal needs no special case: it never matches a category name.

7. **Draft rows are plain view state, and validity is recomputed.** A draft row holds `{ key, line, amount: number | null, date, comment, category, autoMatchedTerm? }`. A row's error list is derived from it every render through the shared validator, not stored. So fixing an invalid row in the edit dialog turns it valid with no extra bookkeeping. The `line` number (1-based, counting the header) is shown for invalid rows so the owner can find them in the file.

8. **Reuse `SpendingForm` for row edits through an `onSave` draft mode.** When `onSave` is passed, the form runs its normal edit-mode logic, then hands the resulting `SpendingInput` to the callback and closes instead of calling the data source. The edit dialog already has no currency control. The draft row is adapted to a `Spending` shape for `editing`. An unparseable amount (`null`) shows as an empty field instead of `NaN`.
   - **Consequence:** saving the dialog applies the form's usual save-time rule. If the row is left uncategorized, keyword matching runs again on the edited comment, exactly as it does when editing on the dashboard. Keyword matching runs once at parse time, and again only through this existing rule. It never overrides a chosen category.

9. **Bulk write: `DataSource.createSpendings(inputs, { source, importId })`.**
   - Firestore: each input is rounded and validated with `assertValidSpending`, exactly like `createSpending`. If any input is invalid, the method throws before writing anything. All documents go into one `writeBatch`, each with `serverTimestamp()` and `importId`. The batch is committed once.
   - Demo: the same validation, then one in-memory append and one listener notification.
   - The UI only passes valid rows. The data source still validates, so it never trusts the caller.

10. **`importId` is a `crypto.randomUUID()` generated per apply.** It is stored as an optional string field on `SpendingDoc` / `Spending`. Spendings created by the form, voice or REST don't have it. Reads pass it through so the field exists end to end, but no UI uses it. Manual cleanup is a console/Admin query on `importId == X`.

11. **`source` stays `'web'`.** The owner chose this. With `importId` present, a separate source value adds nothing and would need a change to the Firestore rules allowlist.

12. **The screen at `/import`.** It joins the shared route tree, so it gets `/demo/import` automatically. It is reached from a header icon on the dashboard, and navigation pushes a history entry (Back returns to the dashboard).

    Layout:
    - a file picker (`accept=".csv,text/csv"`);
    - a summary line: valid / skipped / uncategorized counts;
    - the preview table: date, amount, comment, category, and actions (edit, remove);
    - footer actions: Cancel and Apply N.

    On success: a toast "Imported N spendings", then navigate to the dashboard. On failure: an inline error, and the draft is kept so the owner can retry. Picking a new file replaces the draft.

13. **No `try … finally` in the new component** (React Compiler rule in CLAUDE.md). The apply handler uses `try/catch` and resets state in both branches.

## Risks / Trade-offs

- **Draft lost on app kill.** Android can kill a backgrounded PWA mid-review. This is accepted for small imports. Saving the draft to localStorage can come later.
- **An offline apply stays pending.** With Firestore offline persistence, `batch.commit()` resolves only after the server acknowledges. Offline, the button stays in "Importing…" while the writes are already queued locally and will sync. This is the same behaviour as the existing single-entry form, so it is accepted.
- **Silently dropped category names.** A typo in the CSV category falls through to keyword matching or uncategorized without telling the owner. The owner chose this. The preview still shows the result, so the owner sees it before applying.
- **Re-applying the same file duplicates rows.** There is no duplicate detection. The `importId` makes cleanup a single query.
