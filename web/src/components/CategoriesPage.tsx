import * as React from 'react';
import { ArrowLeft, ChevronDown, ChevronRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Category } from '@expenses/shared';
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

interface CategoriesPageProps {
  ownerUid: string;
  /** The owner's live categories (from the categories subscription). */
  categories: Category[];
  /** Return to the spendings dashboard. */
  onClose: () => void;
}

/**
 * Full-page categories manager: an alphabetically-sorted list of categories,
 * each a compact row that expands to reveal its keyword editor. Writes go to
 * `lib/categories.ts`; the live subscription reflects them back through
 * `categories`. Duplicate-name / duplicate-term rejections surface inline.
 */
export function CategoriesPage({ ownerUid, categories, onClose }: CategoriesPageProps) {
  const [newName, setNewName] = React.useState('');
  const [addError, setAddError] = React.useState<string | null>(null);

  const sorted = React.useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })),
    [categories],
  );

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
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-28 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Back" onClick={onClose}>
            <ArrowLeft />
          </Button>
          <h1 className="text-xl font-semibold">Categories</h1>
        </div>
        <Button variant="outline" size="sm" onClick={onClose}>
          Done
        </Button>
      </header>

      {/* Add a new category */}
      <div className="mb-4 grid gap-2">
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

      {/* Category list */}
      {sorted.length === 0 ? (
        <p className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">
          No categories yet. Add one above.
        </p>
      ) : (
        <div className="rounded-xl border">
          {sorted.map((cat) => (
            <CategoryRow key={cat.id} ownerUid={ownerUid} categories={categories} category={cat} />
          ))}
        </div>
      )}
    </div>
  );
}

interface CategoryRowProps {
  ownerUid: string;
  /** The full set, needed by the data-layer writers to enforce uniqueness. */
  categories: Category[];
  category: Category;
}

/**
 * One category as a collapsible row. Owns its own expand / rename / draft /
 * error state; mounted per category (keyed by id), so there are no parent-held
 * id-keyed maps to seed or garbage-collect.
 */
function CategoryRow({ ownerUid, categories, category }: CategoryRowProps) {
  const [expanded, setExpanded] = React.useState(false);
  const [editingName, setEditingName] = React.useState(false);
  const [nameDraft, setNameDraft] = React.useState(category.name);
  const [termDraft, setTermDraft] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  // Follow the persisted name if it changes elsewhere (e.g. another device).
  React.useEffect(() => setNameDraft(category.name), [category.name]);

  async function handleRename() {
    const next = nameDraft.trim();
    setEditingName(false);
    if (!next || next === category.name) {
      setNameDraft(category.name);
      return;
    }
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

  const termCount = category.terms.length;

  return (
    <div className="border-b last:border-b-0">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <Button
          variant="ghost"
          size="icon"
          aria-label={expanded ? 'Collapse' : 'Expand'}
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronDown /> : <ChevronRight />}
        </Button>

        {editingName ? (
          <Input
            aria-label={`Rename ${category.name}`}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleRename();
              } else if (e.key === 'Escape') {
                setNameDraft(category.name);
                setEditingName(false);
              }
            }}
            autoFocus
            className="h-8"
          />
        ) : (
          <button
            type="button"
            className="flex-1 truncate text-left font-medium"
            onClick={() => setExpanded((v) => !v)}
          >
            {category.name}
          </button>
        )}

        <span className="shrink-0 px-1 text-xs tabular-nums text-muted-foreground">
          {termCount} {termCount === 1 ? 'keyword' : 'keywords'}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Rename ${category.name}`}
          onClick={() => setEditingName(true)}
        >
          <Pencil />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Remove ${category.name}`}
          onClick={handleRemove}
        >
          <Trash2 />
        </Button>
      </div>

      {expanded && (
        <div className="grid gap-2 px-3 pb-3 pl-11">
          <div className="flex flex-wrap items-center gap-1.5">
            {category.terms.map((term) => (
              <Badge key={term} variant="secondary" className="gap-1 pr-1">
                {term}
                <button
                  type="button"
                  aria-label={`Remove keyword ${term}`}
                  className="rounded-sm opacity-70 hover:opacity-100"
                  onClick={() => handleRemoveTerm(term)}
                >
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
            {termCount === 0 && (
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
      )}
    </div>
  );
}
