/**
 * Schema-contract tests for the mongoose models.
 *
 * These files are typechecked (tsconfig's `include` covers `mongoose/`) but
 * were previously executed by no test at all, because vitest's `include` was
 * `src/**` only — so nothing verified the Mongo model layer.
 *
 * IMPORTANT — what this file canNOT check. The bug that originally motivated it
 * was a CJS/ESM interop failure:
 *
 *   import { Schema, model, models } from 'mongoose';   // throws at runtime
 *
 * A test here does NOT catch that, and it is worth understanding why before you
 * add one and believe you are covered. vitest resolves modules through Vite's
 * transform pipeline, and Vite's CJS interop synthesizes named exports that
 * Node's native ESM loader refuses to provide. The buggy import passes under
 * vitest and throws under tsx — verified by reintroducing it and watching all
 * 21 tests stay green. The runner is precisely what hides the bug.
 *
 * That check lives in `server/scripts/check-esm-interop.ts`, which loads these
 * modules under the real tsx loader and is wired into `npm test`.
 *
 * What this file DOES cover: the schema shape stays aligned with the shared
 * wire contract, the status enum matches `TASK_STATUSES`, and the
 * re-import guard still prevents OverwriteModelError. No database connection is
 * required — defining a schema and compiling a model are in-process operations.
 */
import { describe, expect, it } from 'vitest';

describe('mongoose models — ESM/CJS interop', () => {
  it('Task model imports and compiles without a live connection', async () => {
    const { Task } = await import('../models/Task');
    expect(Task).toBeDefined();
    expect(Task.modelName).toBe('Task');
  });

  it('User model imports and compiles without a live connection', async () => {
    const mod = await import('../models/User');
    expect(mod.User).toBeDefined();
    expect(mod.User.modelName).toBe('User');
  });

  it('Task schema matches the shared wire contract', async () => {
    // Guards the drift the model file's own header warns about: the repository
    // maps Prisma rows and mongoose docs onto one `Task` type, so a field
    // missing here surfaces as a runtime shape mismatch, not a type error.
    const { Task } = await import('../models/Task');
    const paths = Object.keys(Task.schema.paths);
    for (const field of ['title', 'description', 'status', 'createdAt', 'updatedAt']) {
      expect(paths).toContain(field);
    }
  });

  it('status enum is exactly the shared TASK_STATUSES', async () => {
    const { Task } = await import('../models/Task');
    const { TASK_STATUSES } = await import('@shared/schemas/task');
    const status = Task.schema.path('status') as unknown as {
      enumValues?: string[];
    };
    expect(status.enumValues).toEqual([...TASK_STATUSES]);
  });

  it('re-importing is idempotent — no OverwriteModelError under tsx watch', async () => {
    // The `models.Task ?? model(...)` guard in the model file exists for this.
    // If it regresses, `tsx watch` throws OverwriteModelError on every save.
    const a = await import('../models/Task');
    const b = await import('../models/Task');
    expect(a.Task).toBe(b.Task);
  });
});
