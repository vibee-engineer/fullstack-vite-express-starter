/**
 * taskRepository.ts — THE REFERENCE REPOSITORY.
 *
 * The starter ships two DB stacks (Prisma/Postgres and Mongoose/Mongo) and one
 * dev escape hatch (`SKIP_DB=1`). Routes must not care which is live, so the
 * `isPostgres` / `isMongo` branch is confined to this file: routers depend on
 * the `TaskRepository` interface, nothing else.
 *
 * Copy this shape per resource (`userRepository.ts`, `orderRepository.ts`, ...):
 *
 *   1. Declare the interface in terms of the SHARED wire types (`Task`,
 *      `CreateTask`, ...), never in terms of Prisma or mongoose types.
 *   2. Write one factory per backend. Import the DB client with a dynamic
 *      `import()` inside the factory so a Postgres project never loads
 *      mongoose (and vice versa).
 *   3. Normalize rows through a single `toTask()` mapper — `Date` objects
 *      become ISO strings exactly once, in exactly one place.
 *   4. Export a memoized `get<Resource>Repository()` selector.
 */

import { isMongo, isPostgres } from '../env';
import type { CreateTask, Task, TaskListQuery, TaskStatus, UpdateTask } from '@shared/types';

export interface TaskRepository {
  /** Newest first. `total` is the count matching the filter, ignoring `limit`. */
  list(query: TaskListQuery): Promise<{ items: Task[]; total: number }>;
  findById(id: string): Promise<Task | null>;
  create(input: CreateTask): Promise<Task>;
  /** Resolves `null` when no row matched — the route turns that into a 404. */
  update(id: string, patch: UpdateTask): Promise<Task | null>;
  /** `false` when no row matched. */
  remove(id: string): Promise<boolean>;
}

/** The one place a DB row becomes the JSON wire shape. */
function toTask(row: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    status: row.status as TaskStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Prisma "record not found" — thrown by update/delete on a missing row. */
function isRecordNotFound(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2025';
}

// ---------------------------------------------------------------------------
// Prisma / Postgres
// ---------------------------------------------------------------------------

export function createPrismaTaskRepository(): TaskRepository {
  const db = async () => (await import('../db/prisma')).prisma;

  return {
    async list({ status, limit }) {
      const prisma = await db();
      const where = status ? { status } : {};
      const [rows, total] = await Promise.all([
        prisma.task.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit }),
        prisma.task.count({ where }),
      ]);
      return { items: rows.map(toTask), total };
    },

    async findById(id) {
      const prisma = await db();
      const row = await prisma.task.findUnique({ where: { id } });
      return row ? toTask(row) : null;
    },

    async create(input) {
      const prisma = await db();
      const row = await prisma.task.create({
        data: {
          title: input.title,
          description: input.description ?? null,
          // `undefined` = "not provided", so the model default (`todo`) applies.
          status: input.status,
        },
      });
      return toTask(row);
    },

    async update(id, patch) {
      const prisma = await db();
      try {
        const row = await prisma.task.update({ where: { id }, data: patch });
        return toTask(row);
      } catch (err) {
        if (isRecordNotFound(err)) return null;
        throw err;
      }
    },

    async remove(id) {
      const prisma = await db();
      try {
        await prisma.task.delete({ where: { id } });
        return true;
      } catch (err) {
        if (isRecordNotFound(err)) return false;
        throw err;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Mongoose / Mongo
// ---------------------------------------------------------------------------

export function createMongooseTaskRepository(): TaskRepository {
  const model = async () => (await import('../../mongoose/models/Task')).Task;

  const fromDoc = (doc: {
    _id: unknown;
    title: string;
    description: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): Task =>
    toTask({
      id: String(doc._id),
      title: doc.title,
      description: doc.description,
      status: doc.status,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });

  return {
    async list({ status, limit }) {
      const Task = await model();
      const filter = status ? { status } : {};
      const [docs, total] = await Promise.all([
        Task.find(filter).sort({ createdAt: -1 }).limit(limit).exec(),
        Task.countDocuments(filter).exec(),
      ]);
      return { items: docs.map(fromDoc), total };
    },

    async findById(id) {
      const Task = await model();
      const doc = await Task.findById(id).exec();
      return doc ? fromDoc(doc) : null;
    },

    async create(input) {
      const Task = await model();
      const doc = await Task.create({
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? 'todo',
      });
      return fromDoc(doc);
    },

    async update(id, patch) {
      const Task = await model();
      const doc = await Task.findByIdAndUpdate(id, patch, {
        new: true,
        runValidators: true,
      }).exec();
      return doc ? fromDoc(doc) : null;
    },

    async remove(id) {
      const Task = await model();
      const doc = await Task.findByIdAndDelete(id).exec();
      return Boolean(doc);
    },
  };
}

// ---------------------------------------------------------------------------
// In-memory (SKIP_DB=1 dev mode + unit tests)
// ---------------------------------------------------------------------------

/**
 * Process-local store. Used when neither DATABASE_URL nor MONGO_URL is live —
 * i.e. `SKIP_DB=1 npm run dev`, so the client can be built against a real API
 * before the database container is up. Every write is lost on restart.
 */
export function createMemoryTaskRepository(seed: Task[] = []): TaskRepository {
  const rows = new Map<string, Task>(seed.map((t) => [t.id, t]));
  let counter = seed.length;

  const nextId = () => `mem_${++counter}_${Date.now().toString(36)}`;
  const sorted = () =>
    [...rows.values()].sort((a, b) =>
      a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0,
    );

  return {
    async list({ status, limit }) {
      const matching = sorted().filter((t) => (status ? t.status === status : true));
      return { items: matching.slice(0, limit), total: matching.length };
    },

    async findById(id) {
      return rows.get(id) ?? null;
    },

    async create(input) {
      const now = new Date().toISOString();
      const task: Task = {
        id: nextId(),
        title: input.title,
        description: input.description ?? null,
        // Mirrors the `@default(todo)` in the Prisma model / mongoose schema.
        status: input.status ?? 'todo',
        createdAt: now,
        updatedAt: now,
      };
      rows.set(task.id, task);
      return task;
    },

    async update(id, patch) {
      const existing = rows.get(id);
      if (!existing) return null;
      const next: Task = {
        ...existing,
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        updatedAt: new Date().toISOString(),
      };
      rows.set(id, next);
      return next;
    },

    async remove(id) {
      return rows.delete(id);
    },
  };
}

// ---------------------------------------------------------------------------
// Selector
// ---------------------------------------------------------------------------

let cached: TaskRepository | null = null;

/** Memoized — the branch is resolved once per process, not per request. */
export function getTaskRepository(): TaskRepository {
  if (!cached) {
    cached = isPostgres
      ? createPrismaTaskRepository()
      : isMongo
        ? createMongooseTaskRepository()
        : createMemoryTaskRepository();
  }
  return cached;
}

/** Test/dev hook — swap the active repository. Pass `null` to reset. */
export function setTaskRepository(repo: TaskRepository | null): void {
  cached = repo;
}
