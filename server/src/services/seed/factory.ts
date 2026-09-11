/**
 * seed/factory.ts — a small factory primitive for coherent, backdated records.
 *
 * A factory turns the seeded RNG into a stream of realistic rows. It exists so a
 * resource seeds HUNDREDS of coherent records (not 6 hand-typed ones) in a few
 * lines, with an ascending `createdAt` history the dashboards can trend over.
 *
 *   const customers = defineFactory((rng, i) => ({
 *     name: rng.fullName(),
 *     email: rng.email(),
 *   }));
 *   const rows = customers.buildMany(rng, 200, { backdate: { monthsBack: 12 } });
 *   // rows[i].createdAt / updatedAt are set, ascending, across the last 12 months.
 *
 * Nested hierarchies (customer -> orders -> line items) compose with `.each()`.
 */

import type { SeededRandom } from './random';
import { backdateSeries, type BackdateOptions } from './backdate';

/** A record the factory stamps with timestamps. */
export type Seeded<T> = T & { createdAt: Date; updatedAt: Date };

export type BuildFn<T> = (rng: SeededRandom, index: number) => T;

export interface BuildManyOptions {
  /** Backdate `createdAt`/`updatedAt` across a window (see ./backdate). Omit = all now. */
  backdate?: BackdateOptions;
}

export class Factory<T extends object> {
  constructor(private readonly builder: BuildFn<T>) {}

  /** Build one record (timestamped `now`), with optional field overrides. */
  build(rng: SeededRandom, index = 0, overrides: Partial<T> = {}): Seeded<T> {
    const now = new Date();
    return { ...this.builder(rng, index), createdAt: now, updatedAt: now, ...overrides };
  }

  /**
   * Build `count` records. When `backdate` is given, each row's timestamps are
   * drawn from an ascending historical series so the set carries a real trend.
   */
  buildMany(rng: SeededRandom, count: number, opts: BuildManyOptions = {}): Seeded<T>[] {
    const stamps = opts.backdate ? backdateSeries(rng, count, opts.backdate) : null;
    const rows: Seeded<T>[] = [];
    for (let i = 0; i < count; i += 1) {
      const created = stamps ? (stamps[i] as Date) : new Date();
      rows.push({ ...this.builder(rng, i), createdAt: created, updatedAt: created });
    }
    return rows;
  }

  /**
   * For each parent, build a variable number of children — the customer -> orders
   * pattern. `childCount` is resolved per parent so hierarchies feel organic.
   * Children inherit a `createdAt` at or after their parent's.
   */
  static each<P extends { createdAt: Date }, C extends object>(
    rng: SeededRandom,
    parents: P[],
    childCount: (rng: SeededRandom, parent: P, index: number) => number,
    childBuilder: (rng: SeededRandom, parent: P, index: number) => C,
  ): Seeded<C>[] {
    const out: Seeded<C>[] = [];
    const now = Date.now();
    for (let p = 0; p < parents.length; p += 1) {
      const parent = parents[p] as P;
      const n = Math.max(0, childCount(rng, parent, p));
      const parentTime = parent.createdAt.getTime();
      for (let c = 0; c < n; c += 1) {
        // child lands between the parent's creation and now
        const created = new Date(rng.int(parentTime, now));
        out.push({ ...childBuilder(rng, parent, c), createdAt: created, updatedAt: created });
      }
    }
    return out;
  }
}

/** Convenience constructor: `defineFactory((rng, i) => ({...}))`. */
export function defineFactory<T extends object>(builder: BuildFn<T>): Factory<T> {
  return new Factory<T>(builder);
}
