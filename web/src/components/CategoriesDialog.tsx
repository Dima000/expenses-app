import * as React from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import type { Category } from '@expenses/shared';
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
import { Badge } from '@/components/ui/badge';
import {
  addCategory,
  addTerm,
  removeCategory,
  removeTerm,
  renameCategory,
} from '@/lib/categories';

interface CategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ownerUid: string;
  /** The owner's live categories (from the categories subscription). */
  categories: Category[];
}

/**
 * Manage the owner's categories and their auto-match terms. Mirrors
 * `SpendingForm`'s dialog shape (Dialog + Input/Label grid + Button footer).
 * Duplicate-name / duplicate-term rejections from the data layer surface
 * inline; there is no auto-move (design.md). Writes go to `lib/categories.ts`
 * and the live subscription reflects them back through `categories`.
 */
export function CategoriesDialog({
  open,
  onOpenChange,
  ownerUid,
  categories,
}: CategoriesDialogProps) {
  const [newName, setNewName] = React.useState('');
  const [addError, setAddError] = React.useState<string | null>(null);
  // Draft name per category (seeded from props when the dialog opens).
  const [nameDrafts, setNameDrafts] = React.useState<Record<string, string>>({});
  const [termDrafts, setTermDrafts] = React.useState<Record<string, string>>({});
  // One inline error slot per category (rename / add-term / remove).
  const [rowErrors, setRowErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (!open) return;
    setNewName('');
    setAddError(null);
    setTermDrafts({});
    setRowErrors({});
    setNameDrafts(Object.fromEntries(categories.map((c) => [c.id, c.name])));
    // Seed once per open; live edits below manage the drafts thereafter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const setRowError = (id: string, msg: string | null) =>
    setRowErrors((e) => ({ ...e, [id]: msg ?? '' }));

  async function handleAdd() {
    setAddError(null);
    try {
      await addCategory(ownerUid, categories, newName);
      setNewName('');
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Failed to add category');
    }
  }

  async function handleRename(cat: Category) {
    const next = (nameDrafts[cat.id] ?? '').trim();
    if (!next || next === cat.name) return;
    setRowError(cat.id, null);
    try {
      await renameCategory(ownerUid, categories, cat.id, next);
    } catch (err) {
      setRowError(cat.id, err instanceof Error ? err.message : 'Failed to rename');
      setNameDrafts((d) => ({ ...d, [cat.id]: cat.name })); // revert the draft
    }
  }

  async function handleRemove(cat: Category) {
    setRowError(cat.id, null);
    try {
      await removeCategory(ownerUid, categories, cat.id);
    } catch (err) {
      setRowError(cat.id, err instanceof Error ? err.message : 'Failed to remove');
    }
  }

  async function handleAddTerm(cat: Category) {
    setRowError(cat.id, null);
    try {
      await addTerm(ownerUid, categories, cat.id, termDrafts[cat.id] ?? '');
      setTermDrafts((d) => ({ ...d, [cat.id]: '' }));
    } catch (err) {
      setRowError(cat.id, err instanceof Error ? err.message : 'Failed to add term');
    }
  }

  async function handleRemoveTerm(cat: Category, term: string) {
    setRowError(cat.id, null);
    try {
      await removeTerm(ownerUid, categories, cat.id, term);
    } catch (err) {
      setRowError(cat.id, err instanceof Error ? err.message : 'Failed to remove term');
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage categories</DialogTitle>
          <DialogDescription>
            Add categories and their keywords. A comment containing a keyword is
            auto-categorised on save; keywords are unique across categories.
          </DialogDescription>
        </DialogHeader>

        {/* Add a new category */}
        <div className="grid gap-2">
          <Label htmlFor="new-category">New category</Label>
          <div className="flex gap-2">
            <Input
              id="new-category"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleAdd();
                }
              }}
              placeholder="e.g. Travel"
            />
            <Button type="button" onClick={handleAdd} disabled={!newName.trim()}>
              <Plus className="mr-1 size-4" /> Add
            </Button>
          </div>
          {addError && <p className="text-sm text-destructive">{addError}</p>}
        </div>

        {/* Existing categories */}
        <div className="grid gap-3">
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No categories yet. Add one above.
            </p>
          )}
          {categories.map((cat) => (
            <div key={cat.id} className="grid gap-2 rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Input
                  aria-label={`Rename ${cat.name}`}
                  value={nameDrafts[cat.id] ?? cat.name}
                  onChange={(e) =>
                    setNameDrafts((d) => ({ ...d, [cat.id]: e.target.value }))
                  }
                  onBlur={() => handleRename(cat)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleRename(cat);
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${cat.name}`}
                  onClick={() => handleRemove(cat)}
                >
                  <Trash2 />
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {cat.terms.map((term) => (
                  <Badge key={term} variant="secondary" className="gap-1 pr-1">
                    {term}
                    <button
                      type="button"
                      aria-label={`Remove term ${term}`}
                      className="rounded-sm opacity-70 hover:opacity-100"
                      onClick={() => handleRemoveTerm(cat, term)}
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
                {cat.terms.length === 0 && (
                  <span className="text-xs text-muted-foreground">No keywords yet</span>
                )}
              </div>

              <div className="flex gap-2">
                <Input
                  aria-label={`Add keyword to ${cat.name}`}
                  value={termDrafts[cat.id] ?? ''}
                  onChange={(e) =>
                    setTermDrafts((d) => ({ ...d, [cat.id]: e.target.value }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void handleAddTerm(cat);
                    }
                  }}
                  placeholder="Add a keyword…"
                  className="h-9"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddTerm(cat)}
                  disabled={!(termDrafts[cat.id] ?? '').trim()}
                >
                  Add
                </Button>
              </div>

              {rowErrors[cat.id] && (
                <p className="text-sm text-destructive">{rowErrors[cat.id]}</p>
              )}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
