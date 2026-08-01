import * as React from 'react';
import {
  resolveCategory,
  type Category,
  type Spending,
  type SpendingSource,
} from '@expenses/shared';
import { BarChart3, LogOut, Plus, Tags } from 'lucide-react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DataSourceProvider } from '@/lib/dataSource';
import { FirestoreDataSource } from '@/lib/firestoreDataSource';
import { DemoDataSource } from '@/lib/demoDataSource';
import { DEMO_BASE, ROOT_BASE, isDemoPath, withBase } from '@/lib/demoRoutes';
import {
  currentMonthKey,
  currentPeriodAnchor,
  todayString,
  yesterdayString,
  type PeriodUnit,
} from '@/lib/date';
import { SignIn } from '@/components/SignIn';
import { MonthNav } from '@/components/MonthNav';
import { TotalCard } from '@/components/TotalCard';
import { SpendingTable } from '@/components/SpendingTable';
import { SpendingForm } from '@/components/SpendingForm';
import { CategoriesPage } from '@/components/CategoriesPage';
import { ReportsPage } from '@/components/ReportsPage';
import { CategoryDrilldownPage } from '@/components/CategoryDrilldownPage';
import { DemoBanner } from '@/components/DemoBanner';
import { VoiceButton, type VoiceCapture } from '@/components/VoiceButton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

/** True when the app was launched via the PWA "Log by voice" shortcut. */
function launchedForVoice(): boolean {
  return new URLSearchParams(window.location.search).get('voice') === '1';
}

/** Quick filter ids; the filters are exclusive — at most one is active at a time. */
type FilterId = 'uncategorized' | 'today' | 'yesterday';

/** Active-state classes for a filter button; keeps the outline border box so the
 *  row doesn't shift when toggling (only the border/background colour changes). */
const activeFilterClass =
  'border-primary bg-primary text-primary-foreground hover:bg-primary/90';

/** True while the current URL is inside the demo subtree. Demo-ness is read
 *  from the URL on every render — there is no stored flag that can drift. */
function useIsDemo(): boolean {
  return isDemoPath(useLocation().pathname);
}

/** The router mounts unconditionally so the URL is readable *before* the auth
 *  gate runs — that's what lets `/demo` render without waiting on Firebase. */
export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

