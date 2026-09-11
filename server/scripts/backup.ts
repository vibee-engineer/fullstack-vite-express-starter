/**
 * backup.ts — create a Postgres backup now, then prune to BACKUP_RETENTION.
 *
 *   npm run backup -w server
 *
 * Reads DATABASE_URL + BACKUP_* from the environment and writes through the
 * configured storage driver (local disk or S3). Exits non-zero on failure so it
 * is safe to run from cron / CI.
 */

import { env } from '../src/env';
import { logger } from '../src/logger';
import { createBackup, listBackups, pruneBackups } from '../src/services/backups';

async function main(): Promise<void> {
  const info = await createBackup();
  logger.info({ key: info.key, size: info.size }, 'backup created');

  const pruned = await pruneBackups(env.BACKUP_RETENTION);
  if (pruned.length > 0) logger.info({ pruned }, 'old backups pruned');

  const remaining = await listBackups();
  logger.info({ count: remaining.length }, 'backups on record');
}

main().catch((err) => {
  logger.error({ err }, 'backup failed');
  process.exit(1);
});
