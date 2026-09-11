/**
 * restore.ts — restore a Postgres backup by key. DESTRUCTIVE.
 *
 *   npm run restore -w server -- <key>
 *   npm run restore -w server                # lists available keys, then exits
 *
 * `--clean --if-exists` means the target database is dropped-and-recreated to
 * match the dump, so guard this in production.
 */

import { logger } from '../src/logger';
import { listBackups, restoreBackup } from '../src/services/backups';

async function main(): Promise<void> {
  const key = process.argv[2];
  if (!key) {
    const keys = await listBackups();
    logger.info({ keys }, 'no key given — pass one of these to restore');
    process.stdout.write(
      keys.length ? `\nUsage: npm run restore -w server -- ${keys[0]}\n` : '\nNo backups found.\n',
    );
    return;
  }
  logger.warn({ key }, 'restoring backup — this OVERWRITES the current database');
  await restoreBackup(key);
  logger.info({ key }, 'restore complete');
}

main().catch((err) => {
  logger.error({ err }, 'restore failed');
  process.exit(1);
});
