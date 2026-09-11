/**
 * storage — pick a driver from env and hand routes a uniform StorageDriver.
 *
 *   STORAGE_DRIVER=local  → LocalDiskDriver (default; writes under UPLOAD_DIR)
 *   STORAGE_DRIVER=s3     → S3Driver (S3/R2/MinIO; SDK loaded lazily)
 *
 * Routes never import a concrete driver — they call `getStorage()`. See
 * routes/files.ts and services/storage/driver.ts.
 */

import { env } from '../../env';
import type { StorageDriver } from './driver';
import { LocalDiskDriver } from './localDisk';
import { S3Driver } from './s3';

export * from './driver';
export { LocalDiskDriver } from './localDisk';
export { S3Driver } from './s3';

let cached: StorageDriver | null = null;

/** Memoized driver selected by env. */
export function getStorage(): StorageDriver {
  if (!cached) {
    cached =
      env.STORAGE_DRIVER === 's3'
        ? new S3Driver({
            // Presence is guaranteed by the env refine when STORAGE_DRIVER=s3.
            bucket: env.S3_BUCKET as string,
            region: env.S3_REGION as string,
            endpoint: env.S3_ENDPOINT,
          })
        : new LocalDiskDriver(env.UPLOAD_DIR);
  }
  return cached;
}

/** Test/dev hook — swap the active driver. Pass `null` to reset. */
export function setStorage(driver: StorageDriver | null): void {
  cached = driver;
}
