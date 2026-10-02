/**
 * Ownership scoping — the guard against BOLA / IDOR (OWASP API Security #1:
 * "user A changes the id in the URL and reads user B's record").
 *
 * Every repository method takes an `OwnerScope` as its FIRST argument, so an
 * unscoped query does not typecheck. Rules (taskRepository implements them):
 *
 *   signed out          → sees and edits SHARED rows only (`ownerId: null`)
 *   signed in as user U → sees and edits U's rows + SHARED rows; creates as U
 *   anyone else's row   → does not exist for you: GET/PATCH/DELETE → 404
 *                         (404, not 403, so ids cannot be probed)
 *
 * Shared rows keep the seeded demo world visible before anyone signs in. For a
 * resource that must never be shared (invoices, health records), require
 * `authRequired` on its router and drop the `ownerId: null` branch in
 * `visibleTo`.
 */

import type { Request } from 'express';

export interface OwnerScope {
  /** `null` = signed out. */
  ownerId: string | null;
}

/** The scope of the current request. Needs `attachUser` (or `authRequired`) upstream. */
export function ownerScope(req: Request): OwnerScope {
  return { ownerId: req.user?.id ?? null };
}

/** Prisma `where` fragment: the rows `scope` may read or write. */
export function visibleTo(scope: OwnerScope) {
  return scope.ownerId
    ? { OR: [{ ownerId: scope.ownerId }, { ownerId: null }] }
    : { ownerId: null };
}

/** Same rule for in-memory rows. */
export function canSee(scope: OwnerScope, row: { ownerId: string | null }): boolean {
  return row.ownerId === null || row.ownerId === scope.ownerId;
}
