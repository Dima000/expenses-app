import * as React from 'react';
import { ArrowLeft, FileUp, Pencil, Trash2 } from 'lucide-react';
import {
  colorIdFor,
  importRowErrors,
  importRowToInput,
  MAX_IMPORT_ROWS,
  parseSpendingsCsv,
  resolveCategory,
  shortDate,
  type Category,
  type CategoryValue,
  type ImportDraftRow,
  type Spending,
  type SpendingInput,
} from '@expenses/shared';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CategorySelect } from '@/components/CategorySelect';
import { CategoryColorDot } from '@/components/CategoryColorDot';
import { SpendingForm } from '@/components/SpendingForm';
import { useDataSource } from '@/lib/dataSource';
import { useToast } from '@/hooks/use-toast';

interface ImportPageProps {
  /** The owner's live categories — for parse-time resolution and the pickers. */
  categories: Category[];
  /** Leave the screen (Cancel/Back, and after a successful apply). */
  onClose: () => void;
}

/** A draft row in the `Spending` shape the edit dialog expects (design.md D8). */
function rowAsSpending(row: ImportDraftRow): Spending {
  return { ...importRowToInput(row), id: row.key, ownerUid: '', source: 'web', createdAtMs: null };
}

/**
 * CSV import (add-csv-import): pick a file, review and fix every row in an
 * in-memory preview, then apply all valid rows as one atomic bulk write.
 * Nothing is stored until Apply.
 */
