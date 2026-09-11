/**
 * seed/backdate.ts — spread timestamps across a real historical window.
 *
 * This is the piece hand-written seeds never do, and the reason toy dashboards
 * read as fake: every row is stamped `now()`, so a "revenue over the last 12
 * months" chart is a flat line or a single spike, and every "vs last period"
 * delta is either 0 or equal to the whole value. Backdating `createdAt` across
 * months, with a growth trend, makes the trend line, the sparkline and the
 * period-over-period delta all TRUE — computed from real history, not invented.
 */

import type { SeededRandom } from './random';

export interface BackdateOptions {
  /** How far back the window reaches. Default 12 months. */
  monthsBack?: number;
  /**
   * Trend of volume over time.
   *  - 'growth'  (default): more rows land in recent months (a growing business)
   *  - 'flat'   : roughly even across the window
   *  - 'decline': more rows in older months
   */
  trend?: 'growth' | 'flat' | 'decline';
  /** Add weekday clustering (fewer rows on weekends). Default true. */
  businessDays?: boolean;
  /** Reference "now"; injectable for deterministic tests. Default new Date(). */
  now?: Date;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Return `count` timestamps spread across the window, SORTED ASCENDING.
 *
 * A `growth` trend biases timestamps toward recent months by sampling a
 * position in [0,1] and squaring it (dense near 1 = now); `decline` mirrors it;
 * `flat` samples uniformly. Optionally nudges weekend rows onto the preceding
 * Friday so activity clusters on business days.
 */
export function backdateSeries(
  rng: SeededRandom,
  count: number,
  opts: BackdateOptions = {},
): Date[] {
  const { monthsBack = 12, trend = 'growth', businessDays = true, now = new Date() } = opts;
  if (count <= 0) return [];

  const end = now.getTime();
  const start = end - monthsBack * 30 * MS_PER_DAY;
  const span = end - start;

  const dates: Date[] = [];
  for (let i = 0; i < count; i += 1) {
    let position = rng.next(); // [0,1): 0 = oldest, 1 = newest
    if (trend === 'growth')
      position = position ** 0.5; // bias toward recent
    else if (trend === 'decline') position = 1 - position ** 0.5; // bias toward old

    let t = start + position * span;
    const d = new Date(t);
    if (businessDays) {
      const day = d.getUTCDay();
      if (day === 0)
        t -= 2 * MS_PER_DAY; // Sunday -> Friday
      else if (day === 6) t -= MS_PER_DAY; // Saturday -> Friday
    }
    // clamp inside the window
    dates.push(new Date(Math.max(start, Math.min(end, t))));
  }

  return dates.sort((a, b) => a.getTime() - b.getTime());
}

/**
 * Bucket dates into `monthsBack` monthly counts, oldest first — the shape a
 * "last N months" chart consumes. Useful in tests to assert the trend is real.
 */
export function monthlyBuckets(dates: Date[], monthsBack = 12, now = new Date()): number[] {
  const buckets = new Array(monthsBack).fill(0);
  const end = now.getTime();
  const start = end - monthsBack * 30 * MS_PER_DAY;
  const span = end - start || 1;
  for (const d of dates) {
    const pos = (d.getTime() - start) / span; // [0,1]
    const idx = Math.max(0, Math.min(monthsBack - 1, Math.floor(pos * monthsBack)));
    buckets[idx] += 1;
  }
  return buckets;
}
