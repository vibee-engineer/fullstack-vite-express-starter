# API Contracts

> The agent updates this file BEFORE writing any backend code. Every new
> resource gets an entry here first, then routes/services/db, then the client
> hook. This keeps client + server + shared zod schemas in lockstep.

## Endpoints

<!-- METHOD path -> summary. Example:
- `GET /api/health` — liveness probe, returns `{ status: 'ok', timestamp }`
- `POST /api/users` — create user, body = `CreateUserSchema` (see shared/src/schemas.ts)
-->

- `GET /api/health` — liveness probe (process is up; does not check the database), returns `{ status: 'ok', timestamp }`.
- `POST /api/auth/register` — body `{ email, password, name? }`. 201 `{ user }` + session cookie; 409 if the email exists. The first account that can sign in is `owner`; every later sign-up is `staff` (the password-less seed profile does not count).
- `POST /api/auth/login` — body `{ email, password }`. 200 `{ user }` + session cookie, or 401.
- `POST /api/auth/logout` — 204, always clears the cookie.
- `GET /api/auth/me` — 200 `{ user }` or 401. The client's "am I signed in?" probe.
- `GET /api/tasks` — list tasks, newest first. Query = `TaskListQuerySchema` (`status?`, `limit` default 50, max 100, `cursor?`). Returns `TaskListSchema` = `{ items, total, nextCursor }`; pass `nextCursor` back as `?cursor=` for the next page (`null` on the last page).
- `GET /api/tasks/:id` — one task, or 404 `TASK_NOT_FOUND`.
- `POST /api/tasks` — create. Body = `CreateTaskSchema`. Returns 201 + `TaskSchema`.
- `PATCH /api/tasks/:id` — partial update. Body = `UpdateTaskSchema` (≥1 field). Returns `TaskSchema`, or 404 `TASK_NOT_FOUND`.
- `DELETE /api/tasks/:id` — 204 with no body, or 404 `TASK_NOT_FOUND`.
- `POST /api/files` — multipart form-data, field `file`. 201 `FileMeta`; 413 over `MAX_UPLOAD_BYTES`.
- `GET /api/files` — `{ items, total, nextCursor }` (`limit`, `cursor`).
- `GET /api/files/:id/meta` — `FileMeta`, or 404.
- `GET /api/files/:id` — the raw bytes. Images/PDF/text preview inline; HTML, SVG, XML and script types download as an attachment under a sandbox CSP.
- `DELETE /api/files/:id` — 204, removes the row and the blob, or 404.

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
