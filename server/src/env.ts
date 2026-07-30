/**
 * env.ts — zod-validated environment. Import `env` anywhere; if `process.env`
 * is malformed at boot, the app fails fast with a readable error instead
 * of a mystery undefined-crash 30 seconds later.
 */
import { z } from 'zod';

/** `SKIP_DB` is a string in the environment; treat only these as "on". */
const truthy = new Set(['1', 'true', 'yes', 'on']);

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().optional(),
    MONGO_URL: z.string().optional(),
    ALLOWED_ORIGIN: z.string().url().default('http://localhost:8888'),
    /**
     * Dev-only escape hatch. `SKIP_DB=1 npm run dev` boots the API with an
     * in-memory repository so you can work on the client before Postgres or
     * Mongo is up. IGNORED when NODE_ENV=production — see `skipDb` below.
     */
    SKIP_DB: z.string().optional(),
  })
  .refine((v) => skipDbRequested(v) || Boolean(v.DATABASE_URL || v.MONGO_URL), {
    message:
      'Either DATABASE_URL (Postgres) or MONGO_URL (Mongo) must be set. ' +
      'For local dev without a database, run `docker compose up -d db` or set SKIP_DB=1.',
    path: ['DATABASE_URL'],
  });

function skipDbRequested(v: { NODE_ENV?: string; SKIP_DB?: string }): boolean {
  return truthy.has(String(v.SKIP_DB ?? '').toLowerCase()) && v.NODE_ENV !== 'production';
}

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

/**
 * True when the DB connection is being deliberately skipped.
 *
 * Production NEVER honors SKIP_DB: a prod deploy that silently ran on an
 * in-memory store would lose every write, so the flag is hard-gated on
 * `NODE_ENV !== 'production'` and a prod boot without a connection string
 * still fails the refine above.
 */
export const skipDb = skipDbRequested(env);

/** True when Postgres (Prisma) is the active DB. */
export const isPostgres = !skipDb && Boolean(env.DATABASE_URL);
/** True when Mongo (Mongoose) is the active DB. */
export const isMongo = !skipDb && !isPostgres && Boolean(env.MONGO_URL);
