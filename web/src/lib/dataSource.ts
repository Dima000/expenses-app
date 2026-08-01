import * as React from 'react';
import type { Category, CategoryValue, Spending, SpendingInput, SpendingSource } from '@expenses/shared';

/** Unsubscribe from a live subscription. */
export type Unsubscribe = () => void;

/**
 * Every read/write operation the UI performs on spendings and categories,
 * decoupled from any specific backend (e.g. Firestore). Components obtain
 * the active implementation via `useDataSource()` rather than importing a
 * backend-specific module directly, so a future non-Firestore implementation
 * is a drop-in swap with no call-site changes.
 */
export interface DataSource {
  subscribeToMonth(
    monthKey: string,
    onData: (spendings: Spending[]) => void,
    onError?: (err: Error) => void,
  ): Unsubscribe;
  subscribeToRange(
    start: string,
    end: string,
    onData: (spendings: Spending[]) => void,
    onError?: (err: Error) => void,
  ): Unsubscribe;
  subscribeToCategories(
    onData: (categories: Category[]) => void,
    onError?: (err: Error) => void,
  ): Unsubscribe;

  createSpending(input: SpendingInput, source: SpendingSource): Promise<string>;
  updateSpending(id: string, input: SpendingInput): Promise<void>;
  assignCategory(id: string, category: CategoryValue): Promise<void>;
  deleteSpending(id: string): Promise<void>;

  addCategory(name: string): Promise<void>;
  renameCategory(id: string, name: string): Promise<void>;
  setCategoryColor(id: string, colorId: string): Promise<void>;
  removeCategory(id: string): Promise<void>;
  addTerm(id: string, term: string): Promise<void>;
  removeTerm(id: string, term: string): Promise<void>;
}

const DataSourceContext = React.createContext<DataSource | null>(null);

export const DataSourceProvider = DataSourceContext.Provider;

/** The active `DataSource`. Throws if called outside a `DataSourceProvider`. */
export function useDataSource(): DataSource {
  const dataSource = React.useContext(DataSourceContext);
  if (!dataSource) {
    throw new Error('useDataSource() must be called within a DataSourceProvider');
  }
  return dataSource;
}
