import type { RequestHandler } from 'express';

/**
 * authRequired — no-op placeholder. The agent replaces this with real auth
 * (session cookie, JWT verify, ...) when the brief demands it. Leaving it as
 * next() means routes annotated with `authRequired` compile and run today
 * without invisible security.
 */
export const authRequired: RequestHandler = (_req, _res, next) => next();
