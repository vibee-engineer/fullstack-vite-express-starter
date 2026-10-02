import fs from 'node:fs';
import path from 'node:path';

import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 config. Prisma 7 removed the connection `url` from schema.prisma —
 * Migrate/introspection commands read it from here instead, and the runtime
 * PrismaClient takes a driver adapter (@prisma/adapter-pg), see src/db/prisma.ts.
 *
 * Why `datasource` is attached CONDITIONALLY (not `url: env('DATABASE_URL')`):
 * `prisma generate` loads this whole config file, but does NOT need a database
 * URL. Prisma's `env()` helper resolves eagerly and THROWS when the var is
 * unset (PrismaConfigEnvError), which breaks `prisma generate` in every no-DB
 * context — the `postinstall` hook and the Docker image build both run generate
 * with no DATABASE_URL, and would fail. So we only declare the datasource when
 * a URL is actually present. The commands that need it — `prisma migrate
 * deploy` (docker-entrypoint.sh) and `prisma migrate dev` (run in-container via
 * the run_db_migration tool) — always run with DATABASE_URL in the environment,
 * so the datasource is present exactly when required. Matches how prisma/seed.ts
 * reads process.env.DATABASE_URL directly.
 */
// Prisma 7 no longer reads .env itself, so `npm run prisma:migrate -w server`
// on a host failed with "datasource.url property is required" even with
// server/.env filled in. Load it only when the variable is not already set, so
// a real environment (compose, Fly, CI) always wins over the file.
if (!process.env.DATABASE_URL && fs.existsSync('.env')) process.loadEnvFile('.env');

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  migrations: { seed: 'tsx prisma/seed.ts' },
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
