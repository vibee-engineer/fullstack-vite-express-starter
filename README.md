# fullstack-vite-express-starter

Founding.dev's fullstack starter. React + Vite on the client, Express + TypeScript on the server, Prisma/Postgres by default (Mongo opt-in), Docker Compose for orchestration, single-port nginx terminator on `:8888`.

> **Boots via founding.dev's fullstack tier — do not run this manually unless you are developing the starter itself.** The agent daemon scaffolds new projects from this repo and layers your brief on top; the `docker compose up` flow below exists so the template stays honest, not as an end-user workflow.

## Quickstart

```bash
docker compose up
```

Then open [http://localhost:8888](http://localhost:8888). Nginx routes `/` to the Vite dev server (`:5173`) and `/api/*` to Express (`:3001`). HMR is proxied through nginx via WebSocket upgrade.

Postgres runs on `:5432` inside the compose network. Persistence is a named volume (`db-data`); `docker compose down -v` wipes it.

## Local dev without Docker

`npm run dev` at root fans out to `client` and `server` via `concurrently`. The server needs a database, so do **one** of these first — otherwise it exits on boot with an env error:

```bash
# A. Real Postgres (recommended — migrations and seeds work)
docker compose up -d db
npm run prisma:migrate -w server   # apply server/prisma/migrations
npm run db:seed -w server          # 1 user + 3 example tasks
npm run dev

# B. No database at all (fastest — client work only)
SKIP_DB=1 npm run dev
```

`SKIP_DB=1` swaps every repository for an in-memory store, so `/api/tasks` is fully functional but every write is lost on restart. It is **ignored when `NODE_ENV=production`** — a prod boot with no `DATABASE_URL`/`MONGO_URL` still fails fast, by design. See `server/src/env.ts` (`skipDb`) and `server/.env.example`.

## Stack

- **Client** — React 19, Vite 5, TypeScript, Tailwind v4, shadcn/Radix primitives (27 pre-installed), TanStack Query, React Router 7, react-hook-form + zod, axios, react-helmet-async.
- **Server** — Express 4, TypeScript, `tsx watch` for dev, Prisma (`@prisma/client`) + Postgres by default, Mongoose + Mongo as an opt-in variant, zod for env + request validation, pino for logs, helmet + cors baseline.
- **Shared** — `@app/shared` workspace with zod schemas + inferred TS types consumed by both sides.
- **Orchestration** — Docker Compose. `docker-compose.yml` for Postgres, `docker-compose.mongo.yml` overlay for Mongo, nginx as the single public port.

## Structure

See [SPEC.md](https://github.com/vibee-engineer/fullstack-vite-express-starter/blob/main/SPEC.md) — it's the canonical file-by-file breakdown. A quick tour:

```
client/   Vite + React app.  All UI primitives live in src/components/ui.
server/   Express app.        Routes → repositories → db.
shared/   zod schemas + types shared by client + server.
```

## The reference pattern — copy this shape for every new resource

The starter ships **one** complete vertical feature, `Task`. It exists to be pattern-matched, not to be kept: nothing else depends on it, so delete it once you have real resources. Every file below is the canonical shape for its layer.

| Layer             | File                                                                                         | What it establishes                                                                                                                                                                                                                        |
| ----------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1. Contract       | `shared/src/schemas/task.ts`                                                                 | Three zod variants per resource — `CreateXSchema` (POST body), `UpdateXSchema` (PATCH, partial but never empty), `XSchema` (response). Dates are ISO strings, not `Date`. Types are inferred in `shared/src/types.ts`.                     |
| 2. Model          | `server/prisma/schema.prisma` + `server/prisma/migrations/`                                  | Postgres model, enum, and a real checked-in migration. `npm run prisma:migrate -w server` after editing.                                                                                                                                   |
| 2b. Model (Mongo) | `server/mongoose/models/Task.ts`                                                             | The parallel Mongoose model, field-for-field identical. Indexes mirror the Prisma ones.                                                                                                                                                    |
| 3. Persistence    | `server/src/repositories/taskRepository.ts`                                                  | **The only file that knows which DB is live.** Branches on `isPostgres` / `isMongo` from `env.ts`, plus an in-memory backend for `SKIP_DB=1`. DB clients are loaded with dynamic `import()` so a Postgres project never pulls in mongoose. |
| 4. Transport      | `server/src/routes/tasks.ts`                                                                 | Full CRUD. `validate(schema, source)` in front of every input, `asyncHandler` around every handler, `next({ status, message, code })` for errors. Mounted in `server/src/routes/index.ts` — one line per resource.                         |
| 5. Client data    | `client/src/api/tasks.ts`                                                                    | A `taskKeys` query-key factory (never inline keys), thin typed transport functions, then `useTasks` / `useTask` / `useCreateTask` / `useUpdateTask` / `useDeleteTask`. Every mutation invalidates `taskKeys.all` and toasts `err.message`. |
| 6. UI             | `client/src/pages/TasksPage.tsx`                                                             | List + create form + inline edit + delete, and **all four list states**: loading skeletons, error alert with retry, empty state, loaded. A list view that renders only the loaded state is treated as incomplete.                          |
| 7. Wiring         | `client/src/App.tsx`, `client/src/config/site.ts`                                            | Route registered in the router; nav + footer links come from `site.ts`, never from the layout components.                                                                                                                                  |
| 8. Tests          | `server/src/routes/__tests__/tasks.test.ts`, `client/src/pages/__tests__/TasksPage.test.tsx` | Supertest against the real Express app with a mocked repository; @testing-library/react against the real hooks with a mocked axios instance. Mock the outermost seam, not the thing you are testing.                                       |
| 9. Seed           | `server/prisma/seed.ts`                                                                      | Idempotent `upsert` per row so re-runs are safe.                                                                                                                                                                                           |

Order matters: write the schema first, then the model + migration, then the repository, then the routes, then the client. Update [CONTRACTS.md](./CONTRACTS.md) before the backend code.

## Testing

```bash
npm test              # server (vitest + supertest) then client (vitest + jsdom)
npm run test:watch    # both in watch mode
```

Neither suite needs Docker, a database, or a network. The server suite runs with `SKIP_DB=1` and mocks the repository; the client suite mocks `@/api/client`. Both run in CI (`.github/workflows/ci.yml`) alongside `typecheck`, `prettier --check`, and `docker compose config`.

## Switching to MongoDB

The starter ships both DB stacks; pick one per project.

```bash
docker compose -f docker-compose.yml -f docker-compose.mongo.yml up
```

The overlay swaps the `db` service to `mongo:7`, unsets `DATABASE_URL`, and sets `MONGO_URL`. The server's `env.ts` picks whichever is present. Prisma-vs-Mongoose selection happens at import — leave the unused files in place; tree-shaking will drop them.

## Deploying

Deferred to the founding.dev docs. The compose file is Fly / Render / Railway compatible as-is; production overlay (`docker-compose.prod.yml`) with TLS termination ships in a follow-up.

## Development notes

- `npm run dev` at root fans out to `client` and `server` via `concurrently` — see "Local dev without Docker" above for the database prerequisite.
- `npm run typecheck` runs `tsc --noEmit` across all three workspaces. The server's `mongoose/` directory is included, so the Mongo variant is typechecked even in a Postgres project.
- `npm run format` runs prettier over the whole tree; `npm run lint` is the `--check` half of it.
- The server runs from TypeScript source via `tsx` in **both** dev and prod (`npm start -w server`), so `npm run build -w server` is a typecheck, not an emit. This is deliberate: `tsc` does not rewrite path aliases, so an emitted `dist/` would ship unresolvable `@shared/*` specifiers. One code path, no build-only failure mode.
- API contracts are tracked in [CONTRACTS.md](./CONTRACTS.md). The agent updates that file before writing new endpoints.

## Known issues

Two open advisories both require a **breaking major bump** and are deliberately left in place rather than silently upgraded. `npm audit fix` (non-breaking) has already been applied; CI reports `npm audit --audit-level=high` non-blocking so a new high never lands unnoticed.

| Advisory                                                                                             | Package                                               | Fix requires                                                                                       | Impact here                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2) (high)                      | `react-router` 7.12.0–8.2.0, via `react-router-dom@7` | `react-router@8.3+`, which drops the `react-router-dom` package entirely — a full router migration | Affects **RSC mode** action handling. This starter is a Vite SPA with `createBrowserRouter` and no RSC, so the vulnerable code path is not reachable.                                            |
| [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) and related (moderate/high) | `esbuild` / `vite` ≤6.4.2                             | `vite@7+`, a breaking bump for the whole client toolchain                                          | All are **dev-server** issues (request reflection, `server.fs.deny` bypass on Windows paths). Never exposed in a production build; only reachable if you expose `:5173` to an untrusted network. |

Bump both when you next take a toolchain upgrade — `vite@7` first, then the router migration.
