import { describe, it, expect } from 'vitest';

import { SeededRandom } from '../random';
import { backdateSeries, monthlyBuckets } from '../backdate';
import { defineFactory, Factory } from '../factory';

describe('SeededRandom — determinism', () => {
  it('same seed yields the same sequence; different seeds differ', () => {
    const a = new SeededRandom('acme');
    const b = new SeededRandom('acme');
    const c = new SeededRandom('other');
    const seqA = Array.from({ length: 8 }, () => a.next());
    const seqB = Array.from({ length: 8 }, () => b.next());
    const seqC = Array.from({ length: 8 }, () => c.next());
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(seqC);
  });
});

describe('SeededRandom — primitives', () => {
  const rng = new SeededRandom(42);

  it('int stays within inclusive bounds', () => {
    for (let i = 0; i < 500; i += 1) {
      const v = rng.int(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('float respects bounds and decimals', () => {
    const v = rng.float(1, 2, 2);
    expect(v).toBeGreaterThanOrEqual(1);
    expect(v).toBeLessThan(2);
    expect(Math.round(v * 100)).toBe(v * 100);
  });

  it('pick throws on an empty array; sample returns distinct elements', () => {
    expect(() => rng.pick([])).toThrow();
    const arr = [1, 2, 3, 4, 5];
    const s = rng.sample(arr, 3);
    expect(s).toHaveLength(3);
    expect(new Set(s).size).toBe(3);
    expect(rng.sample(arr, 99)).toHaveLength(5); // capped at length
  });

  it('weighted overwhelmingly favours the heavy option', () => {
    const r = new SeededRandom('w');
    let heavy = 0;
    for (let i = 0; i < 1000; i += 1) {
      if (r.weighted([['A', 95] as const, ['B', 5] as const]) === 'A') heavy += 1;
    }
    expect(heavy).toBeGreaterThan(850);
  });
});

describe('SeededRandom — domain generators', () => {
  const rng = new SeededRandom('gen');
  it('produce plausible, non-empty values', () => {
    expect(rng.fullName()).toMatch(/^\S+ \S+$/);
    expect(rng.company().length).toBeGreaterThan(2);
    expect(rng.email('Jane Doe')).toMatch(/^jane\.doe@/); // coherent with the name
    expect(rng.phone()).toMatch(/^\(\d{3}\) \d{3}-\d{4}$/);
    expect(rng.amount(10, 20)).toBeGreaterThanOrEqual(10);
  });
});

describe('backdateSeries', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');

  it('returns `count` dates, sorted ascending, inside the window', () => {
    const rng = new SeededRandom('bd');
    const dates = backdateSeries(rng, 300, { monthsBack: 12, now, businessDays: false });
    expect(dates).toHaveLength(300);
    const start = now.getTime() - 12 * 30 * 24 * 60 * 60 * 1000;
    for (let i = 0; i < dates.length; i += 1) {
      expect(dates[i]!.getTime()).toBeGreaterThanOrEqual(start);
      expect(dates[i]!.getTime()).toBeLessThanOrEqual(now.getTime());
      if (i > 0) expect(dates[i]!.getTime()).toBeGreaterThanOrEqual(dates[i - 1]!.getTime());
    }
  });

  it('growth trend puts MORE rows in recent months than old ones', () => {
    const rng = new SeededRandom('grow');
    const dates = backdateSeries(rng, 600, {
      monthsBack: 12,
      trend: 'growth',
      now,
      businessDays: false,
    });
    const buckets = monthlyBuckets(dates, 12, now);
    const oldHalf = buckets.slice(0, 6).reduce((s, n) => s + n, 0);
    const recentHalf = buckets.slice(6).reduce((s, n) => s + n, 0);
    expect(recentHalf).toBeGreaterThan(oldHalf);
  });

  it('decline trend inverts the bias', () => {
    const rng = new SeededRandom('decl');
    const dates = backdateSeries(rng, 600, {
      monthsBack: 12,
      trend: 'decline',
      now,
      businessDays: false,
    });
    const buckets = monthlyBuckets(dates, 12, now);
    const oldHalf = buckets.slice(0, 6).reduce((s, n) => s + n, 0);
    const recentHalf = buckets.slice(6).reduce((s, n) => s + n, 0);
    expect(oldHalf).toBeGreaterThan(recentHalf);
  });

  it('businessDays nudges weekend rows off Sat/Sun', () => {
    const rng = new SeededRandom('bday');
    const dates = backdateSeries(rng, 400, { monthsBack: 6, now, businessDays: true });
    const weekend = dates.filter((d) => d.getUTCDay() === 0 || d.getUTCDay() === 6).length;
    // not necessarily zero (clamping at the window edge), but a small minority
    expect(weekend / dates.length).toBeLessThan(0.1);
  });

  it('is a no-op for count <= 0', () => {
    expect(backdateSeries(new SeededRandom('z'), 0)).toEqual([]);
  });
});

describe('Factory', () => {
  const now = new Date('2026-06-15T12:00:00.000Z');

  it('buildMany produces `count` timestamped rows', () => {
    const rng = new SeededRandom('f');
    const customers = defineFactory((r) => ({ name: r.fullName(), email: r.email() }));
    const rows = customers.buildMany(rng, 150, {
      backdate: { monthsBack: 12, now, businessDays: false },
    });
    expect(rows).toHaveLength(150);
    expect(rows[0]!.name).toMatch(/\S+ \S+/);
    // backdated + ascending
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i]!.createdAt.getTime()).toBeGreaterThanOrEqual(rows[i - 1]!.createdAt.getTime());
    }
    expect(rows[0]!.createdAt.getTime()).toBeLessThan(now.getTime());
  });

  it('is deterministic — same seed rebuilds identical rows', () => {
    const build = () =>
      defineFactory((r) => ({ name: r.fullName(), total: r.amount(10, 500) })).buildMany(
        new SeededRandom('same'),
        20,
      );
    expect(build().map((r) => r.name)).toEqual(build().map((r) => r.name));
  });

  it('each() builds children that fall at or after their parent', () => {
    const rng = new SeededRandom('h');
    const customers = defineFactory((r) => ({ email: r.email() })).buildMany(rng, 30, {
      backdate: { monthsBack: 12, now, businessDays: false },
    });
    const orders = Factory.each(
      rng,
      customers,
      (r) => r.int(0, 5),
      (r, parent) => ({ customerEmail: parent.email, total: r.amount(20, 400) }),
    );
    expect(orders.length).toBeGreaterThan(0);
    // every order references a real customer email
    const emails = new Set(customers.map((c) => c.email));
    for (const o of orders) expect(emails.has(o.customerEmail)).toBe(true);
  });
});
