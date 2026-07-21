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

const errorMessage = (err: unknown, fallback: string) =>
  err instanceof Error ? err.message : fallback;

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

  React.useEffect(() => {
    if (!open) return;
    setNewName('');
    setAddError(null);
  }, [open]);

  async function handleAdd() {
    setAddError(null);
    try {
      await addCategory(ownerUid, categories, newName);
      setNewName('');
    } catch (err) {
      setAddError(errorMessage(err, 'Failed to add category'));
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
            <CategoryRow
              key={cat.id}
              ownerUid={ownerUid}
              categories={categories}
              category={cat}
            />
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

interface CategoryRowProps {
  ownerUid: string;
  /** The full set, needed by the data-layer writers to enforce uniqueness. */
  categories: Category[];
  category: Category;
}

/**
 * One category's controls, owning its own name/term drafts and inline error.
 * Mounted per category (keyed by id), so there are no parent-held id-keyed maps
 * to seed or garbage-collect.
 */
function CategoryRow({ ownerUid, categories, category }: CategoryRowProps) {
  const [nameDraft, setNameDraft] = React.useState(category.name);
  const [termDraft, setTermDraft] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  // Follow the persisted name if it changes elsewhere (e.g. another device).
  React.useEffect(() => setNameDraft(category.name), [category.name]);

  async function handleRename() {
    const next = nameDraft.trim();
    if (!next || next === category.name) return;
    setError(null);
    try {
      await renameCategory(ownerUid, categories, category.id, next);
    } catch (err) {
      setError(errorMessage(err, 'Failed to rename'));
      setNameDraft(category.name); // revert the draft
    }
  }

  async function handleRemove() {
    setError(null);
    try {
      await removeCategory(ownerUid, categories, category.id);
    } catch (err) {
      setError(errorMessage(err, 'Failed to remove'));
    }
  }

  async function handleAddTerm() {
    setError(null);
    try {
      await addTerm(ownerUid, categories, category.id, termDraft);
      setTermDraft('');
    } catch (err) {
      setError(errorMessage(err, 'Failed to add term'));
    }
  }

  async function handleRemoveTerm(term: string) {
    setError(null);
    try {
      await removeTerm(ownerUid, categories, category.id, term);
    } catch (err) {
      setError(errorMessage(err, 'Failed to remove term'));
    }
  }

  return (
    <div className="grid gap-2 rounded-lg border p-3">
      <div className="flex items-center gap-2">
        <Input
          aria-label={`Rename ${category.name}`}
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleRename();
            }
          }}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Remove ${category.name}`}
          onClick={handleRemove}
        >
          <Trash2 />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {category.terms.map((term) => (
          <Badge key={term} variant="secondary" className="gap-1 pr-1">
            {term}
            <button
              type="button"
              aria-label={`Remove term ${term}`}
              className="rounded-sm opacity-70 hover:opacity-100"
              onClick={() => handleRemoveTerm(term)}
            >
              <X className="size-3" />
            </button>
          </Badge>
        ))}
        {category.terms.length === 0 && (
          <span className="text-xs text-muted-foreground">No keywords yet</span>
        )}
      </div>

      <div className="flex gap-2">
        <Input
          aria-label={`Add keyword to ${category.name}`}
          value={termDraft}
          onChange={(e) => setTermDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void handleAddTerm();
            }
          }}
          placeholder="Add a keyword…"
          className="h-9"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddTerm}
          disabled={!termDraft.trim()}
        >
          Add
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
