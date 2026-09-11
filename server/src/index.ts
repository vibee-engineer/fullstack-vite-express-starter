import { createApp } from './app';
import { env, isPostgres, isMongo, skipDb } from './env';
import { registerJobs, runner, scheduler } from './services/jobs';
import { logger } from './logger';

/**
 * Boot sequence:
 *   1. Validate env (side effect of importing env.ts).
 *   2. Connect DB (Prisma or Mongo, whichever is configured) — unless SKIP_DB.
 *   3. app.listen().
 *   4. Register + start recurring jobs (no-op until any are registered).
 *   5. Wire graceful shutdown on SIGTERM/SIGINT.
 */
async function main() {
  if (skipDb) {
    logger.warn(
      'SKIP_DB is set — booting without a database. Routes fall back to the ' +
        'in-memory repository; every write is lost on restart. Never use this in production.',
    );
  } else if (isPostgres) {
    const { prisma } = await import('./db/prisma');
    await prisma.$connect();
    logger.info('postgres connected');
  } else if (isMongo) {
    const { connectMongo } = await import('./db/mongoose');
    await connectMongo();
  } else {
    logger.warn('no database configured — server will boot without persistence');
  }

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'server listening');
  });

  // Recurring jobs. Empty by default; see server/src/services/jobs.
  registerJobs();
  scheduler.start();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutdown signal received');
    server.close();
    // Stop firing new work and let in-flight background tasks finish (bounded).
    scheduler.stop();
    await Promise.race([runner.drain(), new Promise((r) => setTimeout(r, 5000))]);
    if (isPostgres) {
      const { prisma } = await import('./db/prisma');
      await prisma.$disconnect();
    }
    if (isMongo) {
      const { disconnectMongo } = await import('./db/mongoose');
      await disconnectMongo();
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.error({ err }, 'boot failed');
  process.exit(1);
});
