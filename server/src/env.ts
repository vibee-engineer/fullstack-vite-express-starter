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

    // ── File uploads (see server/src/services/storage) ──────────────────────
    /** Where the local-disk storage driver writes. Default `./uploads`. */
    UPLOAD_DIR: z.string().default('uploads'),
    /** `local` (default, disk) or `s3` (S3/R2/any S3-compatible bucket). */
    STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
    /** Max accepted upload size in bytes. Default 10 MB. */
    MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
    /** S3 driver config — required only when STORAGE_DRIVER=s3. */
    S3_BUCKET: z.string().optional(),
    S3_REGION: z.string().optional(),
    /** Custom endpoint for R2 / MinIO / Spaces. Omit for AWS S3. */
    S3_ENDPOINT: z.string().url().optional(),
    /** Public base URL for objects, if the bucket is served publicly. */
    S3_PUBLIC_URL: z.string().url().optional(),

    // ── Email (see server/src/services/email) ───────────────────────────────
    /** `log` (default, no-op that logs), `resend` (HTTP API), or `ses` (AWS). */
    EMAIL_DRIVER: z.enum(['log', 'resend', 'ses']).default('log'),
    /** Default From address, e.g. "App <hello@yourdomain.com>". */
    EMAIL_FROM: z.string().optional(),
    /** Required when EMAIL_DRIVER=resend. */
    RESEND_API_KEY: z.string().optional(),
    /** Required when EMAIL_DRIVER=ses. Needs @aws-sdk/client-sesv2 installed. */
    SES_REGION: z.string().optional(),

    // ── Backups (see server/src/services/backups) ───────────────────────────
    /** Storage-key prefix backups live under. Default `backups`. */
    BACKUP_PREFIX: z.string().default('backups'),
    /** How many recent backups to keep; older ones are pruned. Default 7. */
    BACKUP_RETENTION: z.coerce.number().int().positive().default(7),
    /** Local time "HH:MM" for the daily backup job. Unset = no scheduled backup. */
    BACKUP_DAILY_AT: z.string().optional(),
  })
  .refine((v) => skipDbRequested(v) || Boolean(v.DATABASE_URL || v.MONGO_URL), {
    message:
      'Either DATABASE_URL (Postgres) or MONGO_URL (Mongo) must be set. ' +
      'For local dev without a database, run `docker compose up -d db` or set SKIP_DB=1.',
    path: ['DATABASE_URL'],
  })
  .refine((v) => v.STORAGE_DRIVER !== 's3' || Boolean(v.S3_BUCKET && v.S3_REGION), {
    message: 'STORAGE_DRIVER=s3 requires S3_BUCKET and S3_REGION.',
    path: ['S3_BUCKET'],
  })
  .refine((v) => v.EMAIL_DRIVER !== 'resend' || Boolean(v.RESEND_API_KEY && v.EMAIL_FROM), {
    message: 'EMAIL_DRIVER=resend requires RESEND_API_KEY and EMAIL_FROM.',
    path: ['RESEND_API_KEY'],
  })
  .refine((v) => v.EMAIL_DRIVER !== 'ses' || Boolean(v.SES_REGION && v.EMAIL_FROM), {
    message: 'EMAIL_DRIVER=ses requires SES_REGION and EMAIL_FROM.',
    path: ['SES_REGION'],
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
