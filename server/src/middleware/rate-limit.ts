/**
 * Brute-force protection for credential endpoints (express-rate-limit v8).
 *
 * - Counts FAILED attempts only (`skipSuccessfulRequests`): a real user who
 *   signs in repeatedly is never locked out; password guessing is.
 * - Keyed by client IP. The default key generator masks IPv6 to /56 (v8),
 *   so an attacker cannot rotate through a /64 for fresh buckets.
 * - Correct only with `app.set('trust proxy', TRUSTED_PROXIES)` (app.ts):
 *   behind nginx and Fly every request otherwise shares the proxy's IP, i.e.
 *   one bucket for everybody.
 * - Built once at module load, never inside a handler
 *   (ERR_ERL_CREATED_IN_REQUEST_HANDLER). One store per limiter.
 * - The memory store is per process. Behind more than one server instance,
 *   pass `store: new RedisStore(...)` from `rate-limit-redis`.
 *
 * Add it to any other endpoint that can be brute-forced (password reset,
 * invite codes, OTP checks): `router.post('/reset', authLimiter, ...)`.
 */

import { rateLimit } from 'express-rate-limit';

import { env } from '../env';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: env.AUTH_RATE_LIMIT,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, res, _next, options) => {
    res.status(options.statusCode).json({
      error: {
        message: 'Too many attempts. Wait a few minutes and try again.',
        code: 'RATE_LIMITED',
      },
    });
  },
});
