## Why

The only way to get spendings in today is one at a time (form, voice, or the private REST endpoint). Backfilling history or a batch kept elsewhere means retyping every row. The owner writes their CSVs in the app's own format, so a bulk import with a preview step before anything is saved covers this without bank-format parsing.

## What Changes

- New **Import** screen at `/import` (and `/demo/import`), reached from the dashboard header. It is designed for the installed PWA.
- The owner picks a CSV in the app's format: a header row `date,amount,comment,category` (only `date` and `amount` required), `YYYY-MM-DD` dates, `.` as the decimal point, amounts in RON. Fractional amounts round up as they do everywhere else.
- At most 500 data rows per file. A larger file is rejected up front, never cut off.
- Each row gets a category in this order:
  1. a CSV category that matches an existing category by name (case-insensitive);
  2. otherwise the existing keyword auto-matching on the comment;
  3. otherwise uncategorized.
  
  Categories are never created. Unknown category names are never shown.
- The preview looks like the dashboard table:
  - Every field of a row can be edited, using the existing edit dialog, which has no currency control.
  - Uncategorized rows can be assigned inline.
  - Rows can be removed.
  - Invalid rows are greyed out with the reason and are skipped.
- **Apply** writes all valid rows at once with a new bulk `DataSource.createSpendings()`. Every row is stored with `source: 'web'` plus a shared `importId`, so an import can be found and cleaned up manually later.
- There is no undo feature, no duplicate detection, and no draft persistence. The preview lives only in memory.

## Capabilities

### New Capabilities
- `csv-import`: the CSV format, parsing and row validation, category resolution, the preview/edit screen, and the apply semantics (atomic bulk write, `importId` tagging).

### Modified Capabilities
- `data-source-abstraction`: the `DataSource` interface gains a bulk create operation.
- `app-navigation`: a new routed Import screen at `/import`.

## Impact

- `shared/`: a new pure CSV parsing + row-resolution module, plus unit tests in `tests/domain.test.mjs`. An optional `importId` field on the stored spending types.
- `web/`:
  - new `ImportPage` component and route;
  - an import entry button on the dashboard header;
  - `SpendingForm` gains a draft-save mode, so the preview reuses it without writing to the data source;
  - `createSpendings` added to `FirestoreDataSource` (one `writeBatch`) and `DemoDataSource`.
- No Firestore rules change: the rules check required keys and allow extra ones, and `source` stays `'web'`. No new dependencies; the CSV parser is hand-written. No backend or REST changes.
