import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertAnchorUnit } from './date';

afterEach(() => {
  vi.useRealTimers();
});

/** Pin the wall clock, since `convertAnchorUnit` reads "now" for the month. */
function atDate(iso: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(iso));
}

describe('convertAnchorUnit', () => {
  it('drops a month anchor to its year on Month→Year', () => {
    expect(convertAnchorUnit('2026-08', 'year')).toBe('2026');
    expect(convertAnchorUnit('2024-03', 'year')).toBe('2024');
  });

  it('keeps the viewed year and anchors to the current month on Year→Month', () => {
    atDate('2026-08-15T12:00:00');
    expect(convertAnchorUnit('2026', 'month')).toBe('2026-08');
    // A past year keeps *its* year — only the month comes from "now", so you
    // land on the same month you were in rather than back at January.
    expect(convertAnchorUnit('2024', 'month')).toBe('2024-08');
  });

  it('zero-pads the current month it borrows', () => {
    // Guards the positional `slice(5)` against a single-digit month: a bare
    // `getMonth() + 1` would yield "2025-3" and break every downstream
    // `YYYY-MM` comparison.
    atDate('2026-03-05T12:00:00');
    expect(convertAnchorUnit('2025', 'month')).toBe('2025-03');
  });

  it('round-trips Month→Year→Month within the current month', () => {
    atDate('2026-11-02T12:00:00');
    const year = convertAnchorUnit('2026-11', 'year');
    expect(convertAnchorUnit(year, 'month')).toBe('2026-11');
  });
});