export function ImportPage({ categories, onClose }: ImportPageProps) {
  const dataSource = useDataSource();
  const { toast } = useToast();
  const fileInput = React.useRef<HTMLInputElement>(null);
  // `null` = no file parsed yet.
  const [rows, setRows] = React.useState<ImportDraftRow[] | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  // Held in state, not derived per render: the edit dialog resets its fields
  // whenever `editing` changes identity.
  const [editing, setEditing] = React.useState<Spending | null>(null);
  const [applying, setApplying] = React.useState(false);
  const [applyError, setApplyError] = React.useState<string | null>(null);

  // Validity is derived on every render, so an edit that fixes a row is
  // reflected immediately (design.md D7).
  const checked = (rows ?? []).map((row) => ({ row, errors: importRowErrors(row) }));
  const valid = checked.filter((c) => c.errors.length === 0).map((c) => c.row);
  const skippedCount = checked.length - valid.length;
  const uncategorizedCount = valid.filter((r) => resolveCategory(r.category, categories) === null).length;

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Clear so picking the same file again still fires `change`.
    e.target.value = '';
    if (!file) return;
    file
      .text()
      .then((text) => {
        const result = parseSpendingsCsv(text, categories);
        setFileName(file.name);
        setApplyError(null);
        if (result.ok) {
          setRows(result.rows);
          setFileError(null);
        } else {
          setRows(null);
          setFileError(result.error);
        }
      })
      .catch(() => {
        setRows(null);
        setFileError('Could not read the file.');
      });
  }

  function updateRow(key: string, patch: Partial<ImportDraftRow>) {
    setRows((prev) => prev?.map((r) => (r.key === key ? { ...r, ...patch } : r)) ?? prev);
  }

  function removeRow(key: string) {
    setRows((prev) => prev?.filter((r) => r.key !== key) ?? prev);
  }

  function saveEdit(input: SpendingInput) {
    if (!editing) return;
    updateRow(editing.id, {
      amount: input.amount,
      date: input.date,
      comment: input.comment,
      category: input.category,
      autoMatchedTerm: input.autoMatchedTerm,
    });
  }

  async function apply() {
    if (valid.length === 0) return;
    const count = valid.length;
    setApplying(true);
    setApplyError(null);
    try {
      await dataSource.createSpendings(valid.map(importRowToInput), {
        source: 'web',
        importId: crypto.randomUUID(),
      });
    } catch (err) {
      // Keep the draft so the owner can retry (design.md D12).
      setApplying(false);
      setApplyError(err instanceof Error ? err.message : 'Import failed');
      return;
    }
    setApplying(false);
    toast({ title: `Imported ${count} spending${count === 1 ? '' : 's'}` });
    onClose();
  }

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-28 pt-6">
      <header className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" aria-label="Back" onClick={onClose}>
          <ArrowLeft />
        </Button>
        <h1 className="text-xl font-semibold">Import CSV</h1>
      </header>

      <input
        ref={fileInput}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFile}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => fileInput.current?.click()} disabled={applying}>
          <FileUp className="mr-1" /> {rows ? 'Choose another file' : 'Choose CSV file'}
        </Button>
        {fileName && <span className="truncate text-sm text-muted-foreground">{fileName}</span>}
      </div>

      {fileError && <p className="mb-4 text-sm text-destructive">{fileError}</p>}

      {!rows && (
        <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
          <p className="mb-2">
            One spending per row, amounts in RON, up to {MAX_IMPORT_ROWS} rows. The first row
            names the columns:
          </p>
          <pre className="mb-2 overflow-x-auto rounded-md bg-muted p-3 text-xs">
            {'date,amount,comment,category\n2026-03-02,45.50,weekly market run,Groceries\n2026-03-03,12,coffee,'}
          </pre>
          <p>
            <code>comment</code> and <code>category</code> are optional. Categories must match an
            existing name; otherwise keywords are used. You can review and edit everything before
            importing.
          </p>
        </div>
      )}

      {rows && (
        <>
          <p className="mb-3 text-sm text-muted-foreground">
            {valid.length} to import
            {skippedCount > 0 && ` · ${skippedCount} skipped`}
            {uncategorizedCount > 0 && ` · ${uncategorizedCount} uncategorized`}
          </p>

          {rows.length === 0 ? (
            <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
              All rows removed.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead className="w-16 text-right">Amount</TableHead>
                  <TableHead>Comment</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="w-20 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {checked.map(({ row, errors }) => {
                  const invalid = errors.length > 0;
                  const resolved = resolveCategory(row.category, categories);
                  // Greyed out, but still editable/removable so it can be fixed.
                  const dim = invalid ? 'opacity-50' : undefined;
                  return (
                    <TableRow key={row.key}>
                      <TableCell
                        className={`whitespace-nowrap tabular-nums text-muted-foreground ${dim ?? ''}`}
                      >
                        {row.date ? shortDate(row.date) : '—'}
                      </TableCell>
                      <TableCell className={`text-right font-medium tabular-nums ${dim ?? ''}`}>
                        {row.amount === null ? '—' : row.amount.toLocaleString()}
                      </TableCell>
                      <TableCell className="max-w-[12.8rem] text-muted-foreground">
                        <div className={`truncate ${dim ?? ''}`}>{row.comment}</div>
                        {invalid && (
                          <div className="text-xs text-destructive">
                            Line {row.line}: {errors.join('; ')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className={dim}>
                        {resolved ? (
                          <Badge variant="secondary" className="gap-1.5">
                            <CategoryColorDot
                              colorId={colorIdFor(resolved, categories.indexOf(resolved))}
                            />
                            {resolved.name}
                          </Badge>
                        ) : (
                          <div className="w-40">
                            <CategorySelect
                              value=""
                              categories={categories}
                              allowUncategorized={false}
                              placeholder="Assign…"
                              onChange={(c: CategoryValue) =>
                                updateRow(row.key, { category: c, autoMatchedTerm: undefined })
                              }
                            />
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit"
                            onClick={() => setEditing(rowAsSpending(row))}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Remove from import"
                            onClick={() => removeRow(row.key)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {applyError && <p className="mt-4 text-sm text-destructive">{applyError}</p>}

          <div className="fixed inset-x-0 bottom-6 z-40 mx-auto flex max-w-2xl items-center justify-end gap-3 px-4">
            <Button variant="outline" size="lg" className="shadow-lg" onClick={onClose} disabled={applying}>
              Cancel
            </Button>
            <Button
              size="lg"
              className="shadow-lg"
              onClick={() => void apply()}
              disabled={applying || valid.length === 0}
            >
              {applying ? 'Importing…' : `Import ${valid.length}`}
            </Button>
          </div>
        </>
      )}

      <SpendingForm
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        categories={categories}
        editing={editing}
        onSave={saveEdit}
      />
    </div>
  );
}
