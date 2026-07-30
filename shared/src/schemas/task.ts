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

/** GET /api/tasks query string. `status` narrows the list; both are optional. */
export const TaskListQuerySchema = z.object({
  status: TaskStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * GET /api/tasks response. Envelope rather than a bare array so pagination
 * metadata can grow here without breaking clients.
 */
export const TaskListSchema = z.object({
  items: z.array(TaskSchema),
  total: z.number().int().nonnegative(),
});
