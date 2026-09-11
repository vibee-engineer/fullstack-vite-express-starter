/**
 * shared/src/schemas/common.ts — reusable zod building blocks.
 *
 * Every resource re-derives the same handful of shapes: an `:id` path param, a
 * paginated list query, a list-response envelope, ISO timestamp fields. This
 * file is the single home for them so a new resource composes instead of
 * re-typing (and so pagination/soft-delete conventions stay identical app-wide).
 *
 * Consumed by both client and server via `@shared/schemas`. Types are inferred
 * in `shared/src/types.ts`. See `./task.ts` for the reference resource that
 * shows how these compose with a resource's own Create/Update/response schemas.
 */

import { z } from 'zod';

/**
 * The wire representation of a date. JSON has no date type, so timestamps cross
 * the wire as ISO-8601 strings (never `z.date()`). Parse to `Date` in the UI if
 * you need date math. Use `TimestampFields` to stamp a response schema.
 */
export const IsoDateStringSchema = z.string().datetime({ offset: true });

/** `createdAt` / `updatedAt` as they appear on every API response object. */
export const TimestampFields = {
  createdAt: z.string(),
  updatedAt: z.string(),
} as const;

/**
 * `:id` path param for single-record routes. Resources with an opaque string id
 * (cuid / ObjectId) use this as-is; validate it with `validate(IdParamSchema,
 * 'params')`.
 */
export const IdParamSchema = z.object({
  id: z.string().min(1, 'id is required'),
});

/**
 * Standard list query: a bounded page size plus an opaque forward cursor.
 * Cursor pagination (not offset) so a growing table stays stable under inserts.
 * A resource that also filters extends this with `.extend({ status: ... })`.
 */
export const PaginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).optional(),
});

/**
 * Build a list-response envelope for `itemSchema`. An envelope (not a bare
 * array) so pagination metadata can grow without breaking clients. `nextCursor`
 * is null on the last page.
 *
 *   export const TaskListSchema = makeListResponse(TaskSchema);
 */
export function makeListResponse<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    total: z.number().int().nonnegative(),
    nextCursor: z.string().nullish(),
  });
}

/**
 * Query flag for endpoints that can include soft-deleted rows (a Trash view).
 * Pairs with the soft-delete repository helpers on the server.
 */
export const TrashQuerySchema = PaginationQuerySchema.extend({
  /** `active` (default) hides soft-deleted rows; `trash` returns only them. */
  scope: z.enum(['active', 'trash']).default('active'),
});
