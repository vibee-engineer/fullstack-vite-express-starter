/**
 * shared/types.ts — TypeScript types inferred from the zod schemas.
 *
 * Keep this file mechanical — every export is `z.infer<typeof X>`. Widening,
 * transforms, and enum aliasing all belong in schemas.ts.
 */

import type { z } from 'zod';
import type { CreateUserSchema, UserSchema, HealthSchema } from './schemas';
import type {
  TaskSchema,
  TaskStatusSchema,
  CreateTaskSchema,
  UpdateTaskSchema,
  TaskListQuerySchema,
  TaskListSchema,
} from './schemas/task';

export type CreateUser = z.infer<typeof CreateUserSchema>;
export type User = z.infer<typeof UserSchema>;
export type Health = z.infer<typeof HealthSchema>;

/** Task — the reference resource. See shared/src/schemas/task.ts. */
export type Task = z.infer<typeof TaskSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type CreateTask = z.infer<typeof CreateTaskSchema>;
export type UpdateTask = z.infer<typeof UpdateTaskSchema>;
export type TaskListQuery = z.infer<typeof TaskListQuerySchema>;
export type TaskList = z.infer<typeof TaskListSchema>;
