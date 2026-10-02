/**
 * shared/src/schemas/task.ts — THE REFERENCE RESOURCE.
 *
 * Task is the starter's one complete vertical slice: zod schema here, Prisma +
 * Mongoose models, a repository, an Express router, typed client calls, and a
 * page with loading / empty / error states. Copy this file's shape for every
 * new resource — schema first, then server, then client.
 *
 * Convention (three variants per resource):
 *   - `CreateXSchema`  — POST body. Only client-supplied fields.
 *   - `UpdateXSchema`  — PATCH body. Partial of create, at least one key.
 *   - `XSchema`        — API response. Includes server-owned fields (id,
 *                        timestamps) and serializes dates as ISO strings.
 *
 * Dates are `z.string()` (ISO-8601), not `z.date()`: JSON has no date type, so
 * the wire shape is a string on both sides. Parse to `Date` in the UI if you
 * need date math.
 */

import { z } from 'zod';

/** Task lifecycle states. Mirrored by the Prisma `TaskStatus` enum. */
export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const;

export const TaskStatusSchema = z.enum(TASK_STATUSES);

/** A task as returned by the API. */
export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: TaskStatusSchema,
  /**
   * The user who owns the row, or `null` for a SHARED row (the seeded demo
   * data, anything created while signed out). See OwnerScope in
   * server/src/middleware/scope.ts for who can see what.
   */
  ownerId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/**
 * POST /api/tasks body.
 *
 * `description` and `status` are optional rather than `.default(...)` on
 * purpose: a `.default()` makes zod's INPUT type diverge from its OUTPUT type,
 * which then fights `zodResolver` in the client form. Defaults for optional
 * columns belong in the DB model (see the Prisma/mongoose `status` default) and
 * in the repository, not in the wire schema.
 */
export const CreateTaskSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long'),
  description: z.string().trim().max(2000, 'Description is too long').nullish(),
  status: TaskStatusSchema.optional(),
});

/**
 * PATCH /api/tasks/:id body. Partial, but never empty — an empty PATCH is a
 * client bug, and returning 400 surfaces it instead of silently no-op'ing.
 */
export const UpdateTaskSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required').max(200, 'Title is too long').optional(),
    description: z.string().trim().max(2000, 'Description is too long').nullable().optional(),
    status: TaskStatusSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: 'Provide at least one field to update',
  });

/** `:id` path param for the single-task routes. */
export const TaskIdParamSchema = z.object({
  id: z.string().min(1),
});

/** Columns the list may be ordered by — a WHITELIST, never a raw column name from the URL. */
export const TASK_SORT_FIELDS = ['createdAt', 'title'] as const;

/** GET /api/tasks query string. Every field is optional. */
export const TaskListQuerySchema = z.object({
  status: TaskStatusSchema.optional(),
  /** Case-insensitive search over title + description. Blank = no search. */
  q: z
    .string()
    .trim()
    .max(100)
    .optional()
    .transform((v) => (v ? v : undefined)),
  sort: z.enum(TASK_SORT_FIELDS).default('createdAt'),
  dir: z.enum(['asc', 'desc']).default('desc'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  /** Opaque: the `nextCursor` of the previous page. */
  cursor: z.string().min(1).optional(),
});

/**
 * GET /api/tasks response. Envelope rather than a bare array so pagination
 * metadata can grow here without breaking clients.
 */
export const TaskListSchema = z.object({
  items: z.array(TaskSchema),
  total: z.number().int().nonnegative(),
  /** Pass back as `?cursor=` for the next page; null on the last page. */
  nextCursor: z.string().nullable(),
});
