/**
 * seed/ — the demo-data engine.
 *
 * Kills the "toy dashboard" tell (6 hand-typed rows, $854 MRR, deltas that equal
 * their own value). Generate hundreds of coherent, backdated records instead:
 *
 *   import { SeededRandom, defineFactory, Factory } from '@/services/seed';
 *
 *   const rng = new SeededRandom(SITE.name);              // deterministic per app
 *   const customers = defineFactory((r) => ({
 *     name: r.fullName(), email: r.email(), city: r.city(),
 *   })).buildMany(rng, 220, { backdate: { monthsBack: 12, trend: 'growth' } });
 *
 *   const orders = Factory.each(rng, customers,
 *     (r) => r.int(0, 8),                                 // orders per customer
 *     (r, customer) => ({ customerEmail: customer.email, total: r.amount(40, 900) }),
 *   );
 *
 *   // then batch-insert via Prisma createMany({ data, skipDuplicates: true }).
 *
 * HISTORICAL vs SCHEDULED dates — this is what makes an app's PRIMARY screen
 * open full instead of empty:
 *   - `backdateSeries` spreads dates into the PAST (createdAt, signups, past
 *     revenue) so charts have real trend.
 *   - `scheduleSeries` spreads dates AROUND NOW and into the FUTURE, with a row
 *     guaranteed TODAY. Use it for every forward-looking date field
 *     (dueDate, appointmentAt, deliveryDate, eventDate, startsAt, shiftAt).
 *     Backdating those instead is why apps opened on "No deliveries scheduled
 *     for today" — the whole point of the app was the upcoming view, and every
 *     seeded row was in the past.
 *
 *   const deliveries = defineFactory((r) => ({ ... })).buildMany(rng, 180);
 *   const when = scheduleSeries(rng, deliveries.length, { daysBack: 14, daysForward: 21 });
 *   deliveries.forEach((d, i) => (d.deliveryDate = when[i]));
 *
 * Everything is deterministic (same seed → same data), so a re-seed is
 * idempotent and demo data is reproducible. Tag demo rows (e.g. `isDemo: true`)
 * so they can be torn down once the owner's real data arrives.
 */

export { SeededRandom } from './random';
export {
  backdateSeries,
  scheduleSeries,
  monthlyBuckets,
  type BackdateOptions,
  type ScheduleOptions,
} from './backdate';
export {
  Factory,
  defineFactory,
  type Seeded,
  type BuildFn,
  type BuildManyOptions,
} from './factory';
