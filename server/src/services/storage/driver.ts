/**
 * driver.ts — the storage seam.
 *
 * Routes and the file repository depend ONLY on `StorageDriver`, so where bytes
 * physically live (local disk in dev, S3/R2 in prod) is a one-line env switch,
 * never a code change. Keys are opaque strings the caller owns (the starter
 * uses the file's id); a driver must round-trip whatever key it is given.
 */

import type { Readable } from 'node:stream';

export interface StorageDriver {
  /** Persist `body` under `key`, overwriting any existing object. */
  save(key: string, body: Buffer, contentType: string): Promise<void>;
  /** A readable stream of the object's bytes. Rejects if the key is absent. */
  getStream(key: string): Promise<Readable>;
  /** Whole-object read — convenient for small files and tests. */
  read(key: string): Promise<Buffer>;
  /** Remove the object. Idempotent: deleting a missing key is not an error. */
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /**
   * List keys under `prefix` (e.g. "backups/"). Returns full keys, unsorted.
   * An absent prefix yields an empty list, never an error. Used by the backups
   * service for retention; not needed for the upload flow.
   */
  list(prefix: string): Promise<string[]>;
}
