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
- `POST /api/auth/register` — body `{ email, password, name? }`. 201 `{ user }` + session cookie; 409 if the email exists; 429 `RATE_LIMITED` after `AUTH_RATE_LIMIT` (default 10) failed attempts per IP in 15 min. The first account that can sign in is `owner`; every later sign-up is `staff` (the password-less seed profile does not count).
- `POST /api/auth/login` — body `{ email, password }`. 200 `{ user }` + session cookie, or 401; 429 `RATE_LIMITED` as for register (successful logins never count).
- `POST /api/auth/logout` — 204, always clears the cookie.
- `GET /api/auth/me` — 200 `{ user }` or 401. The client's "am I signed in?" probe.
- `GET /api/tasks` — list the caller's tasks plus shared (`ownerId: null`) ones. Query = `TaskListQuerySchema` (`status?`, `q?` case-insensitive search over title + description, `sort` = `createdAt | title` default `createdAt`, `dir` = `asc | desc` default `desc`, `limit` default 50, max 100, `cursor?`). Returns `TaskListSchema` = `{ items, total, nextCursor }`; pass `nextCursor` back as `?cursor=` for the next page (`null` on the last page).
- `GET /api/tasks/:id` — one task, or 404 `TASK_NOT_FOUND` (also for another user's task: never 403, so ids cannot be probed).
- `POST /api/tasks` — create. Body = `CreateTaskSchema`. Returns 201 + `TaskSchema`; `ownerId` is the signed-in user, or `null` when anonymous.
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
  `status` is one of `todo | in_progress | done`; `ownerId` is the creating
  user's id or `null` (visible to everyone). Deleting a user deletes their tasks.

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
- Ownership: every repository function takes the caller's scope first
  (`ownerScope(req)` from `server/src/middleware/scope.ts`), so a route cannot
  forget it. Rows outside the scope read as 404, and updates/deletes on them
  are no-ops that also 404.
- `429 RATE_LIMITED` responses carry the IETF `RateLimit` / `RateLimit-Policy`
  headers (draft-8). Client IPs come from `X-Forwarded-For` only through
  loopback/private proxies (`trust proxy`), so a forged header cannot reset a
  bucket.
- `409 SLOT_TAKEN` is what any route returns when Postgres rejects an
  overlapping booking (exclusion violation `23P01`); the error middleware maps
  it, so a double booking is never a 500. See `server/src/services/booking`.
- With `SKIP_DB=1` (dev only) every resource is served from an in-memory store.
  Reads and writes behave normally; nothing survives a restart.
