import * as React from 'react';
import { shortDate, type Spending } from '@expenses/shared';
import { ArrowDown, ArrowUp, Pencil } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { SortableHeader } from '@/components/SortableHeader';

interface DrilldownTransactionsTableProps {
  spendings: Spending[];
  onEdit: (spending: Spending) => void;
}

type SortKey = 'date' | 'amount' | 'comment';

/**
 * The drill-down's transactions table: Date/Amount/Comment, each sortable —
 * activating a column's header sorts ascending, activating the already-active
 * column again reverses direction — plus a non-sortable Edit action. Scrolls
 * internally with a sticky header rather than growing the page (design.md
 * risk: a year-view drill-down can have 100+ rows).
 */
export function DrilldownTransactionsTable({ spendings, onEdit }: DrilldownTransactionsTableProps) {
  const [sortKey, setSortKey] = React.useState<SortKey | null>(null);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const rows = React.useMemo(() => {
    if (!sortKey) return spendings;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...spendings].sort((a, b) => {
      if (sortKey === 'amount') return (a.amount - b.amount) * dir;
      if (sortKey === 'date') return a.date.localeCompare(b.date) * dir;
      return a.comment.localeCompare(b.comment) * dir;
    });
  }, [spendings, sortKey, sortDir]);

  function SortHeader({ sortKeyName, label }: { sortKeyName: SortKey; label: string }) {
    const active = sortKey === sortKeyName;
    return (
      <SortableHeader
        label={label}
        active={active}
        activeIcon={
          sortDir === 'asc' ? (
            <ArrowUp className="size-3.5 text-primary" />
          ) : (
            <ArrowDown className="size-3.5 text-primary" />
          )
        }
        onClick={() => handleSort(sortKeyName)}
        title={
          active
            ? `Sorted by ${label.toLowerCase()} — click to reverse`
            : `Sort by ${label.toLowerCase()}`
        }
      />
    );
  }

  if (spendings.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
        No transactions in this period.
      </div>
    );
  }

  return (
    <div className="max-h-96 overflow-auto rounded-xl border">
      <Table>
        <TableHeader className="sticky top-0 bg-card">
          <TableRow>
            <TableHead className="w-28">
              <SortHeader sortKeyName="date" label="Date" />
            </TableHead>
            <TableHead className="w-20 text-right">
              <SortHeader sortKeyName="amount" label="Amount" />
            </TableHead>
            <TableHead>
              <SortHeader sortKeyName="comment" label="Comment" />
            </TableHead>
            <TableHead className="w-14 text-right">Edit</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => (
            <TableRow key={s.id}>
              <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                {shortDate(s.date)}
              </TableCell>
              <TableCell className="text-right font-medium tabular-nums">
                {s.amount.toLocaleString()}
              </TableCell>
              <TableCell className="max-w-[16rem] truncate text-muted-foreground">
                {s.comment}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="icon" aria-label="Edit" onClick={() => onEdit(s)}>
                  <Pencil />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
