/**
 * CSV import (add-csv-import): turn an owner-authored CSV in the app's own
 * format into editable draft rows for the import preview. Pure — no I/O, no
 * Firestore — so it runs in the domain test suite.
 *
 * Format: a header row naming `date` and `amount` (required) and optionally
 * `comment` and `category`, in any order and case; `YYYY-MM-DD` dates; RON
 * amounts with `.` decimals, rounded up like every other entry path.
 */
import {
  categorize,
  findCategoryByName,
  UNCATEGORIZED,
  type CategoryValue,
} from './categories.js';
import { roundUpAmount } from './money.js';
import type { Category, SpendingInput } from './types.js';
import { validateSpending } from './validation.js';

/** Most data rows one import may hold — also Firestore's `writeBatch` op limit (design.md D4). */
export const MAX_IMPORT_ROWS = 500;

/** Shown for an amount cell that isn't a plain `.`-decimal number. */
export const IMPORT_AMOUNT_FORMAT_ERROR = 'amount must be a number like 12 or 12.50';

/**
 * One editable row of the import preview. Validity is NOT stored — derive it
 * with {@link importRowErrors}, so fixing a row in the editor makes it valid
 * without extra bookkeeping (design.md D7).
 */
export interface ImportDraftRow {
  /** Stable React key for the row. */
  key: string;
  /** 1-based line in the file where the row starts (the header is line 1 or later). */
  line: number;
  /** Rounded-up whole RON, or `null` when the cell was empty or unparseable. */
  amount: number | null;
  /** Trimmed date cell; validated, not normalised. */
  date: string;
  comment: string;
  category: CategoryValue;
  /** Set when the category came from keyword matching. */
  autoMatchedTerm?: string;
}

export type ParseImportResult =
  | { ok: true; rows: ImportDraftRow[] }
  | { ok: false; error: string };

interface CsvRecord {
  line: number;
  cells: string[];
}

/**
 * Minimal RFC 4180 reader (design.md D2): `,` separator, `"`-quoted fields with
 * `""` escapes, commas/newlines inside quotes, LF or CRLF, leading BOM ignored.
 * A `"` only opens a quoted section at the very start of a field; anywhere
 * else (e.g. an inch mark in `TV 55" stand`) it is a literal character. A
 * quoted section still open at end of input is a file-level error.
 * Records whose cells are all blank are dropped. Each record keeps the
 * physical line it started on, for pointing the owner at bad rows.
 */
function readCsv(text: string): { records: CsvRecord[] } | { error: string } {
  const src = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let field = '';
  let inQuotes = false;
  let line = 1;
  let recordLine = 1;
  // Whether the current field started with an opening quote (only then can
  // a `"` open a quoted section), and where it opened, for the error message.
  let fieldStarted = false;
  let quoteLine = 1;

  const endRecord = () => {
    cells.push(field);
    if (cells.some((c) => c.trim() !== '')) records.push({ line: recordLine, cells });
    cells = [];
    field = '';
    fieldStarted = false;
  };

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        if (ch === '\n') line++;
        field += ch;
      }
      continue;
    }
    if (ch === '"' && !fieldStarted) {
      inQuotes = true;
      fieldStarted = true;
      quoteLine = line;
    } else if (ch === ',') {
      cells.push(field);
      field = '';
      fieldStarted = false;
    } else if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      endRecord();
      line++;
      recordLine = line;
    } else {
      field += ch;
      fieldStarted = true;
    }
  }
  if (inQuotes) {
    return { error: `Missing closing quote for the field starting on line ${quoteLine}.` };
  }
  endRecord();
  return { records };
}

/** Strict amount cell → rounded-up whole units, or `null` (design.md D5). */
function parseImportAmount(raw: string): number | null {
  const value = raw.trim();
  if (!/^\d+(\.\d+)?$/.test(value)) return null;
  return roundUpAmount(Number(value));
}

/**
 * Category resolution (design.md D6): an existing category named by the cell
 * (case-insensitive) wins; otherwise keyword matching on the comment; otherwise
 * uncategorized. Unknown names are dropped silently and nothing is created.
 */
function resolveImportCategory(
  rawCategory: string,
  comment: string,
  categories: readonly Category[],
): Pick<ImportDraftRow, 'category' | 'autoMatchedTerm'> {
  const named = findCategoryByName(rawCategory, categories);
  if (named) return { category: named.id };
  const match = categorize(comment, categories);
  return match
    ? { category: match.categoryId, autoMatchedTerm: match.matchedTerm }
    : { category: UNCATEGORIZED };
}

/**
 * Parse a CSV file's text into draft rows, or a file-level error that blocks
 * the whole import (missing headers, empty, over {@link MAX_IMPORT_ROWS}).
 * Row-level problems never fail the parse — see {@link importRowErrors}.
 */
export function parseSpendingsCsv(
  text: string,
  categories: readonly Category[],
): ParseImportResult {
  const read = readCsv(text);
  if ('error' in read) return { ok: false, error: read.error };
  const { records } = read;
  if (records.length === 0) return { ok: false, error: 'The file is empty.' };

  const [header, ...data] = records;
  const columns = header.cells.map((c) => c.trim().toLowerCase());
  const col = (name: string) => columns.indexOf(name);
  const missing = ['date', 'amount'].filter((name) => col(name) === -1);
  if (missing.length > 0) {
    return {
      ok: false,
      error: `Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`,
    };
  }
  if (data.length === 0) return { ok: false, error: 'The file has no rows to import.' };
  if (data.length > MAX_IMPORT_ROWS) {
    return {
      ok: false,
      error: `At most ${MAX_IMPORT_ROWS} rows can be imported at once; this file has ${data.length}.`,
    };
  }

  // A short row reads its missing cells as empty; extra cells are ignored (D3).
  const cell = (cells: string[], name: string) => {
    const i = col(name);
    return i === -1 ? '' : (cells[i] ?? '');
  };

  const rows = data.map(({ line, cells }): ImportDraftRow => {
    const comment = cell(cells, 'comment').trim();
    return {
      key: `line-${line}`,
      line,
      amount: parseImportAmount(cell(cells, 'amount')),
      date: cell(cells, 'date').trim(),
      comment,
      ...resolveImportCategory(cell(cells, 'category'), comment, categories),
    };
  });
  return { ok: true, rows };
}

/** The row as a `SpendingInput` (amount `NaN` when unparseable, so it fails validation). */
export function importRowToInput(row: ImportDraftRow): SpendingInput {
  return {
    amount: row.amount ?? Number.NaN,
    date: row.date,
    comment: row.comment,
    category: row.category,
    ...(row.autoMatchedTerm ? { autoMatchedTerm: row.autoMatchedTerm } : {}),
  };
}

/** Why a row would be skipped on apply; empty means it is valid. Same rules as every write path. */
export function importRowErrors(row: ImportDraftRow): string[] {
  if (row.amount === null) {
    const { errors } = validateSpending({ ...importRowToInput(row), amount: 1 });
    return [IMPORT_AMOUNT_FORMAT_ERROR, ...errors];
  }
  return validateSpending(importRowToInput(row)).errors;
}
