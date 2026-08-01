import type { ReactNode } from 'react';
import { ArrowUpDown } from 'lucide-react';

interface SortableHeaderProps {
  label: string;
  active: boolean;
  /** Icon shown when `active` — conveys this column's current sort state
   *  (e.g. an up/down arrow for direction, or a fixed icon for a toggle). */
  activeIcon: ReactNode;
  onClick: () => void;
  title?: string;
}

/**
 * A clickable table-header label with a trailing sort-state icon: the
 * inactive `ArrowUpDown` hint, or `activeIcon` once this column is the active
 * sort. Shared by every sortable table header so the button styling and
 * `aria-pressed` wiring live in one place.
 */
export function SortableHeader({ label, active, activeIcon, onClick, title }: SortableHeaderProps) {
  return (
    <button
      type="button"
      className={
        active
          ? 'inline-flex items-center gap-1 font-medium text-foreground'
          : 'inline-flex items-center gap-1 hover:text-foreground'
      }
      onClick={onClick}
      aria-pressed={active}
      title={title}
    >
      {label}
      {active ? activeIcon : <ArrowUpDown className="size-3.5 opacity-40" />}
    </button>
  );
}
