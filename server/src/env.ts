/**
 * env.ts — zod-validated environment. Import `env` anywhere; if `process.env`
 * is malformed at boot, the app fails fast with a readable error instead
 * of a mystery undefined-crash 30 seconds later.
 */
import { z } from 'zod';

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().optional(),
    MONGO_URL: z.string().optional(),
    ALLOWED_ORIGIN: z.string().url().default('http://localhost:8888'),
  })
  .refine((v) => Boolean(v.DATABASE_URL || v.MONGO_URL), {
    message: 'Either DATABASE_URL (Postgres) or MONGO_URL (Mongo) must be set.',
    path: ['DATABASE_URL'],
  });

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;

/** True when Postgres (Prisma) is the active DB. */
export const isPostgres = Boolean(env.DATABASE_URL);
/** True when Mongo (Mongoose) is the active DB. */
export const isMongo = !isPostgres && Boolean(env.MONGO_URL);
