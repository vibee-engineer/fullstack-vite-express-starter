# API Contracts

> The agent updates this file BEFORE writing any backend code. Every new
> resource gets an entry here first, then routes/services/db, then the client
> hook. This keeps client + server + shared zod schemas in lockstep.

## Endpoints

<!-- METHOD path -> summary. Example:
- `GET /api/health` — liveness probe, returns `{ status: 'ok', timestamp }`
- `POST /api/users` — create user, body = `CreateUserSchema` (see shared/src/schemas.ts)
-->

- `GET /api/health` — liveness probe, returns `{ status: 'ok', timestamp }`.
- `GET /api/tasks` — list tasks. Query = `TaskListQuerySchema` (`status?`, `limit` default 50, max 100). Returns `TaskListSchema` = `{ items, total }`.
- `GET /api/tasks/:id` — one task, or 404 `TASK_NOT_FOUND`.
- `POST /api/tasks` — create. Body = `CreateTaskSchema`. Returns 201 + `TaskSchema`.
- `PATCH /api/tasks/:id` — partial update. Body = `UpdateTaskSchema` (≥1 field). Returns `TaskSchema`, or 404 `TASK_NOT_FOUND`.
- `DELETE /api/tasks/:id` — 204 with no body, or 404 `TASK_NOT_FOUND`.

## Data Models

<!-- Name -> shape. Reference the zod schema in shared/src/schemas.ts as the
     source of truth; do not restate field types here — link to the schema. -->

- `User` — see `shared/src/schemas.ts#UserSchema`.
- `Task` — see `shared/src/schemas/task.ts#TaskSchema`. The reference resource;
  `status` is one of `todo | in_progress | done`.

## Mocked vs Live

<!-- Which endpoints return canned data (client-only demo state) vs. real DB
     reads. Update as endpoints move from mocked -> live. -->

- All endpoints are live from day one — no client-side mocks.

## Integration Contract Notes

<!-- Non-obvious behaviour: auth semantics, pagination shape, error shape,
     rate limits, side effects. Anything an integrator would file a bug about
     if it were undocumented. -->

- Errors follow `{ error: { message, code, details? } }`. `code` is a stable
  machine-readable string; `message` is human-readable.
- `code: 'VALIDATION'` is returned by the `validate()` middleware; `details`
  contains the zod `flatten()` payload.
- Per-resource 404s use a resource-specific code (`TASK_NOT_FOUND`), not the
  generic `NOT_FOUND` that unmatched `/api/*` routes return. Clients branch on
  `code`, never on `message`.
- List endpoints return an envelope (`{ items, total }`) rather than a bare
  array, so pagination metadata can be added without a breaking change.
- With `SKIP_DB=1` (dev only) every resource is served from an in-memory store.
  Reads and writes behave normally; nothing survives a restart.
