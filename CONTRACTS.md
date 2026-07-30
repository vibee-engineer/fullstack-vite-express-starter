# API Contracts

> The agent updates this file BEFORE writing any backend code. Every new
> resource gets an entry here first, then routes/services/db, then the client
> hook. This keeps client + server + shared zod schemas in lockstep.

## Endpoints

<!-- METHOD path -> summary. Example:
- `GET /api/health` — liveness probe, returns `{ status: 'ok', timestamp }`
- `POST /api/users` — create user, body = `CreateUserSchema` (see shared/src/schemas.ts)
-->

- `GET /api/health` — liveness probe.

## Data Models

<!-- Name -> shape. Reference the zod schema in shared/src/schemas.ts as the
     source of truth; do not restate field types here — link to the schema. -->

- `User` — see `shared/src/schemas.ts#UserSchema`.

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
