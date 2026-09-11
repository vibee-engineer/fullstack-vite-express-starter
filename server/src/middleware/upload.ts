/**
 * upload.ts — multer wiring for multipart file uploads.
 *
 * memoryStorage: the file arrives as a Buffer in `req.file.buffer`, which the
 * route hands straight to the storage driver. That keeps the driver the ONLY
 * thing that touches the filesystem/bucket (no temp files to clean up) and
 * works identically for the local-disk and S3 drivers.
 *
 * The size cap (env `MAX_UPLOAD_BYTES`) is enforced by multer itself, so an
 * oversized body is rejected mid-stream — the whole file is never buffered.
 * `uploadSingle` translates multer's own errors into the app's `{status,code}`
 * error shape.
 */

import multer, { MulterError } from 'multer';
import type { RequestHandler } from 'express';

import { env } from '../env';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_BYTES, files: 1 },
});

/**
 * Accept a single file under the given field (default `file`). On a multer
 * error (too large, too many parts, ...) forwards a clean app error instead of
 * multer's raw one.
 */
export function uploadSingle(field = 'file'): RequestHandler {
  const mw = upload.single(field);
  return (req, res, next) => {
    mw(req, res, (err: unknown) => {
      if (!err) return next();
      if (err instanceof MulterError) {
        const tooBig = err.code === 'LIMIT_FILE_SIZE';
        return next({
          status: tooBig ? 413 : 400,
          message: tooBig
            ? `File exceeds the ${env.MAX_UPLOAD_BYTES}-byte limit.`
            : `Upload rejected: ${err.message}.`,
          code: tooBig ? 'FILE_TOO_LARGE' : 'UPLOAD_REJECTED',
        });
      }
      return next(err);
    });
  };
}
