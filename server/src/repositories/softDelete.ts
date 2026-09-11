/**
 * softDelete.ts — reusable soft-delete helpers (Prisma / Postgres).
 *
 * WHY: blue-collar owners fat-finger deletes. A soft delete makes every delete
 * undoable — the row is hidden, not destroyed — which is the right default for
 * software a business runs on. Pairs with the `TrashQuerySchema` in
 * `@shared/schemas/common` and a Trash/Restore UI.
 *
 * CONVENTION: a soft-deletable model carries a nullable `deletedAt DateTime?`.
 *   - "delete" SETS deletedAt (recoverable) instead of removing the row;
 *   - every list/find filters `{ deletedAt: null }` so trashed rows vanish from
 *     the app but survive for restore;
 *   - a Trash view lists `{ deletedAt: { not: null } }`.
 *
 * APPLY to a resource:
 *   1. add `deletedAt DateTime?` to its Prisma model (+ `@@index([deletedAt])`);
 *   2. in its repository, wrap list/find `where` with `activeWhere(...)`, and
 *      implement `remove` via `softRemove(prisma.<model>, id)` plus a
 *      `restore(prisma.<model>, id)`.
 *
 * Prisma-first for v1; the Mongo equivalent (a `deletedAt` field + the same
 * filter) is a fast-follow.
 */

/** Where-fragment that hides soft-deleted rows. Spread into a resource filter. */
export const NOT_DELETED = { deletedAt: null } as const;

/** Merge the not-deleted filter into a resource `where` (the default list view). */
export function activeWhere<T extends Record<string, unknown>>(
  where?: T,
): T & { deletedAt: null } {
  return { ...((where ?? {}) as T), deletedAt: null };
}

/** Merge the ONLY-deleted filter into a resource `where` (the Trash view). */
export function trashWhere<T extends Record<string, unknown>>(
  where?: T,
): T & { deletedAt: { not: null } } {
  return { ...((where ?? {}) as T), deletedAt: { not: null } };
}

/** Prisma "record not found" (P2025) — thrown by update() on a missing row. */
export function isRecordNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2025';
}

/** The subset of a Prisma model delegate these helpers call. */
export interface SoftDeleteDelegate {
  update(args: { where: { id: string }; data: { deletedAt: Date | null } }): Promise<unknown>;
}

/**
 * Soft-remove: set `deletedAt = now`. Returns `false` when no row matched (the
 * route turns that into a 404), `true` on success. Mirrors the `TaskRepository`
 * `remove(): Promise<boolean>` contract so it drops into the reference shape.
 */
export async function softRemove(delegate: SoftDeleteDelegate, id: string): Promise<boolean> {
  try {
    await delegate.update({ where: { id }, data: { deletedAt: new Date() } });
    return true;
  } catch (err) {
    if (isRecordNotFound(err)) return false;
    throw err;
  }
}

/** Restore a soft-deleted row: clear `deletedAt`. Returns `false` when not found. */
export async function restore(delegate: SoftDeleteDelegate, id: string): Promise<boolean> {
  try {
    await delegate.update({ where: { id }, data: { deletedAt: null } });
    return true;
  } catch (err) {
    if (isRecordNotFound(err)) return false;
    throw err;
  }
}
