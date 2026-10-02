/**
 * fileRepository.ts — metadata for uploaded files, mirroring taskRepository.
 *
 * The BYTES live in the storage driver (services/storage); this repository
 * stores only the row that points at them: filename, content type, size, and
 * the opaque `storageKey`. Routes read/write through this interface, so the
 * same upload flow runs on Postgres, Mongo, or the in-memory store.
 *
 * `storageKey` is internal — the route maps a `StoredFile` to the `FileMeta`
 * wire type (dropping the key, adding the download url) before responding.
 */

import { isMongo, isPostgres } from '../env';
import { isObjectId } from './taskRepository';

/** A file row including the internal storage key. */
export interface StoredFile {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  storageKey: string;
  createdAt: Date;
}

export interface NewFile {
  filename: string;
  contentType: string;
  size: number;
  storageKey: string;
}

export interface FileRepository {
  create(input: NewFile): Promise<StoredFile>;
  findById(id: string): Promise<StoredFile | null>;
  /** Newest first. `total` ignores `limit`. */
  list(query: {
    limit: number;
    cursor?: string;
  }): Promise<{ items: StoredFile[]; total: number; nextCursor: string | null }>;
  /** Deletes the row and returns it (so the caller can delete the blob), or null. */
  remove(id: string): Promise<StoredFile | null>;
}

// ---------------------------------------------------------------------------
// Prisma / Postgres
// ---------------------------------------------------------------------------

export function createPrismaFileRepository(): FileRepository {
  const db = async () => (await import('../db/prisma')).prisma;

  const toFile = (row: {
    id: string;
    filename: string;
    contentType: string;
    size: number;
    storageKey: string;
    createdAt: Date;
  }): StoredFile => ({ ...row });

  return {
    async create(input) {
      const prisma = await db();
      const row = await prisma.file.create({ data: input });
      return toFile(row);
    },

    async findById(id) {
      const prisma = await db();
      const row = await prisma.file.findUnique({ where: { id } });
      return row ? toFile(row) : null;
    },

    async list({ limit, cursor }) {
      const prisma = await db();
      const [rows, total] = await Promise.all([
        prisma.file.findMany({
          // id tiebreak: a stable total order, so a cursor never skips/repeats.
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit + 1,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        }),
        prisma.file.count(),
      ]);
      const page = rows.slice(0, limit);
      const nextCursor = rows.length > limit ? (page[page.length - 1]?.id ?? null) : null;
      return { items: page.map(toFile), total, nextCursor };
    },

    async remove(id) {
      const prisma = await db();
      try {
        const row = await prisma.file.delete({ where: { id } });
        return toFile(row);
      } catch (err) {
        if (
          typeof err === 'object' &&
          err !== null &&
          (err as { code?: string }).code === 'P2025'
        ) {
          return null;
        }
        throw err;
      }
    },
  };
}

// ---------------------------------------------------------------------------
// Mongoose / Mongo
// ---------------------------------------------------------------------------

export function createMongooseFileRepository(): FileRepository {
  const model = async () => (await import('../../mongoose/models/File')).File;

  const fromDoc = (doc: {
    _id: unknown;
    filename: string;
    contentType: string;
    size: number;
    storageKey: string;
    createdAt: Date;
  }): StoredFile => ({
    id: String(doc._id),
    filename: doc.filename,
    contentType: doc.contentType,
    size: doc.size,
    storageKey: doc.storageKey,
    createdAt: doc.createdAt,
  });

  return {
    async create(input) {
      const File = await model();
      const doc = await File.create(input);
      return fromDoc(doc);
    },

    async findById(id) {
      if (!isObjectId(id)) return null;
      const File = await model();
      const doc = await File.findById(id).exec();
      return doc ? fromDoc(doc) : null;
    },

    async list({ limit, cursor }) {
      const File = await model();
      const pageFilter: Record<string, unknown> = {};
      if (cursor) {
        const at = isObjectId(cursor) ? await File.findById(cursor).exec() : null;
        if (at) {
          pageFilter.$or = [
            { createdAt: { $lt: at.createdAt } },
            { createdAt: at.createdAt, _id: { $lt: at._id } },
          ];
        }
      }
      const [docs, total] = await Promise.all([
        File.find(pageFilter)
          .sort({ createdAt: -1, _id: -1 })
          .limit(limit + 1)
          .exec(),
        File.countDocuments().exec(),
      ]);
      const page = docs.slice(0, limit);
      const nextCursor = docs.length > limit ? String(page[page.length - 1]?._id) : null;
      return { items: page.map(fromDoc), total, nextCursor };
    },

    async remove(id) {
      if (!isObjectId(id)) return null;
      const File = await model();
      const doc = await File.findByIdAndDelete(id).exec();
      return doc ? fromDoc(doc) : null;
    },
  };
}

// ---------------------------------------------------------------------------
// In-memory (SKIP_DB=1 dev mode + unit tests)
// ---------------------------------------------------------------------------

export function createMemoryFileRepository(): FileRepository {
  const rows = new Map<string, StoredFile>();
  let counter = 0;
  const nextId = () => `mem_file_${++counter}_${Date.now().toString(36)}`;

  return {
    async create(input) {
      const file: StoredFile = { id: nextId(), createdAt: new Date(), ...input };
      rows.set(file.id, file);
      return file;
    },

    async findById(id) {
      return rows.get(id) ?? null;
    },

    async list({ limit, cursor }) {
      const sorted = [...rows.values()].sort(
        (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1),
      );
      const start = cursor ? sorted.findIndex((f) => f.id === cursor) + 1 : 0;
      const page = sorted.slice(start, start + limit);
      const nextCursor = start + limit < sorted.length ? (page[page.length - 1]?.id ?? null) : null;
      return { items: page, total: sorted.length, nextCursor };
    },

    async remove(id) {
      const row = rows.get(id) ?? null;
      if (row) rows.delete(id);
      return row;
    },
  };
}

// ---------------------------------------------------------------------------
// Selector
// ---------------------------------------------------------------------------

let cached: FileRepository | null = null;

export function getFileRepository(): FileRepository {
  if (!cached) {
    cached = isPostgres
      ? createPrismaFileRepository()
      : isMongo
        ? createMongooseFileRepository()
        : createMemoryFileRepository();
  }
  return cached;
}

/** Test/dev hook — swap the active repository. Pass `null` to reset. */
export function setFileRepository(repo: FileRepository | null): void {
  cached = repo;
}
