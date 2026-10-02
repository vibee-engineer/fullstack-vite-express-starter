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
import { canSee, visibleTo, type OwnerScope } from '../middleware/scope';
import type { CreateTask, Task, TaskListQuery, TaskStatus, UpdateTask } from '@shared/types';

/**
 * Every method takes the caller's `OwnerScope` FIRST (see middleware/scope.ts):
 * a row outside the scope behaves exactly like a row that does not exist.
 */
export interface TaskRepository {
  /** Newest first. `total` is the count matching the filter, ignoring `limit`. */
  list(
    scope: OwnerScope,
    query: TaskListQuery,
  ): Promise<{ items: Task[]; total: number; nextCursor: string | null }>;
  findById(scope: OwnerScope, id: string): Promise<Task | null>;
  /** Created as the scope's owner (`null` = shared). */
  create(scope: OwnerScope, input: CreateTask): Promise<Task>;
  /** Resolves `null` when no visible row matched — the route turns that into a 404. */
  update(scope: OwnerScope, id: string, patch: UpdateTask): Promise<Task | null>;
  /** `false` when no visible row matched. */
  remove(scope: OwnerScope, id: string): Promise<boolean>;
}

/** The one place a DB row becomes the JSON wire shape. */
function toTask(row: {
  id: string;
  title: string;
  description: string | null;
  status: string;
  ownerId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? null,
    status: row.status as TaskStatus,
    ownerId: row.ownerId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Mongo ids are 24-hex ObjectIds; anything else makes mongoose throw a
 * CastError (a 500). Treat it as "no such row" so the route 404s.
 */
export const isObjectId = (id: string): boolean => /^[a-f0-9]{24}$/i.test(id);

// ---------------------------------------------------------------------------
// Prisma / Postgres
// ---------------------------------------------------------------------------

export function createPrismaTaskRepository(): TaskRepository {
  const db = async () => (await import('../db/prisma')).prisma;

  return {
    async list(scope, { status, q, sort = 'createdAt', dir = 'desc', limit, cursor }) {
      const prisma = await db();
      const where = {
        AND: [
          visibleTo(scope),
          status ? { status } : {},
          q
            ? {
                OR: [
                  { title: { contains: q, mode: 'insensitive' as const } },
                  { description: { contains: q, mode: 'insensitive' as const } },
                ],
              }
            : {},
        ],
      };
      const [rows, total] = await Promise.all([
        prisma.task.findMany({
          where,
          // `sort` is whitelisted by TaskListQuerySchema. id tiebreak: a stable
          // total order, so a cursor never skips or repeats rows.
          orderBy: [{ [sort]: dir }, { id: dir }],
          take: limit + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        }),
        prisma.task.count({ where }),
      ]);
      const page = rows.slice(0, limit);
      const nextCursor = rows.length > limit ? (page[page.length - 1]?.id ?? null) : null;
      return { items: page.map(toTask), total, nextCursor };
    },

    async findById(scope, id) {
      const prisma = await db();
      const row = await prisma.task.findFirst({ where: { id, ...visibleTo(scope) } });
      return row ? toTask(row) : null;
    },

    async create(scope, input) {
      const prisma = await db();
      const row = await prisma.task.create({
        data: {
          ownerId: scope.ownerId,
          title: input.title,
          description: input.description ?? null,
          // `undefined` = "not provided", so the model default (`todo`) applies.
          status: input.status,
        },
      });
      return toTask(row);
    },

    async update(scope, id, patch) {
      const prisma = await db();
      // updateMany so the ownership filter is part of the WRITE itself: there
      // is no read-then-write window, and another owner's id matches 0 rows.
      const { count } = await prisma.task.updateMany({
        where: { id, ...visibleTo(scope) },
        data: patch,
      });
      if (count === 0) return null;
      const row = await prisma.task.findUnique({ where: { id } });
      return row ? toTask(row) : null;
    },

    async remove(scope, id) {
      const prisma = await db();
      const { count } = await prisma.task.deleteMany({ where: { id, ...visibleTo(scope) } });
      return count > 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Mongoose / Mongo
// ---------------------------------------------------------------------------

/** Mongo form of `visibleTo`. */
const mongoVisible = (scope: OwnerScope) =>
  scope.ownerId ? { ownerId: { $in: [scope.ownerId, null] } } : { ownerId: null };

export function createMongooseTaskRepository(): TaskRepository {
  const model = async () => (await import('../../mongoose/models/Task')).Task;

  const fromDoc = (doc: {
    _id: unknown;
    title: string;
    description: string | null;
    status: string;
    ownerId?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): Task =>
    toTask({
      id: String(doc._id),
      title: doc.title,
      description: doc.description,
      status: doc.status,
      ownerId: doc.ownerId ?? null,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });

  return {
    async list(scope, { status, q, sort = 'createdAt', dir = 'desc', limit, cursor }) {
      const Task = await model();
      const and: Record<string, unknown>[] = [mongoVisible(scope)];
      if (status) and.push({ status });
      if (q) {
        // Escape: the search box must never become a user-controlled regex.
        const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        and.push({ $or: [{ title: re }, { description: re }] });
      }
      const filter = { $and: and };
      const step = dir === 'asc' ? '$gt' : '$lt';
      const pageAnd = [...and];
      if (cursor) {
        const at = isObjectId(cursor) ? await Task.findById(cursor).exec() : null;
        if (at) {
          const v = (at as unknown as Record<string, unknown>)[sort];
          pageAnd.push({
            $or: [{ [sort]: { [step]: v } }, { [sort]: v, _id: { [step]: at._id } }],
          });
        }
      }
      const order = dir === 'asc' ? 1 : -1;
      const [docs, total] = await Promise.all([
        Task.find({ $and: pageAnd })
          .sort({ [sort]: order, _id: order })
          .limit(limit + 1)
          .exec(),
        Task.countDocuments(filter).exec(),
      ]);
      const page = docs.slice(0, limit);
      const nextCursor = docs.length > limit ? String(page[page.length - 1]?._id) : null;
      return { items: page.map(fromDoc), total, nextCursor };
    },

    async findById(scope, id) {
      if (!isObjectId(id)) return null;
      const Task = await model();
      const doc = await Task.findOne({ _id: id, ...mongoVisible(scope) }).exec();
      return doc ? fromDoc(doc) : null;
    },

    async create(scope, input) {
      const Task = await model();
      const doc = await Task.create({
        ownerId: scope.ownerId,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? 'todo',
      });
      return fromDoc(doc);
    },

    async update(scope, id, patch) {
      if (!isObjectId(id)) return null;
      const Task = await model();
      const doc = await Task.findOneAndUpdate({ _id: id, ...mongoVisible(scope) }, patch, {
        new: true,
        runValidators: true,
      }).exec();
      return doc ? fromDoc(doc) : null;
    },

    async remove(scope, id) {
      if (!isObjectId(id)) return false;
      const Task = await model();
      const doc = await Task.findOneAndDelete({ _id: id, ...mongoVisible(scope) }).exec();
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
  return {
    async list(scope, { status, q, sort = 'createdAt', dir = 'desc', limit, cursor }) {
      const needle = q?.toLowerCase();
      const sign = dir === 'asc' ? 1 : -1;
      const matching = [...rows.values()]
        .filter(
          (t) =>
            canSee(scope, t) &&
            (status ? t.status === status : true) &&
            (needle ? `${t.title}\n${t.description ?? ''}`.toLowerCase().includes(needle) : true),
        )
        .sort((a, b) => {
          const x = String(a[sort]);
          const y = String(b[sort]);
          const primary = sort === 'title' ? x.localeCompare(y) : x < y ? -1 : x > y ? 1 : 0;
          return sign * (primary || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
        });
      const start = cursor ? matching.findIndex((t) => t.id === cursor) + 1 : 0;
      const items = matching.slice(start, start + limit);
      const nextCursor =
        start + limit < matching.length ? (items[items.length - 1]?.id ?? null) : null;
      return { items, total: matching.length, nextCursor };
    },

    async findById(scope, id) {
      const row = rows.get(id);
      return row && canSee(scope, row) ? row : null;
    },

    async create(scope, input) {
      const now = new Date().toISOString();
      const task: Task = {
        id: nextId(),
        ownerId: scope.ownerId,
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

    async update(scope, id, patch) {
      const existing = rows.get(id);
      if (!existing || !canSee(scope, existing)) return null;
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

    async remove(scope, id) {
      const existing = rows.get(id);
      if (!existing || !canSee(scope, existing)) return false;
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
