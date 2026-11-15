## 1. Shared parsing

- [x] 1.1 Add optional `importId` to `SpendingDoc` and `Spending` in `shared/src/types.ts`
- [x] 1.2 Add `shared/src/csvImport.ts`: a CSV reader (quotes, `""`, embedded commas/newlines, CRLF, BOM, blank lines), header mapping, the 500-row cap, strict amount parsing + round-up, and category resolution (name match → `applyAutoCategory` → uncategorized), returning a file error or draft rows
- [x] 1.3 Add `importRowErrors(row)` (derived validity via `validateSpending`) and `importRowToInput(row)` helpers; export the module from `shared/src/index.ts`
- [x] 1.4 Unit tests in `tests/domain.test.mjs` covering format, size limit, row validation and category resolution scenarios

## 2. Data source

- [x] 2.1 Add `createSpendings(inputs, { source, importId })` to the `DataSource` interface
- [x] 2.2 Implement it in `FirestoreDataSource` with one `writeBatch` (validate all inputs first, then write each with `importId` + `serverTimestamp()`); pass `importId` through on reads
- [x] 2.3 Implement it in `DemoDataSource` (validate all, single append + notify); add vitest coverage, including all-or-nothing on an invalid input

## 3. Import screen

- [x] 3.1 Add an `onSave` draft mode to `SpendingForm` (no data-source write; show an empty amount field for a non-finite amount)
- [x] 3.2 Add `ImportPage`: file picker, file-level error, summary counts, preview table (invalid rows greyed with line number + reason, inline category assign, edit, remove), Cancel and Apply N
- [x] 3.3 Apply: generate `importId`, call `createSpendings` with valid rows, show a success toast and navigate to the dashboard; on error show it inline and keep the draft (no `try … finally`)
- [x] 3.4 Register an `import` route in the shared route tree and add a dashboard header button that navigates to it

## 4. Verify

- [x] 4.1 `npm run build:shared && npm run build:web`, `npm run test:domain`, `npm run test:web` all pass
- [x] 4.2 Smoke test in `/demo/import` with a sample CSV (valid, invalid, matched, keyword-matched, unknown category)
- [x] 4.3 `openspec validate add-csv-import` passes
