// Regression: 24 of 64 generated fullstack apps (2026-10-02 sweep) built date
// keys and date-input defaults with toISOString().slice/split, i.e. the UTC day.
import { afterEach, describe, expect, it } from 'vitest';

import { parseDateInputValue, toDateInputValue, toDateTimeInputValue } from '../utils';

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
});

describe('local date input helpers', () => {
  it('8pm in Los Angeles is still that day, not the UTC tomorrow', () => {
    process.env.TZ = 'America/Los_Angeles';
    const evening = new Date(2026, 9, 2, 20, 30); // Oct 2, 20:30 local = Oct 3 03:30 UTC
    expect(evening.toISOString().slice(0, 10)).toBe('2026-10-03'); // the bug
    expect(toDateInputValue(evening)).toBe('2026-10-02');
  });

  it('early morning in Kolkata is still that day, not the UTC yesterday', () => {
    process.env.TZ = 'Asia/Kolkata';
    const morning = new Date(2026, 9, 2, 3, 0); // Oct 2, 03:00 IST = Oct 1 21:30 UTC
    expect(toDateInputValue(morning)).toBe('2026-10-02');
  });

  it('datetime-local shows local wall-clock time', () => {
    process.env.TZ = 'America/New_York';
    expect(toDateTimeInputValue(new Date(2026, 9, 2, 9, 5))).toBe('2026-10-02T09:05');
  });

  it('a date key round-trips through parse on its local day', () => {
    process.env.TZ = 'America/Los_Angeles';
    const d = parseDateInputValue('2026-10-02');
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 9, 2, 0]);
    expect(toDateInputValue(d)).toBe('2026-10-02');
  });
});
