import * as React from 'react';
import { UNCATEGORIZED, validateSpending, type CategoryValue, type Spending } from '@expenses/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CategorySelect } from '@/components/CategorySelect';
import { createSpending, updateSpending } from '@/lib/spendings';
import { todayString } from '@/lib/date';

interface SpendingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerUid: string;
  /** When set, the form edits this spending; otherwise it creates a new one. */
  editing?: Spending | null;
  /** Prefill date for new entries (defaults to today). */
  defaultDate?: string;
}

/** Add/edit spending form. Create and edit share one validated form. */
export function SpendingForm({ open, onOpenChange, ownerUid, editing, defaultDate }: SpendingFormProps) {
  const [amount, setAmount] = React.useState('');
  const [date, setDate] = React.useState(todayString());
  const [category, setCategory] = React.useState<CategoryValue>(UNCATEGORIZED);
  const [comment, setComment] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Reset the fields whenever the dialog opens (for add or a specific edit).
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setAmount(String(editing.amount));
      setDate(editing.date);
      setCategory(editing.category);
      setComment(editing.comment ?? '');
    } else {
      setAmount('');
      setDate(defaultDate ?? todayString());
      setCategory(UNCATEGORIZED);
      setComment('');
    }
  }, [open, editing, defaultDate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = Number(amount);
    const input = {
      amount: Number.isFinite(parsed) ? Math.ceil(parsed) : NaN,
      date,
      category,
      comment: comment.trim(),
    };
    const { ok, errors } = validateSpending(input);
    if (!ok) {
      setError(errors[0]);
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateSpending(editing.id, { ...input, needsReview: false });
      } else {
        await createSpending(input, ownerUid, 'web');
      }
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit spending' : 'Add spending'}</DialogTitle>
          <DialogDescription>
            Amounts are stored in whole units; fractional values round up.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <CategorySelect id="category" value={category} onChange={setCategory} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="comment">Comment</Label>
            <Input
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Optional note"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add spending'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
