# fullstack-vite-express-starter

Founding.dev's fullstack starter. React + Vite on the client, Express + TypeScript on the server, Prisma/Postgres by default (Mongo opt-in), Docker Compose for orchestration, single-port nginx terminator on `:8888`.

> **Boots via founding.dev's fullstack tier — do not run this manually unless you are developing the starter itself.** The agent daemon scaffolds new projects from this repo and layers your brief on top; the `docker compose up` flow below exists so the template stays honest, not as an end-user workflow.

## Quickstart

```bash
docker compose up
```

Then open [http://localhost:8888](http://localhost:8888). Nginx routes `/` to the Vite dev server (`:5173`) and `/api/*` to Express (`:3001`). HMR is proxied through nginx via WebSocket upgrade.

Postgres runs on `:5432` inside the compose network. Persistence is a named volume (`db-data`); `docker compose down -v` wipes it.

## Stack

- **Client** — React 19, Vite 5, TypeScript, Tailwind v4, shadcn/Radix primitives (27 pre-installed), TanStack Query, React Router 7, react-hook-form + zod, axios, react-helmet-async.
- **Server** — Express 4, TypeScript, `tsx watch` for dev, Prisma (`@prisma/client`) + Postgres by default, Mongoose + Mongo as an opt-in variant, zod for env + request validation, pino for logs, helmet + cors baseline.
- **Shared** — `@app/shared` workspace with zod schemas + inferred TS types consumed by both sides.
- **Orchestration** — Docker Compose. `docker-compose.yml` for Postgres, `docker-compose.mongo.yml` overlay for Mongo, nginx as the single public port.

## Structure

See [SPEC.md](https://github.com/vibee-engineer/fullstack-vite-express-starter/blob/main/SPEC.md) — it's the canonical file-by-file breakdown. A quick tour:

```
client/   Vite + React app.  All UI primitives live in src/components/ui.
server/   Express app.        Routes → services → db.
shared/   zod schemas + types shared by client + server.
```

## Switching to MongoDB

The starter ships both DB stacks; pick one per project.

```bash
docker compose -f docker-compose.yml -f docker-compose.mongo.yml up
```

The overlay swaps the `db` service to `mongo:7`, unsets `DATABASE_URL`, and sets `MONGO_URL`. The server's `env.ts` picks whichever is present. Prisma-vs-Mongoose selection happens at import — leave the unused files in place; tree-shaking will drop them.

## Deploying

Deferred to the founding.dev docs. The compose file is Fly / Render / Railway compatible as-is; production overlay (`docker-compose.prod.yml`) with TLS termination ships in a follow-up.

## Development notes

- `npm run dev` at root fans out to `client` and `server` via `concurrently` — useful when hacking on the starter itself without docker.
- `npm run typecheck` runs `tsc --noEmit` across all three workspaces.
- `npm run format` runs prettier over the whole tree.
- API contracts are tracked in [CONTRACTS.md](./CONTRACTS.md). The agent updates that file before writing new endpoints.
