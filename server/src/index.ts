import { createApp } from './app';
import { env, isPostgres, isMongo } from './env';
import { logger } from './logger';

/**
 * Boot sequence:
 *   1. Validate env (side effect of importing env.ts).
 *   2. Connect DB (Prisma or Mongo, whichever is configured).
 *   3. app.listen().
 *   4. Wire graceful shutdown on SIGTERM/SIGINT.
 */
async function main() {
  if (isPostgres) {
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

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'shutdown signal received');
    server.close();
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
