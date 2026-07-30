/**
 * Mongoose parallel of the Prisma `Task` model — the reference resource.
 *
 * Both DB stacks ship side by side; exactly one is live per project (see
 * `server/src/env.ts`: `isPostgres` / `isMongo`). Nothing imports this file
 * directly except `server/src/repositories/taskRepository.ts`, and it does so
 * with a dynamic `import()` so Mongo code never loads in a Postgres project.
 *
 * Keep the field set identical to the Prisma model and to
 * `shared/src/schemas/task.ts` — the repository maps both shapes onto the same
 * `Task` wire type, so a drift here shows up as a runtime shape mismatch.
 */
import { Schema, model, models, type Model } from 'mongoose';
import { TASK_STATUSES } from '@shared/schemas/task';
import type { TaskStatus } from '@shared/types';

/** Document fields. `_id`, `createdAt`, `updatedAt` are added by mongoose. */
export interface TaskDoc {
  title: string;
  description: string | null;
  status: TaskStatus;
  createdAt: Date;
  updatedAt: Date;
}

const TaskMongooseSchema = new Schema<TaskDoc>(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: null, trim: true, maxlength: 2000 },
    status: {
      type: String,
      enum: TASK_STATUSES,
      default: 'todo',
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

// Matches the Prisma `@@index([status, createdAt])` so the list query
// (filter by status, sort by createdAt) is covered on both stacks.
TaskMongooseSchema.index({ status: 1, createdAt: -1 });

/**
 * `models.Task ||` guard: `tsx watch` re-imports modules on every save, and
 * mongoose throws `OverwriteModelError` if the same model name is compiled
 * twice.
 */
export const Task: Model<TaskDoc> =
  (models.Task as Model<TaskDoc> | undefined) ?? model<TaskDoc>('Task', TaskMongooseSchema);
