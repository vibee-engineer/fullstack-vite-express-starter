#!/bin/sh
# Applies pending Prisma migrations, then hands off to the container CMD.
#
# Why this exists: `docker compose up` started Postgres and the API, but
# nothing ever created the schema. Every data endpoint returned
#   500 {"code":"P2021","message":"The table `public.Task` does not exist"}
# while the container reported "running" and /api/health returned 200 — so the
# starter looked healthy and was completely broken for its actual purpose.
# Booting a database and never migrating it is not a working stack.
#
# POSIX sh only — this runs under alpine's /bin/sh (busybox ash), which has no
# `set -o pipefail`, no `[[ ]]`, and no bashisms.
set -eu

# Mirror the SKIP_DB truthiness set in server/src/env.ts. Keep in sync: if the
# two disagree, we either migrate a database the app never reads, or skip a
# migration the app depends on.
skip_db=0
case "$(printf '%s' "${SKIP_DB:-}" | tr '[:upper:]' '[:lower:]')" in
  1 | true | yes | on) skip_db=1 ;;
esac

# env.ts hard-gates SKIP_DB on NODE_ENV !== production; do the same here so a
# stray SKIP_DB=1 in a prod environment cannot silently skip migrations.
if [ "${NODE_ENV:-development}" = "production" ]; then
  skip_db=0
fi

if [ "$skip_db" = "1" ]; then
  echo "[entrypoint] SKIP_DB set — in-memory repository, no migrations."
elif [ -n "${DATABASE_URL:-}" ]; then
  # `migrate deploy` (not `migrate dev`): non-interactive, applies only
  # committed migrations, never generates new ones or prompts to reset.
  echo "[entrypoint] Postgres detected — applying migrations..."
  npx prisma migrate deploy
  echo "[entrypoint] Migrations applied."
elif [ -n "${MONGO_URL:-}" ]; then
  # Mongoose builds collections and indexes on demand; there is no migration
  # step. Running `prisma migrate deploy` here would fail on a missing
  # datasource, so the Mongo overlay must land in this branch, not the one above.
  echo "[entrypoint] Mongo detected — no migration step required."
else
  # Do not exec the CMD: env.ts would exit(1) on this anyway, and failing here
  # produces a far clearer message than a zod fieldErrors dump.
  echo "[entrypoint] ERROR: neither DATABASE_URL nor MONGO_URL is set, and SKIP_DB is off." >&2
  echo "[entrypoint] Set one, or use SKIP_DB=1 for the in-memory dev path." >&2
  exit 78 # EX_CONFIG
fi

# Production (published app): run the prod server directly — no file watcher.
# The image's default CMD is the DEV command (`npm run dev` → tsx watch) for the
# live preview; in prod we exec `npm run start` (tsx straight from TS source, no
# build artifact needed). This is what makes a published fullstack app run in
# production mode instead of the dev watcher.
if [ "${NODE_ENV:-development}" = "production" ]; then
  echo "[entrypoint] NODE_ENV=production — starting the production server."
  exec npm run start
fi

exec "$@"
