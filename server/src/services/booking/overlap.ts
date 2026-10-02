export interface TimeRange {
  /** Anything `new Date()` accepts; compared as instants. */
  startsAt: string | Date;
  endsAt: string | Date;
}

const t = (v: string | Date) => new Date(v).getTime();

/** Half-open [start, end): 10:00-11:00 and 11:00-12:00 do NOT overlap. */
export function overlaps(a: TimeRange, b: TimeRange): boolean {
  return t(a.startsAt) < t(b.endsAt) && t(b.startsAt) < t(a.endsAt);
}

/** First existing booking that collides with `candidate`, or null. App-level check for Mongo / SKIP_DB. */
export function findOverlap<T extends TimeRange>(existing: T[], candidate: TimeRange): T | null {
  return existing.find((b) => overlaps(b, candidate)) ?? null;
}

/**
 * True when `err` is Postgres' exclusion violation (SQLSTATE 23P01), i.e. the
 * no-overlap constraint rejected a double booking. Prisma 7 + adapter-pg
 * surfaces it as P2039 (model queries) or P2010 (raw queries) with the SQLSTATE
 * at meta.driverAdapterError.cause.originalCode — verified against Postgres 17.
 */
export function isSlotTaken(err: unknown): boolean {
  const meta = (err as { meta?: { driverAdapterError?: { cause?: { originalCode?: string } } } })
    ?.meta;
  const code = meta?.driverAdapterError?.cause?.originalCode ?? (err as { code?: string })?.code;
  return code === '23P01';
}

/** The `next()` error for a taken slot: 409 + a stable code the client can branch on. */
export function slotTaken(message = 'That time was just booked. Pick another slot.') {
  return { status: 409, message, code: 'SLOT_TAKEN' };
}

/**
 * SQL for a create-only migration that makes overlapping bookings of the same
 * resource IMPOSSIBLE at the database level (Postgres + btree_gist). Cancelled
 * rows are ignored so a cancelled slot can be rebooked. Keep it immediate
 * (not DEFERRABLE): deferred exclusion checks inside interactive transactions
 * have been reported not to raise (prisma/prisma#26366).
 */
export function noOverlapConstraintSql(opts: {
  table: string;
  resourceColumn?: string;
  startColumn?: string;
  endColumn?: string;
  /** Rows with this status never block a slot. `null` to block on every row. */
  ignoreStatus?: { column: string; value: string } | null;
}): string {
  const q = (id: string) => `"${id.replace(/"/g, '""')}"`;
  const table = q(opts.table);
  const res = q(opts.resourceColumn ?? 'resourceId');
  const start = q(opts.startColumn ?? 'startsAt');
  const end = q(opts.endColumn ?? 'endsAt');
  const ignore =
    opts.ignoreStatus === undefined ? { column: 'status', value: 'cancelled' } : opts.ignoreStatus;
  const where = ignore
    ? ` WHERE (${q(ignore.column)} <> '${ignore.value.replace(/'/g, "''")}')`
    : '';
  const name = (s: string) => q(`${opts.table}_${s}`);
  return [
    'CREATE EXTENSION IF NOT EXISTS btree_gist;',
    `ALTER TABLE ${table} ADD CONSTRAINT ${name('ends_after_start')} CHECK (${end} > ${start});`,
    `ALTER TABLE ${table} ADD CONSTRAINT ${name('no_overlap')}`,
    `  EXCLUDE USING gist (${res} WITH =, tstzrange(${start}, ${end}, '[)') WITH &&)${where};`,
  ].join('\n');
}
