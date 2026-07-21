import * as React from 'react';
import {
  resolveCategory,
  shortDate,
  type Category,
  type CategoryValue,
  type Spending,
} from '@expenses/shared';
import { Pencil, Trash2, AlertTriangle, ArrowUpDown, ArrowDownAZ } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CategorySelect } from '@/components/CategorySelect';
import { assignCategory, deleteSpending } from '@/lib/spendings';

interface SpendingTableProps {
  spendings: Spending[];
  onEdit: (spending: Spending) => void;
  /** The owner's live categories, for resolving each row's stored id → name. */
  categories: Category[];
  /** True while the first month snapshot is still pending. */
  loading?: boolean;
}

/**
 * Current-month table: date, amount, comment, category — latest on top.
 * `spendings` arrives ordered date-desc; sorting by category is a reversible
 * client-side view that falls back to that default when cleared.
 */
export function SpendingTable({ spendings, onEdit, categories, loading }: SpendingTableProps) {
  const [pendingDelete, setPendingDelete] = React.useState<Spending | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [sortByCategory, setSortByCategory] = React.useState(false);

  async function confirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteSpending(pendingDelete.id);
      setPendingDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  // Category sort keeps the incoming date-desc order as a stable tiebreak, so
  // rows stay newest-first within each category. Clearing it returns to default.
  const rows = React.useMemo(() => {
    if (!sortByCategory) return spendings;
    // Decorate with the resolved label once, so the comparison sort doesn't
    // re-resolve each row on every comparison.
    return spendings
      .map((s, i) => ({
        s,
        i,
        label: resolveCategory(s.category, categories)?.name ?? 'Uncategorised',
      }))
      .sort((a, b) => a.label.localeCompare(b.label) || a.i - b.i)
      .map(({ s }) => s);
  }, [spendings, sortByCategory, categories]);

  if (loading) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (spendings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        No spendings this month yet. Tap the mic or add one manually.
      </div>
    );
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-24">Date</TableHead>
            <TableHead className="w-16 text-right">Amount</TableHead>
            <TableHead>Comment</TableHead>
            <TableHead>
              <button
                type="button"
                className={
                  sortByCategory
                    ? 'inline-flex items-center gap-1 font-medium text-foreground'
                    : 'inline-flex items-center gap-1 hover:text-foreground'
                }
                onClick={() => setSortByCategory((v) => !v)}
                aria-pressed={sortByCategory}
                title={sortByCategory ? 'Sorted by category — click to clear' : 'Sort by category'}
              >
                Category
                {sortByCategory ? (
                  <ArrowDownAZ className="size-3.5 text-primary" />
                ) : (
                  <ArrowUpDown className="size-3.5 opacity-40" />
                )}
              </button>
            </TableHead>
            <TableHead className="w-20 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => {
            const resolved = resolveCategory(s.category, categories);
            return (
            <TableRow key={s.id}>
              <TableCell className="tabular-nums text-muted-foreground">
                {shortDate(s.date)}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {s.needsReview ? (
                  <span className="inline-flex items-center gap-1 text-amber-500">
                    <AlertTriangle className="size-3.5" />?
                  </span>
                ) : (
                  s.amount.toLocaleString()
                )}
              </TableCell>
              <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                {s.comment}
              </TableCell>
              <TableCell>
                {resolved ? (
                  <Badge variant="secondary">{resolved.name}</Badge>
                ) : (
                  <div className="w-40">
                    {/* Inline categorize-later: assigning removes it from the uncategorized set.
                        Covers both `uncategorized` and rows whose category no longer resolves. */}
                    <CategorySelect
                      value=""
                      categories={categories}
                      allowUncategorized={false}
                      placeholder="Assign…"
                      onChange={(c: CategoryValue) => assignCategory(s.id, c)}
                    />
                  </div>
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => onEdit(s)}>
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete"
                    onClick={() => setPendingDelete(s)}
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

      <Dialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this spending?</DialogTitle>
            <DialogDescription>
              This permanently removes the entry. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
