/**
 * tasks.ts — THE REFERENCE ROUTER. Copy this file per resource.
 *
 * Every handler follows the same four rules:
 *   1. `validate(schema, source)` in front of anything that reads user input —
 *      body, query, or params. The middleware replaces `req[source]` with the
 *      PARSED value, so handlers get coerced/defaulted data, never raw strings.
 *   2. `asyncHandler(...)` around every async handler, so a rejected promise
 *      reaches the error middleware instead of becoming an unhandled rejection.
 *   3. All persistence through the repository — no Prisma or mongoose imports
 *      here. See `../repositories/taskRepository.ts`.
 *   4. Errors as `next({ status, message, code })`. The error middleware
 *      renders `{ error: { message, code } }`; the client's axios interceptor
 *      unwraps exactly that shape.
 */

import { Router } from 'express';
import {
  CreateTaskSchema,
  TaskIdParamSchema,
  TaskListQuerySchema,
  UpdateTaskSchema,
} from '@shared/schemas/task';
import type { CreateTask, TaskListQuery, UpdateTask } from '@shared/types';

import { asyncHandler } from '../middleware/async-handler';
import { validate } from '../middleware/validate';
import { getTaskRepository } from '../repositories/taskRepository';

export const tasksRouter = Router();

/** Shared 404 — one shape for every "no such task". */
const notFound = (id: string) => ({
  status: 404,
  message: `No task with id "${id}".`,
  code: 'TASK_NOT_FOUND',
});

/** GET /api/tasks?status=todo&limit=50 → { items, total } */
tasksRouter.get(
  '/',
  validate(TaskListQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as TaskListQuery;
    const result = await getTaskRepository().list(query);
    res.json(result);
  }),
);

/** GET /api/tasks/:id → Task | 404 */
tasksRouter.get(
  '/:id',
  validate(TaskIdParamSchema, 'params'),
  asyncHandler(async (req, res, next) => {
    const { id } = req.params as { id: string };
    const task = await getTaskRepository().findById(id);
    if (!task) return next(notFound(id));
    res.json(task);
  }),
);

/** POST /api/tasks → 201 Task */
tasksRouter.post(
  '/',
  validate(CreateTaskSchema),
  asyncHandler(async (req, res) => {
    const task = await getTaskRepository().create(req.body as CreateTask);
    res.status(201).json(task);
  }),
);

/** PATCH /api/tasks/:id → Task | 404 */
tasksRouter.patch(
  '/:id',
  validate(TaskIdParamSchema, 'params'),
  validate(UpdateTaskSchema),
  asyncHandler(async (req, res, next) => {
    const { id } = req.params as { id: string };
    const task = await getTaskRepository().update(id, req.body as UpdateTask);
    if (!task) return next(notFound(id));
    res.json(task);
  }),
);

/** DELETE /api/tasks/:id → 204 | 404 */
tasksRouter.delete(
  '/:id',
  validate(TaskIdParamSchema, 'params'),
  asyncHandler(async (req, res, next) => {
    const { id } = req.params as { id: string };
    const deleted = await getTaskRepository().remove(id);
    if (!deleted) return next(notFound(id));
    res.status(204).end();
  }),
);
