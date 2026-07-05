import { CATEGORIES, UNCATEGORIZED, type CategoryValue } from '@expenses/shared';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface CategorySelectProps {
  value: CategoryValue;
  onChange: (value: CategoryValue) => void;
  /** Include the `uncategorized` option (used by the add/edit form, not assign). */
  allowUncategorized?: boolean;
  id?: string;
  placeholder?: string;
}

/** A single category picker driven off the shared category list. */
export function CategorySelect({
  value,
  onChange,
  allowUncategorized = true,
  id,
  placeholder = 'Select a category',
}: CategorySelectProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as CategoryValue)}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {allowUncategorized && <SelectItem value={UNCATEGORIZED}>Uncategorized</SelectItem>}
        {CATEGORIES.map((c) => (
          <SelectItem key={c} value={c}>
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
