import * as React from 'react';
import { UNCATEGORIZED, type CategoryValue, type Spending } from '@expenses/shared';
import { Pencil, Trash2, AlertTriangle } from 'lucide-react';
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
}

/** Current-month table: amount, date, category, comment — latest on top. */
export function SpendingTable({ spendings, onEdit }: SpendingTableProps) {
  const [pendingDelete, setPendingDelete] = React.useState<Spending | null>(null);
  const [deleting, setDeleting] = React.useState(false);

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
            <TableHead className="w-20 text-right">Amount</TableHead>
            <TableHead className="w-28">Date</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Comment</TableHead>
            <TableHead className="w-20 text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {spendings.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="text-right font-medium tabular-nums">
                {s.needsReview ? (
                  <span className="inline-flex items-center gap-1 text-amber-500">
                    <AlertTriangle className="size-3.5" />?
                  </span>
                ) : (
                  s.amount.toLocaleString()
                )}
              </TableCell>
              <TableCell className="tabular-nums text-muted-foreground">{s.date}</TableCell>
              <TableCell>
                {s.category === UNCATEGORIZED ? (
                  <div className="w-40">
                    {/* Inline categorize-later: assigning removes it from the uncategorized set. */}
                    <CategorySelect
                      value={UNCATEGORIZED}
                      allowUncategorized={false}
                      placeholder="Assign…"
                      onChange={(c: CategoryValue) => assignCategory(s.id, c)}
                    />
                  </div>
                ) : (
                  <Badge variant="secondary">{s.category}</Badge>
                )}
              </TableCell>
              <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                {s.comment}
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
          ))}
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
