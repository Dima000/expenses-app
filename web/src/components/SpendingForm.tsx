import * as React from 'react';
import {
  UNCATEGORIZED,
  applyAutoCategory,
  parseAmountFromTranscript,
  validateSpending,
  type Category,
  type CategoryValue,
  type Spending,
  type SpendingInput,
  type SpendingSource,
} from '@expenses/shared';
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
  /** The owner's live categories — for the picker and save-time auto-categorisation. */
  categories: Category[];
  /** When set, the form edits this spending; otherwise it creates a new one. */
  editing?: Spending | null;
  /** Prefill date for new entries (defaults to today). */
  defaultDate?: string;
  /** Seed amount/comment/category for a new entry (add mode only, e.g. from voice). */
  prefill?: { amount?: string; comment?: string; category?: CategoryValue } | null;
  /** Source recorded when creating a new entry (defaults to 'web'). */
  addSource?: SpendingSource;
}

/** Add/edit spending form. Create and edit share one validated form. */
export function SpendingForm({
  open,
  onOpenChange,
  ownerUid,
  categories,
  editing,
  defaultDate,
  prefill,
  addSource = 'web',
}: SpendingFormProps) {
  // Edit mode binds discrete amount/comment fields; add mode uses one free-text
  // field (`entry`) that is parsed into amount + comment on submit.
  const [amount, setAmount] = React.useState('');
  const [comment, setComment] = React.useState('');
  const [entry, setEntry] = React.useState('');
  const [date, setDate] = React.useState(todayString());
  const [category, setCategory] = React.useState<CategoryValue>(UNCATEGORIZED);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Reset the fields whenever the dialog opens (for add or a specific edit).
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    if (editing) {
      setAmount(String(editing.amount));
      setComment(editing.comment ?? '');
      setDate(editing.date);
      setCategory(editing.category);
    } else {
      // Seed the free-text field from any prefill (e.g. voice: "12 lunch").
      setEntry([prefill?.amount, prefill?.comment].filter(Boolean).join(' '));
      setDate(defaultDate ?? todayString());
      setCategory(prefill?.category ?? UNCATEGORIZED);
    }
  }, [open, editing, defaultDate, prefill]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let inputAmount: number;
    let inputComment: string;
    if (editing) {
      const parsed = Number(amount);
      inputAmount = Number.isFinite(parsed) ? Math.ceil(parsed) : NaN;
      inputComment = comment.trim();
    } else {
      // Add mode: first number in the free text is the amount, rest is comment.
      const parsed = parseAmountFromTranscript(entry);
      inputAmount = parsed.amount ?? NaN;
      inputComment = parsed.comment;
    }
    const input: SpendingInput = {
      amount: inputAmount,
      date,
      category,
      comment: inputComment,
    };
    const { ok, errors } = validateSpending(input);
    if (!ok) {
      setError(errors[0]);
      return;
    }
    // Save-time auto-categorisation (shared policy): fills the category only
    // when left uncategorized, never overriding an explicit pick. Voice entries
    // flow through here too.
    const categorized = applyAutoCategory(input, categories);
    setSaving(true);
    try {
      if (editing) {
        await updateSpending(editing.id, { ...categorized, needsReview: false });
      } else {
        await createSpending(categorized, ownerUid, addSource);
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
          {editing ? (
            <>
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
                <Label htmlFor="comment">Comment</Label>
                <Input
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Optional note"
                />
              </div>
            </>
          ) : (
            <div className="grid gap-2">
              <Label htmlFor="entry">Amount & note</Label>
              <Input
                id="entry"
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                placeholder="e.g. 12 lunch with team"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                The first number becomes the amount; the rest is saved as the comment.
              </p>
            </div>
          )}
          <div className="grid gap-2">
            <Label htmlFor="date">Date</Label>
            <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="category">Category</Label>
            <CategorySelect
              id="category"
              value={category}
              onChange={setCategory}
              categories={categories}
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
