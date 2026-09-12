import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

import { env } from '../env';

/**
 * PrismaClient singleton. tsx-watch re-imports modules on file change; the
 * globalThis guard prevents leaking a fresh connection pool every reload.
 *
 * Prisma 7: the client connects through a driver adapter (@prisma/adapter-pg)
 * instead of a `url` in schema.prisma. The adapter owns the pg connection pool;
 * DATABASE_URL is validated in ../env.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
