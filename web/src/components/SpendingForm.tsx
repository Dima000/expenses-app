import * as React from 'react';
import {
  BASE_CURRENCY,
  CURRENCIES,
  UNCATEGORIZED,
  applyAutoCategory,
  convertToBase,
  formatOriginalEntry,
  parseAmountFromTranscript,
  retainedOriginalEntry,
  roundUpAmount,
  validateSpending,
  type Category,
  type CategoryValue,
  type Currency,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CategorySelect } from '@/components/CategorySelect';
import { useDataSource } from '@/lib/dataSource';
import { todayString } from '@/lib/date';
import { readRates } from '@/lib/fx';

interface SpendingFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The owner's live categories — for the picker and save-time auto-categorisation. */
  categories: Category[];
  /** When set, the form edits this spending; otherwise it creates a new one. */
  editing?: Spending | null;
  /** Prefill date for new entries (defaults to today). */
  defaultDate?: string;
  /** Seed amount/comment/category/currency for a new entry (add mode only, e.g. from voice). */
  prefill?: {
    amount?: string;
    comment?: string;
    category?: CategoryValue;
    currency?: Currency | null;
  } | null;
  /** Source recorded when creating a new entry (defaults to 'web'). */
  addSource?: SpendingSource;
}

/** Add/edit spending form. Create and edit share one validated form. */
export function SpendingForm({
  open,
  onOpenChange,
  categories,
  editing,
  defaultDate,
  prefill,
  addSource = 'web',
}: SpendingFormProps) {
  const dataSource = useDataSource();
  // Edit mode binds discrete amount/comment fields; add mode uses one free-text
  // field (`entry`) that is parsed into amount + comment on submit.
  const [amount, setAmount] = React.useState('');
  const [comment, setComment] = React.useState('');
  const [entry, setEntry] = React.useState('');
  const [date, setDate] = React.useState(todayString());
  const [category, setCategory] = React.useState<CategoryValue>(UNCATEGORIZED);
  // Entry currency (add mode only). Always RON unless changed for THIS entry.
  const [currency, setCurrency] = React.useState<Currency>(BASE_CURRENCY);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Synchronous read of whatever the device has cached (design.md D6) — no async
  // gate before the form is usable. Re-read on each open so a refresh that
  // landed since the last one is picked up. `null` = never cached (D8).
  const rates = React.useMemo(() => (open ? readRates() : null), [open]);

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
      // Never sticky (design.md D11): forgetting the picker yields a correct
      // RON entry. Voice is the one exception — it seeds what was spoken.
      setCurrency(prefill?.currency ?? BASE_CURRENCY);
    }
  }, [open, editing, defaultDate, prefill]);

  // Add mode parses continuously so the preview and the submit agree.
  const parsedEntry = React.useMemo(() => parseAmountFromTranscript(entry), [entry]);
  const rate = currency === BASE_CURRENCY ? null : rates?.[currency] ?? null;
  const preview =
    parsedEntry.amount !== null && rate !== null
      ? roundUpAmount(parsedEntry.amount * rate)
      : null;

  // A symbol or currency word in the text moves the picker, so the control and
  // the text can never disagree on screen (design.md D10).
  function handleEntryChange(next: string) {
    setEntry(next);
    const detected = parseAmountFromTranscript(next).currency;
    if (detected) setCurrency(detected);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    let inputAmount: number;
    let inputComment: string;
    let origAmount: string | undefined;
    if (editing) {
      const parsed = Number(amount);
      inputAmount = Number.isFinite(parsed) ? Math.ceil(parsed) : NaN;
      inputComment = comment.trim();
      // The caption still describes the stored value only while the amount is
      // unchanged; it is dropped the moment that changes (design.md D4).
      origAmount = retainedOriginalEntry(editing, inputAmount);
    } else {
      // Add mode: first number in the free text is the amount, rest is comment.
      const parsed = parsedEntry;
      // Convert THEN round, exactly once — rounding first would double-round
      // (10.4 EUR @ 5.0 → 55 instead of 52). See design.md D5.
      const converted =
        parsed.amount === null ? null : convertToBase(parsed.amount, currency, rates ?? {});
      if (parsed.amount !== null && converted === null) {
        setError(`No exchange rate for ${currency} yet — connect once, or enter the amount in RON.`);
        return;
      }
      inputAmount = converted === null ? NaN : roundUpAmount(converted) ?? NaN;
      inputComment = parsed.comment;
      if (currency !== BASE_CURRENCY && parsed.amount !== null && rate !== null) {
        origAmount = formatOriginalEntry(parsed.amount, currency, rate);
      }
    }
    const input: SpendingInput = {
      amount: inputAmount,
      date,
      category,
      comment: inputComment,
      // Never write `undefined`; absent is the normal case (design.md D2).
      ...(origAmount ? { origAmount } : {}),
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
        await dataSource.updateSpending(editing.id, { ...categorized, needsReview: false });
      } else {
        await dataSource.createSpending(categorized, addSource);
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
                {/* Read-only provenance, mirroring the auto-categorised hint.
                    There is no currency control here: selection is a one-time
                    write-time operation (design.md D3). */}
                {editing.origAmount && (
                  <p className="text-xs text-muted-foreground">
                    Entered as {editing.origAmount}.
                  </p>
                )}
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
            <>
              <div className="grid gap-2">
                <Label htmlFor="entry">Amount & note</Label>
                <Input
                  id="entry"
                  value={entry}
                  onChange={(e) => handleEntryChange(e.target.value)}
                  placeholder="e.g. 12 lunch with team"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  The first number becomes the amount; the rest is saved as the comment.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="currency">Currency</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                  <SelectTrigger id="currency">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem
                        key={c.code}
                        value={c.code}
                        // RON is always selectable; the rest need a cached rate.
                        disabled={c.code !== BASE_CURRENCY && !rates}
                      >
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!rates && (
                  <p className="text-xs text-muted-foreground">
                    Foreign currencies are unavailable until you connect once — exchange
                    rates are downloaded and kept on this device.
                  </p>
                )}
                {preview !== null && rate !== null && (
                  <p className="text-xs text-muted-foreground">
                    ≈ {preview} RON · rate {rate}
                  </p>
                )}
              </div>
            </>
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
            {editing?.autoMatchedTerm && (
              <p className="text-xs text-muted-foreground">
                Auto-categorised from the keyword ‘{editing.autoMatchedTerm}’.
              </p>
            )}
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
