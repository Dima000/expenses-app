import * as React from 'react';
import { UNCATEGORIZED, type Spending } from '@expenses/shared';
import { LogOut, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { subscribeToMonth } from '@/lib/spendings';
import { currentMonthKey } from '@/lib/date';
import { SignIn } from '@/components/SignIn';
import { MonthNav } from '@/components/MonthNav';
import { TotalCard } from '@/components/TotalCard';
import { SpendingTable } from '@/components/SpendingTable';
import { SpendingForm } from '@/components/SpendingForm';
import { VoiceButton } from '@/components/VoiceButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/** True when the app was launched via the PWA "Log by voice" shortcut. */
function launchedForVoice(): boolean {
  return new URLSearchParams(window.location.search).get('voice') === '1';
}

export default function App() {
  const { user, loading, signIn, logOut } = useAuth();
  const [month, setMonth] = React.useState(currentMonthKey);
  const [spendings, setSpendings] = React.useState<Spending[]>([]);
  const [onlyUncategorized, setOnlyUncategorized] = React.useState(false);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Spending | null>(null);

  // Live subscription to the selected month for the signed-in owner.
  React.useEffect(() => {
    if (!user) {
      setSpendings([]);
      return;
    }
    return subscribeToMonth(user.uid, month, setSpendings);
  }, [user, month]);

  const uncategorizedCount = React.useMemo(
    () => spendings.filter((s) => s.category === UNCATEGORIZED).length,
    [spendings],
  );
  const total = React.useMemo(
    () => spendings.reduce((sum, s) => sum + (s.amount || 0), 0),
    [spendings],
  );
  const visible = onlyUncategorized
    ? spendings.filter((s) => s.category === UNCATEGORIZED)
    : spendings;

  const openEdit = React.useCallback((s: Spending) => {
    setEditing(s);
    setFormOpen(true);
  }, []);
  const openAdd = () => {
    setEditing(null);
    setFormOpen(true);
  };

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!user) return <SignIn onSignIn={signIn} />;

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-28 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Expenses</h1>
        <Button variant="ghost" size="icon" aria-label="Sign out" onClick={logOut}>
          <LogOut />
        </Button>
      </header>

      <div className="mb-4">
        <MonthNav monthKey={month} onChange={setMonth} />
      </div>

      <div className="mb-4">
        <TotalCard total={total} count={spendings.length} />
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

      <SpendingTable spendings={visible} onEdit={openEdit} />

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
        <VoiceButton ownerUid={user.uid} onEditRequest={openEdit} autoStart={launchedForVoice()} />
      </div>

      <SpendingForm
        open={formOpen}
        onOpenChange={setFormOpen}
        ownerUid={user.uid}
        editing={editing}
      />
    </div>
  );
}
