import { UNCATEGORIZED, type Category, type CategoryValue } from '@expenses/shared';
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
  /** The owner's live categories (from the categories subscription). */
  categories: Category[];
  /** Include the `uncategorized` option (used by the add/edit form, not assign). */
  allowUncategorized?: boolean;
  id?: string;
  placeholder?: string;
}

/** A single category picker driven off the owner's live, user-managed categories. */
export function CategorySelect({
  value,
  onChange,
  categories,
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
        {categories.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            {c.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
