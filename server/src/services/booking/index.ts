/**
 * booking/ — appointments, reservations, shifts: anything that books a
 * RESOURCE (therapist, room, table, vehicle) for a TIME RANGE.
 *
 * The two bugs every booking app ships unless it is built like this:
 *
 *   1. DOUBLE-BOOKING. "SELECT free? then INSERT" races: two patients click the
 *      same slot, both checks pass, both rows land. Only the DATABASE can make
 *      overlap impossible: a Postgres EXCLUDE constraint (noOverlapConstraintSql
 *      below). Catch its error with isSlotTaken(err) and answer 409.
 *   2. TIME-ZONE DRIFT. Slots built with `new Date()` arithmetic follow the
 *      SERVER's zone (UTC on Fly) and shift an hour at every DST change. Build
 *      them in the BUSINESS's IANA zone with generateSlots(), store UTC.
 *
 * Recipe for a new `Booking` model (Postgres):
 *
 *   model Booking {
 *     id         String   @id @default(cuid())
 *     resourceId String                      // therapistId, roomId, ...
 *     startsAt   DateTime @db.Timestamptz(3)
 *     endsAt     DateTime @db.Timestamptz(3)
 *     status     String   @default("confirmed")
 *     ...
 *     @@index([resourceId, startsAt])
 *   }
 *
 *   npx prisma migrate dev --create-only --name booking_no_overlap
 *   then paste noOverlapConstraintSql({ table: 'Booking' }) into that
 *   migration.sql and run the migration. Prisma does not model EXCLUDE
 *   constraints, so it never drops them and reports no drift.
 *
 *   try { await prisma.booking.create({ data }) }
 *   catch (err) { if (isSlotTaken(err)) return next(slotTaken()); throw err; }
 *
 * Mongo / SKIP_DB: there is no exclusion constraint, so check with
 * findOverlap() inside the same request and accept the small race (or put the
 * check and insert in a transaction with a per-resource lock document).
 */

export { generateSlots, type Slot, type SlotOptions } from './slots';
export {
  findOverlap,
  isSlotTaken,
  noOverlapConstraintSql,
  overlaps,
  slotTaken,
  type TimeRange,
} from './overlap';
