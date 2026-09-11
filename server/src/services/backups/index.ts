/**
 * backups — Postgres dump/restore + a schedulable daily backup.
 *
 * ── How the agent should use this ──────────────────────────────────────────
 * • Manual, from the CLI:  npm run backup -w server     (create + prune)
 *                          npm run restore -w server <key>
 * • Scheduled: set BACKUP_DAILY_AT="03:00" and the boot sequence registers a
 *   daily job (createBackup → pruneBackups to BACKUP_RETENTION) on the same
 *   in-process scheduler as the rest of the app.
 *
 * Backups are written through the storage driver — point STORAGE_DRIVER at S3/R2
 * to get them offsite. See ./pgBackup.ts.
 */

import { env } from '../../env';
import type { Scheduler } from '../jobs/scheduler';
import { createBackup, listBackups, pruneBackups, restoreBackup } from './pgBackup';

export * from './pgBackup';

/**
 * Register the daily backup job if BACKUP_DAILY_AT is set. Called from boot
 * (server/src/index.ts) before `scheduler.start()`. A no-op when unset, so
 * backups stay opt-in.
 */
export function registerBackupJob(scheduler: Scheduler): void {
  if (!env.BACKUP_DAILY_AT) return;
  scheduler.register({
    name: 'postgres-backup',
    dailyAt: env.BACKUP_DAILY_AT,
    handler: async () => {
      await createBackup();
      await pruneBackups(env.BACKUP_RETENTION);
    },
  });
}

export { createBackup, restoreBackup, listBackups, pruneBackups };
