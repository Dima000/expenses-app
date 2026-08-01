import { describe, expect, it } from 'vitest';
import { DEMO_BASE, ROOT_BASE, isDemoPath, withBase } from './demoRoutes';

describe('isDemoPath', () => {
  it('matches the demo base exactly', () => {
    expect(isDemoPath('/demo')).toBe(true);
  });

  it('matches paths under the demo base', () => {
    expect(isDemoPath('/demo/categories')).toBe(true);
    expect(isDemoPath('/demo/reports')).toBe(true);
    expect(isDemoPath('/demo/reports/groceries')).toBe(true);
  });

  it('does not match non-demo paths', () => {
    expect(isDemoPath('/')).toBe(false);
    expect(isDemoPath('/reports')).toBe(false);
    expect(isDemoPath('/categories')).toBe(false);
    expect(isDemoPath('/nope')).toBe(false);
  });

  it('does not match a path that merely starts with the same characters', () => {
    expect(isDemoPath('/democracy')).toBe(false);
    expect(isDemoPath('/demos')).toBe(false);
  });
});

describe('withBase', () => {
  it('passes paths through unchanged at the root base', () => {
    expect(withBase(ROOT_BASE, '/')).toBe('/');
    expect(withBase(ROOT_BASE, '/reports')).toBe('/reports');
    expect(withBase(ROOT_BASE, '/reports?unit=year&anchor=2026')).toBe(
      '/reports?unit=year&anchor=2026',
    );
  });

  it('prefixes paths with the demo base', () => {
    expect(withBase(DEMO_BASE, '/categories')).toBe('/demo/categories');
    expect(withBase(DEMO_BASE, '/reports')).toBe('/demo/reports');
    expect(withBase(DEMO_BASE, '/reports/groceries?unit=month&anchor=2026-08')).toBe(
      '/demo/reports/groceries?unit=month&anchor=2026-08',
    );
  });

  it('yields the bare demo base for the dashboard, with no trailing slash', () => {
    expect(withBase(DEMO_BASE, '/')).toBe('/demo');
  });
});
