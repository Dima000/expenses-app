import * as React from 'react';
import {
  resolveCategory,
  type Category,
  type Spending,
  type SpendingSource,
} from '@expenses/shared';
import { LogOut, Plus, Tags } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { subscribeToMonth } from '@/lib/spendings';
import { subscribeToCategories } from '@/lib/categories';
import { currentMonthKey } from '@/lib/date';
import { SignIn } from '@/components/SignIn';
import { MonthNav } from '@/components/MonthNav';
import { TotalCard } from '@/components/TotalCard';
import { SpendingTable } from '@/components/SpendingTable';
import { SpendingForm } from '@/components/SpendingForm';
import { CategoriesDialog } from '@/components/CategoriesDialog';
import { VoiceButton, type VoiceCapture } from '@/components/VoiceButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/** True when the app was launched via the PWA "Log by voice" shortcut. */
function launchedForVoice(): boolean {
  return new URLSearchParams(window.location.search).get('voice') === '1';
}

export default function App() {
  const { user, loading, signIn, logOut } = useAuth();
  const [month, setMonth] = React.useState(currentMonthKey);
  // `null` = the first snapshot for the current (user, month) hasn't arrived yet;
  // this drives the loading state so the page doesn't flash empty and jump.
  const [spendings, setSpendings] = React.useState<Spending[] | null>(null);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [onlyUncategorized, setOnlyUncategorized] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [categoriesOpen, setCategoriesOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Spending | null>(null);
  // Prefill + source for a NEW entry (blank + 'web' for the + button; parsed
  // values + 'voice' when opened for review from the mic).
  const [addPrefill, setAddPrefill] = React.useState<VoiceCapture | null>(null);
  const [addSource, setAddSource] = React.useState<SpendingSource>('web');

  // Live subscription to the selected month for the signed-in owner. Reset to
  // the loading state (`null`) whenever the owner or month changes.
  React.useEffect(() => {
    setSpendings(null);
    if (!user) return;
    return subscribeToMonth(user.uid, month, setSpendings);
  }, [user, month]);

  // Live subscription to the owner's categories (seeds defaults on first run).
  React.useEffect(() => {
    if (!user) {
      setCategories([]);
      return;
    }
    return subscribeToCategories(user.uid, setCategories);
  }, [user]);

  const spendingsLoading = spendings === null;
  // A spending counts as uncategorised when its stored value doesn't resolve to
  // a current category — this includes rows pointing at a removed category.
  const isUncategorized = React.useCallback(
    (s: Spending) => resolveCategory(s.category, categories) === null,
    [categories],
  );
  const uncategorizedCount = React.useMemo(
    () => (spendings ?? []).filter(isUncategorized).length,
    [spendings, isUncategorized],
  );
  const total = React.useMemo(
    () => (spendings ?? []).reduce((sum, s) => sum + (s.amount || 0), 0),
    [spendings],
  );
  const visible = React.useMemo(
    () => (onlyUncategorized ? (spendings ?? []).filter(isUncategorized) : spendings ?? []),
    [spendings, onlyUncategorized, isUncategorized],
  );

  const openEdit = React.useCallback((s: Spending) => {
    setEditing(s);
    setFormOpen(true);
  }, []);
  const openAdd = () => {
    setEditing(null);
    setAddPrefill(null);
    setAddSource('web');
    setFormOpen(true);
  };
  // Voice capture opens the add form prefilled for review — nothing is saved yet.
  const openVoiceReview = React.useCallback((capture: VoiceCapture) => {
    setEditing(null);
    setAddPrefill(capture);
    setAddSource('voice');
    setFormOpen(true);
  }, []);

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <SignIn onSignIn={signIn} />;

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-28 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Expenses</h1>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Manage categories"
            onClick={() => setCategoriesOpen(true)}
          >
            <Tags />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Sign out" onClick={logOut}>
            <LogOut />
          </Button>
        </div>
      </header>

      <div className="mb-4">
        <MonthNav monthKey={month} onChange={setMonth} />
      </div>

      <div className="mb-4">
        <TotalCard total={total} count={spendings?.length ?? 0} />
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Button
          variant={onlyUncategorized ? 'default' : 'outline'}
          size="sm"
          onClick={() => setOnlyUncategorized((v) => !v)}
          disabled={uncategorizedCount === 0 && !onlyUncategorized}
        >
          Uncategorized
          {uncategorizedCount > 0 && (
            <Badge variant="warning" className="ml-2">
              {uncategorizedCount}
            </Badge>
          )}
        </Button>
      </div>

      <SpendingTable
        spendings={visible}
        onEdit={openEdit}
        categories={categories}
        loading={spendingsLoading}
      />

      {/* Floating capture controls — the app opens ready to log (8.3). */}
      <div className="fixed inset-x-0 bottom-6 z-40 mx-auto flex max-w-2xl items-center justify-end gap-3 px-4">
        <Button
          variant="secondary"
          size="lg"
          className="h-14 rounded-full px-6 shadow-lg"
          onClick={openAdd}
        >
          <Plus className="mr-1" /> Add
        </Button>
        <VoiceButton onCapture={openVoiceReview} autoStart={launchedForVoice()} />
      </div>

      <SpendingForm
        open={formOpen}
        onOpenChange={setFormOpen}
        ownerUid={user.uid}
        categories={categories}
        editing={editing}
        prefill={addPrefill}
        addSource={addSource}
      />

      <CategoriesDialog
        open={categoriesOpen}
        onOpenChange={setCategoriesOpen}
        ownerUid={user.uid}
        categories={categories}
      />
    </div>
  );
}
