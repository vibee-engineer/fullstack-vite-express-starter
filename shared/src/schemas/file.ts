/**
 * shared/src/schemas/file.ts — file-upload wire contracts.
 *
 * The stored object's key (where it lives on disk / in the bucket) is an
 * internal detail and never crosses the wire — clients get an opaque `id` and a
 * `url` to download by. See server/src/services/storage + routes/files.ts.
 */

import { z } from 'zod';

/** Metadata for one uploaded file, as returned by the API. */
export const FileMetaSchema = z.object({
  id: z.string(),
  /** Original client filename, sanitized. */
  filename: z.string(),
  /** MIME type as detected/declared at upload. */
  contentType: z.string(),
  /** Size in bytes. */
  size: z.number().int().nonnegative(),
  /** Relative download URL, e.g. `/api/files/<id>`. */
  url: z.string(),
  createdAt: z.string(),
});

/** GET /api/files → list envelope. */
export const FileListSchema = z.object({
  items: z.array(FileMetaSchema),
  total: z.number().int().nonnegative(),
});
