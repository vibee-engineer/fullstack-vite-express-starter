import { afterEach, describe, expect, it } from 'vitest';

import {
  findOverlap,
  generateSlots,
  isSlotTaken,
  noOverlapConstraintSql,
  overlaps,
  slotTaken,
} from '..';

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
});

describe('generateSlots', () => {
  it('builds slots in the BUSINESS zone, whatever zone the server runs in', () => {
    process.env.TZ = 'Asia/Kolkata';
    const slots = generateSlots({
      date: '2026-10-05',
      timeZone: 'America/New_York',
      open: '09:00',
      close: '12:00',
      durationMin: 60,
    });
    expect(slots.map((s) => s.label)).toEqual(['09:00', '10:00', '11:00']);
    expect(slots[0]).toMatchObject({
      start: '2026-10-05T13:00:00.000Z',
      end: '2026-10-05T14:00:00.000Z',
    });
  });

  it('drops the non-existent hour on spring-forward day (New York, 2026-03-08)', () => {
    const slots = generateSlots({
      date: '2026-03-08',
      timeZone: 'America/New_York',
      open: '00:00',
      close: '04:00',
      durationMin: 60,
    });
    expect(slots.map((s) => s.label)).toEqual(['00:00', '01:00', '03:00']);
    // 01:00 EST + 60 real minutes = 03:00 EDT
    expect(slots[1]).toMatchObject({
      start: '2026-03-08T06:00:00.000Z',
      end: '2026-03-08T07:00:00.000Z',
    });
  });

  it('offers the repeated fall-back hour once (New York, 2026-11-01)', () => {
    const slots = generateSlots({
      date: '2026-11-01',
      timeZone: 'America/New_York',
      open: '00:00',
      close: '03:00',
      durationMin: 30,
    });
    expect(slots.map((s) => s.label)).toEqual([
      '00:00',
      '00:30',
      '01:00',
      '01:30',
      '02:00',
      '02:30',
    ]);
    expect(new Set(slots.map((s) => s.start)).size).toBe(slots.length);
  });

  it('handles a 30-minute DST shift (Lord Howe, 2026-10-04)', () => {
    const slots = generateSlots({
      date: '2026-10-04',
      timeZone: 'Australia/Lord_Howe',
      open: '01:30',
      close: '03:00',
      durationMin: 15,
    });
    expect(slots.map((s) => s.label)).toEqual(['01:30', '01:45', '02:30', '02:45']);
  });

  it('skips breaks and never runs past closing', () => {
    const slots = generateSlots({
      date: '2026-10-05',
      timeZone: 'Europe/London',
      open: '09:00',
      close: '13:10',
      durationMin: 45,
      stepMin: 60,
      breaks: ['11:00-12:00'],
    });
    expect(slots.map((s) => s.label)).toEqual(['09:00', '10:00', '12:00']);
  });
});

describe('overlap', () => {
  const a = { startsAt: '2026-10-05T10:00:00Z', endsAt: '2026-10-05T11:00:00Z' };
  it('is half-open: back-to-back bookings do not collide', () => {
    expect(overlaps(a, { startsAt: '2026-10-05T11:00:00Z', endsAt: '2026-10-05T12:00:00Z' })).toBe(
      false,
    );
    expect(overlaps(a, { startsAt: '2026-10-05T10:59:00Z', endsAt: '2026-10-05T11:30:00Z' })).toBe(
      true,
    );
    expect(
      findOverlap([a], { startsAt: '2026-10-05T09:00:00Z', endsAt: '2026-10-05T10:01:00Z' }),
    ).toBe(a);
  });

  it('recognises the Postgres exclusion violation as Prisma 7 + adapter-pg reports it', () => {
    // Shape captured from a real 23P01 on Postgres 17 (P2010 raw; P2039 for model queries).
    const real = {
      name: 'PrismaClientKnownRequestError',
      code: 'P2010',
      meta: { driverAdapterError: { cause: { originalCode: '23P01', kind: 'postgres' } } },
    };
    expect(isSlotTaken(real)).toBe(true);
    expect(isSlotTaken({ ...real, code: 'P2039' })).toBe(true);
    expect(isSlotTaken({ code: 'P2002', meta: {} })).toBe(false);
    expect(isSlotTaken(new Error('boom'))).toBe(false);
    expect(slotTaken()).toMatchObject({ status: 409, code: 'SLOT_TAKEN' });
  });

  it('emits a constraint that quotes identifiers and ignores cancelled rows', () => {
    const sql = noOverlapConstraintSql({ table: 'Appointment', resourceColumn: 'therapistId' });
    expect(sql).toContain('CREATE EXTENSION IF NOT EXISTS btree_gist;');
    expect(sql).toContain(
      `EXCLUDE USING gist ("therapistId" WITH =, tstzrange("startsAt", "endsAt", '[)') WITH &&) WHERE ("status" <> 'cancelled');`,
    );
    expect(noOverlapConstraintSql({ table: 'x"; DROP TABLE y; --' })).toContain(
      '"x""; DROP TABLE y; --"',
    );
  });
});