function AppShell() {
  const isDemo = useIsDemo();
  const { user, loading, signIn, logOut } = useAuth();
  const [month, setMonth] = React.useState(currentMonthKey);
  // `null` = the first snapshot for the current (user, month) hasn't arrived yet;
  // this drives the loading state so the page doesn't flash empty and jump.
  const [spendings, setSpendings] = React.useState<Spending[] | null>(null);
  const [categories, setCategories] = React.useState<Category[]>([]);
  // Exclusive quick filter; `null` = no filter, show the whole month.
  const [activeFilter, setActiveFilter] = React.useState<FilterId | null>(null);
  const [formOpen, setFormOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Spending | null>(null);
  // Prefill + source for a NEW entry (blank + 'web' for the + button; parsed
  // values + 'voice' when opened for review from the mic).
  const [addPrefill, setAddPrefill] = React.useState<VoiceCapture | null>(null);
  const [addSource, setAddSource] = React.useState<SpendingSource>('web');

  // Two separate memos on purpose. The demo source depends on `isDemo` alone,
  // so auth resolving mid-demo (`null` → `User`) can't rebuild it and silently
  // wipe whatever the visitor just added. The Firestore source is gated on
  // `!isDemo` so it is genuinely never constructed while demoing.
  const demoSource = React.useMemo(
    () => (isDemo ? new DemoDataSource() : null),
    [isDemo],
  );
  // One `DataSource` per signed-in owner, memoized on `user.uid` so it's
  // stable across re-renders and only rebuilt if the signed-in owner changes.
  const firestoreSource = React.useMemo(
    () => (!isDemo && user ? new FirestoreDataSource(user.uid) : null),
    [isDemo, user],
  );
  const dataSource = isDemo ? demoSource : firestoreSource;

  // Live subscription to the selected month for the signed-in owner. Reset to
  // the loading state (`null`) whenever the owner or month changes.
  React.useEffect(() => {
    setSpendings(null);
    if (!dataSource) return;
    return dataSource.subscribeToMonth(month, setSpendings);
  }, [dataSource, month]);

  // Live subscription to the owner's categories (seeds defaults on first run).
  React.useEffect(() => {
    if (!dataSource) {
      setCategories([]);
      return;
    }
    return dataSource.subscribeToCategories(setCategories);
  }, [dataSource]);

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
  // Each quick filter is a predicate; the visible list is the active filter's
  // matches, or the whole month when no filter is active.
  const predicates = React.useMemo<Record<FilterId, (s: Spending) => boolean>>(
    () => ({
      uncategorized: isUncategorized,
      today: (s) => s.date === todayString(),
      yesterday: (s) => s.date === yesterdayString(),
    }),
    [isUncategorized],
  );
  const visible = React.useMemo(() => {
    const rows = spendings ?? [];
    return activeFilter ? rows.filter(predicates[activeFilter]) : rows;
  }, [spendings, activeFilter, predicates]);

  // Exclusive: clicking the active filter clears it, otherwise selects it.
  const toggleFilter = React.useCallback((id: FilterId) => {
    setActiveFilter((prev) => (prev === id ? null : id));
  }, []);

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

  // Both gates are bypassed in the demo: it renders immediately, signed in or
  // out, without waiting on auth to resolve. One short-circuit each — no
  // per-route guard, so new routes are protected automatically and the
  // requested URL survives sign-in.
  if (!isDemo && loading) {
    return <div className="flex min-h-dvh items-center justify-center text-muted-foreground">Loading…</div>;
  }
  if (!isDemo && (!user || !dataSource)) return <SignIn onSignIn={signIn} />;
  if (!dataSource) return null; // unreachable: the gates above cover every case

  // The same route tree, declared once and mounted at both bases. A parent
  // `<Route>` with no `element` renders its matched child directly, so no
  // layout component is needed. Demo is listed first for readability; React
  // Router ranks `/demo` above `/` for demo paths regardless of order.
  const appRoutes = (base: string) => (
    <>
      <Route
        index
        element={
          <Dashboard
            base={base}
            isDemo={base === DEMO_BASE}
            logOut={logOut}
            month={month}
            setMonth={setMonth}
            spendings={spendings}
            spendingsLoading={spendingsLoading}
            total={total}
            categories={categories}
            activeFilter={activeFilter}
            toggleFilter={toggleFilter}
            uncategorizedCount={uncategorizedCount}
            visible={visible}
            openEdit={openEdit}
            openAdd={openAdd}
            openVoiceReview={openVoiceReview}
            formOpen={formOpen}
            setFormOpen={setFormOpen}
            editing={editing}
            addPrefill={addPrefill}
            addSource={addSource}
          />
        }
      />
      <Route
        path="categories"
        element={<CategoriesRoute base={base} categories={categories} />}
      />
      <Route
        path="reports"
        element={<ReportsRoute base={base} categories={categories} />}
      />
      <Route
        path="reports/:categoryId"
        element={<CategoryDrilldownRoute base={base} categories={categories} />}
      />
      {/* Per-base catch-all: an unknown `/demo/…` lands on `/demo`, not `/`. */}
      <Route path="*" element={<Navigate to={withBase(base, '/')} replace />} />
    </>
  );

  return (
    <DataSourceProvider value={dataSource}>
      {isDemo && <DemoBanner />}
      <Routes>
        <Route path={DEMO_BASE}>{appRoutes(DEMO_BASE)}</Route>
        <Route path={ROOT_BASE}>{appRoutes(ROOT_BASE)}</Route>
      </Routes>
    </DataSourceProvider>
  );
}

interface DashboardProps {
  /** Path prefix for in-app navigation — `/` normally, `/demo` in the demo. */
  base: string;
  isDemo: boolean;
  logOut: () => void;
  month: string;
  setMonth: (month: string) => void;
  spendings: Spending[] | null;
  spendingsLoading: boolean;
  total: number;
  categories: Category[];
  activeFilter: FilterId | null;
  toggleFilter: (id: FilterId) => void;
  uncategorizedCount: number;
  visible: Spending[];
  openEdit: (s: Spending) => void;
  openAdd: () => void;
  openVoiceReview: (capture: VoiceCapture) => void;
  formOpen: boolean;
  setFormOpen: (open: boolean) => void;
  editing: Spending | null;
  addPrefill: VoiceCapture | null;
  addSource: SpendingSource;
}

function Dashboard({
  base,
  isDemo,
  logOut,
  month,
  setMonth,
  spendings,
  spendingsLoading,
  total,
  categories,
  activeFilter,
  toggleFilter,
  uncategorizedCount,
  visible,
  openEdit,
  openAdd,
  openVoiceReview,
  formOpen,
  setFormOpen,
  editing,
  addPrefill,
  addSource,
}: DashboardProps) {
  const navigate = useNavigate();

  return (
    <div className="mx-auto min-h-dvh max-w-2xl px-4 pb-28 pt-6">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Expenses</h1>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Reports"
            onClick={() => navigate(withBase(base, '/reports'))}
          >
            <BarChart3 />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Manage categories"
            onClick={() => navigate(withBase(base, '/categories'))}
          >
            <Tags />
          </Button>
          {/* No sign-out in the demo — the banner's "Exit demo" is the only
              way out, so the two actions never look interchangeable. */}
          {!isDemo && (
            <Button variant="ghost" size="icon" aria-label="Sign out" onClick={logOut}>
              <LogOut />
            </Button>
          )}
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
          variant="outline"
          size="sm"
          className={activeFilter === 'uncategorized' ? activeFilterClass : undefined}
          onClick={() => toggleFilter('uncategorized')}
          disabled={uncategorizedCount === 0 && activeFilter !== 'uncategorized'}
        >
          Uncategorized
          {uncategorizedCount > 0 && (
            <Badge variant="warning" className="ml-2">
              {uncategorizedCount}
            </Badge>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={activeFilter === 'today' ? activeFilterClass : undefined}
          onClick={() => toggleFilter('today')}
        >
          Today
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={activeFilter === 'yesterday' ? activeFilterClass : undefined}
          onClick={() => toggleFilter('yesterday')}
        >
          Yesterday
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
        categories={categories}
        editing={editing}
        prefill={addPrefill}
        addSource={addSource}
      />
    </div>
  );
}

interface CategoriesRouteProps {
  base: string;
  categories: Category[];
}

function CategoriesRoute({ base, categories }: CategoriesRouteProps) {
  const navigate = useNavigate();
  return (
    <CategoriesPage
      categories={categories}
      onClose={() => navigate(withBase(base, '/'))}
    />
  );
}

interface ReportsRouteProps {
  base: string;
  categories: Category[];
}

/** Reads/writes the Reports period (`unit`, `anchor`) as URL query params
 *  (app-navigation spec), defaulting to the current month when absent. */
function ReportsRoute({ base, categories }: ReportsRouteProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const unit: PeriodUnit = searchParams.get('unit') === 'year' ? 'year' : 'month';
  const anchor = searchParams.get('anchor') || currentPeriodAnchor(unit);

  return (
    <ReportsPage
      categories={categories}
      unit={unit}
      anchor={anchor}
      onPeriodChange={(nextUnit, nextAnchor) =>
        setSearchParams({ unit: nextUnit, anchor: nextAnchor })
      }
      onSelectCategory={(categoryId) =>
        navigate(withBase(base, `/reports/${categoryId}?unit=${unit}&anchor=${anchor}`))
      }
      onBack={() => navigate(withBase(base, '/'))}
    />
  );
}

interface CategoryDrilldownRouteProps {
  base: string;
  categories: Category[];
}

/** The category resource lives in the path (`/reports/:categoryId`); the
 *  period it's viewed under stays in query params, same convention as Reports. */
function CategoryDrilldownRoute({ base, categories }: CategoryDrilldownRouteProps) {
  const navigate = useNavigate();
  const { categoryId } = useParams<{ categoryId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const unit: PeriodUnit = searchParams.get('unit') === 'year' ? 'year' : 'month';
  const anchor = searchParams.get('anchor') || currentPeriodAnchor(unit);

  if (!categoryId) return <Navigate to={withBase(base, '/reports')} replace />;

  return (
    <CategoryDrilldownPage
      categories={categories}
      categoryId={categoryId}
      unit={unit}
      anchor={anchor}
      onPeriodChange={(nextUnit, nextAnchor) =>
        setSearchParams({ unit: nextUnit, anchor: nextAnchor })
      }
      onBack={() => navigate(withBase(base, `/reports?unit=${unit}&anchor=${anchor}`))}
    />
  );
}
