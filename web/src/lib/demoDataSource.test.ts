import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { UNCATEGORIZED, type Category, type Spending } from '@expenses/shared';
import { DemoDataSource } from './demoDataSource';

const TODAY = new Date(2026, 7, 1); // 2026-08-01

/** Let queued microtask notifications (write/subscribe delivery) settle. */
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
};

describe('DemoDataSource', () => {
  it('never imports Firestore', () => {
    const filePath = fileURLToPath(new URL('./demoDataSource.ts', import.meta.url));
    const source = fs.readFileSync(filePath, 'utf8');
    expect(source).not.toMatch(/firebase\/firestore/);
  });

  describe('subscriptions', () => {
    it('subscribeToMonth delivers a snapshot on a microtask, not synchronously', async () => {
      const ds = new DemoDataSource(TODAY);
      let received: Spending[] | undefined;
      ds.subscribeToMonth('2026-08', (rows) => {
        received = rows;
      });
      expect(received).toBeUndefined();
      await flush();
      expect(received).toBeDefined();
      expect(received!.length).toBeGreaterThan(0);
      expect(received!.every((s) => s.date >= '2026-08-01' && s.date < '2026-09-01')).toBe(true);
    });

    it('subscribeToCategories delivers the seeded categories on a microtask', async () => {
      const ds = new DemoDataSource(TODAY);
      let received: Category[] | undefined;
      ds.subscribeToCategories((cats) => {
        received = cats;
      });
      expect(received).toBeUndefined();
      await flush();
      expect(received?.some((c) => c.id === 'groceries')).toBe(true);
    });

    it('a write does not notify the listener synchronously, only after a microtask', async () => {
      const ds = new DemoDataSource(TODAY);
      let callCount = 0;
      ds.subscribeToRange('2026-08-01', '2026-09-01', () => {
        callCount++;
      });
      await flush();
      const countAfterSubscribe = callCount;

      void ds.createSpending(
        { amount: 10, date: '2026-08-15', comment: 'Test entry', category: UNCATEGORIZED },
        'web',
      );
      expect(callCount).toBe(countAfterSubscribe); // not synchronous
      await flush();
      expect(callCount).toBeGreaterThan(countAfterSubscribe);
    });

    it('unsubscribe stops further notifications', async () => {
      const ds = new DemoDataSource(TODAY);
      let callCount = 0;
      const unsubscribe = ds.subscribeToRange('2026-08-01', '2026-09-01', () => {
        callCount++;
      });
      await flush();
      const afterInitial = callCount;

      unsubscribe();
      await ds.createSpending(
        { amount: 5, date: '2026-08-10', comment: 'Should not notify', category: UNCATEGORIZED },
        'web',
      );
      await flush();
      expect(callCount).toBe(afterInitial);
    });
  });

  describe('spending writes', () => {
    it('createSpending/updateSpending/assignCategory/deleteSpending mutate in-memory state', async () => {
      const ds = new DemoDataSource(TODAY);
      let rows: Spending[] = [];
      ds.subscribeToRange('2026-08-01', '2026-09-01', (r) => {
        rows = r;
      });
      await flush();
      const before = rows.length;

      const id = await ds.createSpending(
        { amount: 10, date: '2026-08-20', comment: 'Coffee', category: UNCATEGORIZED },
        'web',
      );
      await flush();
      expect(rows.length).toBe(before + 1);
      expect(rows.some((r) => r.id === id && r.comment === 'Coffee')).toBe(true);

      await ds.updateSpending(id, {
        amount: 20,
        date: '2026-08-20',
        comment: 'Coffee and cake',
        category: 'groceries',
      });
      await flush();
      let updated = rows.find((r) => r.id === id);
      expect(updated?.amount).toBe(20);
      expect(updated?.comment).toBe('Coffee and cake');
      expect(updated?.category).toBe('groceries');

      await ds.assignCategory(id, 'health');
      await flush();
      expect(rows.find((r) => r.id === id)?.category).toBe('health');

      await ds.deleteSpending(id);
      await flush();
      expect(rows.some((r) => r.id === id)).toBe(false);
    });
  });

  describe('category writes', () => {
    it('addCategory/renameCategory/setCategoryColor/addTerm/removeTerm/removeCategory mutate in-memory state', async () => {
      const ds = new DemoDataSource(TODAY);
      let cats: Category[] = [];
      ds.subscribeToCategories((c) => {
        cats = c;
      });
      await flush();

      await ds.addCategory('Travel');
      await flush();
      const created = cats.find((c) => c.name === 'Travel');
      expect(created).toBeDefined();
      const id = created!.id;

      await ds.renameCategory(id, 'Trips');
      await flush();
      expect(cats.find((c) => c.id === id)?.name).toBe('Trips');

      await ds.setCategoryColor(id, 'blue');
      await flush();
      expect(cats.find((c) => c.id === id)?.colorId).toBe('blue');

      await ds.addTerm(id, 'flight');
      await flush();
      expect(cats.find((c) => c.id === id)?.terms).toContain('flight');

      await ds.removeTerm(id, 'flight');
      await flush();
      expect(cats.find((c) => c.id === id)?.terms).not.toContain('flight');

      await ds.removeCategory(id);
      await flush();
      expect(cats.some((c) => c.id === id)).toBe(false);
    });
  });
});
