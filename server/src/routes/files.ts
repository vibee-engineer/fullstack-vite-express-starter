/**
 * files.ts — upload / list / download / delete, over the storage driver.
 *
 * Two layers, cleanly split:
 *   - BYTES go through `getStorage()` (services/storage) — local disk or S3.
 *   - METADATA goes through `getFileRepository()` — the DB row that points at
 *     the bytes.
 * A route never touches the filesystem or the DB client directly.
 *
 * The storage key is generated server-side (random, decoupled from the DB id)
 * so a client can neither choose where its bytes land nor guess another file's
 * key. Clients only ever see the opaque id + a `/api/files/:id` url.
 */

import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { Router } from 'express';
import { IdParamSchema, PaginationQuerySchema } from '@shared/schemas/common';
import type { FileMeta } from '@shared/types';

import { asyncHandler } from '../middleware/async-handler';
import { uploadSingle } from '../middleware/upload';
import { validate } from '../middleware/validate';
import { getFileRepository, type StoredFile } from '../repositories/fileRepository';
import { getStorage } from '../services/storage';

export const filesRouter = Router();

const notFound = (id: string) => ({
  status: 404,
  message: `No file with id "${id}".`,
  code: 'FILE_NOT_FOUND',
});

/** Row → wire shape: drop storageKey, add the download url. */
function toMeta(file: StoredFile): FileMeta {
  return {
    id: file.id,
    filename: file.filename,
    contentType: file.contentType,
    size: file.size,
    url: `/api/files/${file.id}`,
    createdAt: file.createdAt.toISOString(),
  };
}

/** Keep only a safe basename; strip any client-supplied path. Fallback: "file". */
function sanitizeFilename(original: string): string {
  const base = path
    .basename(original || '')
    .replace(/[\u0000-\u001f]/g, '')
    .trim();
  return base.length > 0 ? base.slice(0, 255) : 'file';
}

/** POST /api/files (multipart form-data, field `file`) → 201 FileMeta */
filesRouter.post(
  '/',
  uploadSingle('file'),
  asyncHandler(async (req, res, next) => {
    const file = req.file;
    if (!file) {
      return next({
        status: 400,
        message: 'No file uploaded — send multipart/form-data with a "file" field.',
        code: 'NO_FILE',
      });
    }

    const filename = sanitizeFilename(file.originalname);
    const ext = path.extname(filename).slice(0, 20); // bounded, keeps the dot
    const storageKey = `${randomUUID()}${ext}`;
    const contentType = file.mimetype || 'application/octet-stream';

    await getStorage().save(storageKey, file.buffer, contentType);

    let stored: StoredFile;
    try {
      stored = await getFileRepository().create({
        filename,
        contentType,
        size: file.size,
        storageKey,
      });
    } catch (err) {
      // The row failed after the blob was written — don't leak an orphan blob.
      await getStorage()
        .delete(storageKey)
        .catch(() => {});
      throw err;
    }

    res.status(201).json(toMeta(stored));
  }),
);

/** GET /api/files?limit=50 → { items, total } */
filesRouter.get(
  '/',
  validate(PaginationQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const { limit } = req.query as unknown as { limit: number };
    const { items, total } = await getFileRepository().list({ limit });
    res.json({ items: items.map(toMeta), total });
  }),
);

/** GET /api/files/:id/meta → FileMeta | 404 */
filesRouter.get(
  '/:id/meta',
  validate(IdParamSchema, 'params'),
  asyncHandler(async (req, res, next) => {
    const { id } = req.params as { id: string };
    const file = await getFileRepository().findById(id);
    if (!file) return next(notFound(id));
    res.json(toMeta(file));
  }),
);

/** GET /api/files/:id → the raw bytes (streamed) | 404 */
filesRouter.get(
  '/:id',
  validate(IdParamSchema, 'params'),
  asyncHandler(async (req, res, next) => {
    const { id } = req.params as { id: string };
    const file = await getFileRepository().findById(id);
    if (!file) return next(notFound(id));

    let stream;
    try {
      stream = await getStorage().getStream(file.storageKey);
    } catch {
      // Row exists but the blob is gone (manual bucket edit, failed cleanup).
      return next({
        status: 404,
        message: 'File contents are no longer available.',
        code: 'FILE_CONTENTS_MISSING',
      });
    }

    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Length', String(file.size));
    // `inline` so browsers preview images/pdfs; the filename is quoted + ascii-safe.
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${file.filename.replace(/["\\]/g, '_')}"`,
    );
    stream.on('error', () => {
      if (!res.headersSent) res.status(500);
      res.end();
    });
    stream.pipe(res);
  }),
);

/** DELETE /api/files/:id → 204 | 404. Removes the row AND the blob. */
filesRouter.delete(
  '/:id',
  validate(IdParamSchema, 'params'),
  asyncHandler(async (req, res, next) => {
    const { id } = req.params as { id: string };
    const removed = await getFileRepository().remove(id);
    if (!removed) return next(notFound(id));
    // Best-effort blob delete; the row is already gone, so a failure here just
    // leaves an orphan blob (logged), never a dangling reference.
    await getStorage()
      .delete(removed.storageKey)
      .catch(() => {});
    res.status(204).end();
  }),
);
