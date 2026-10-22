// Regression: ClassFlow (staging, 2026-10-21) built class times with setHours in
// the browser, then seeded them again from the UTC server in phase 2; a 6:30 AM
// class read 12:00 PM for a viewer in India. These helpers give the same instant
// on any clock.
import { afterEach, describe, expect, it } from 'vitest';

import { atTime, dayKey, formatDay, formatTime, startOfZonedDay, zoned } from '@shared/time';

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
});

const studio = 'America/Chicago';

describe('@shared/time', () => {
  it('atTime gives the same instant on a browser in India and on a UTC server', () => {
    const instants = ['Asia/Kolkata', 'UTC', 'America/Los_Angeles'].map((tz) => {
      process.env.TZ = tz;
      return atTime('2026-10-23T15:00:00Z', '06:30', studio).toISOString();
    });
    expect(new Set(instants).size).toBe(1);
    expect(instants[0]).toBe('2026-10-23T11:30:00.000Z'); // 06:30 CDT
  });

  it('setHours is the bug: it moves with the clock running the code', () => {
    const local = (tz: string) => {
      process.env.TZ = tz;
      const d = new Date('2026-10-23T15:00:00Z');
      d.setHours(6, 30, 0, 0);
      return d.toISOString();
    };
    expect(local('Asia/Kolkata')).not.toBe(local('UTC'));
  });

  it('formatTime and formatDay read the business clock, not the viewer', () => {
    process.env.TZ = 'Asia/Kolkata';
    const c = atTime('2026-10-23T15:00:00Z', '06:30', studio);
    expect(formatTime(c, undefined, studio)).toBe('6:30 AM');
    expect(formatTime(c.toISOString(), 'HH:mm', studio)).toBe('06:30');
    expect(formatDay(c, 'EEEE', studio)).toBe('Friday');
  });

  it('a late class stays on its own day, not the viewer tomorrow', () => {
    process.env.TZ = 'Asia/Kolkata';
    const late = atTime('2026-10-23T15:00:00Z', '21:00', studio); // 02:00Z on the 24th
    expect(dayKey(late, studio)).toBe('2026-10-23');
    expect(late.toISOString().slice(0, 10)).toBe('2026-10-24');
  });

  it('the business day starts at its own midnight', () => {
    process.env.TZ = 'UTC';
    expect(startOfZonedDay('2026-10-23T03:00:00Z', studio).toISOString()).toBe(
      '2026-10-22T05:00:00.000Z',
    );
  });

  it('keeps wall-clock times across a DST change', () => {
    process.env.TZ = 'UTC';
    const before = atTime('2026-10-31T15:00:00Z', '06:30', studio);
    const after = atTime('2026-11-02T15:00:00Z', '06:30', studio);
    expect(formatTime(before, 'HH:mm', studio)).toBe('06:30');
    expect(formatTime(after, 'HH:mm', studio)).toBe('06:30');
    expect(after.getTime() - before.getTime()).toBe((2 * 24 + 1) * 3600_000);
  });

  it('zoned date-fns style getters work on the business calendar', () => {
    process.env.TZ = 'Asia/Kolkata';
    const z = zoned('2026-10-23T11:30:00Z', studio);
    expect([z.getDate(), z.getHours(), z.getMinutes()]).toEqual([23, 6, 30]);
  });

  it('rejects a malformed time instead of building Invalid Date', () => {
    expect(() => atTime(new Date(), '6.30', studio)).toThrow(/bad time/);
  });
});
