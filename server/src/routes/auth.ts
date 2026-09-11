/**
 * auth.ts — register / login / logout / me.
 *
 * Same four rules as tasks.ts (validate → asyncHandler → repository/service →
 * `next({status,...})` errors). The one addition is the session cookie: writes
 * happen only here and in middleware/auth.ts, never in the service.
 *
 * Opt-in: mounted in routes/index.ts, but an app that doesn't need login simply
 * doesn't call these endpoints — the User/Session tables sit unused.
 */

import { Router } from 'express';
import { LoginSchema, RegisterSchema } from '@shared/schemas/auth';
import type { Login, Register } from '@shared/types';

import { asyncHandler } from '../middleware/async-handler';
import {
  authRequired,
  clearSessionCookie,
  readSessionCookie,
  setSessionCookie,
} from '../middleware/auth';
import { validate } from '../middleware/validate';
import { EmailTakenError, login, logout, register } from '../services/auth';

export const authRouter = Router();

/** POST /api/auth/register → 201 { user } + session cookie */
authRouter.post(
  '/register',
  validate(RegisterSchema),
  asyncHandler(async (req, res, next) => {
    try {
      const result = await register(req.body as Register);
      setSessionCookie(res, result.token);
      res.status(201).json({ user: result.user });
    } catch (err) {
      if (err instanceof EmailTakenError) {
        return next({
          status: 409,
          message: 'An account with that email already exists.',
          code: 'EMAIL_TAKEN',
        });
      }
      throw err;
    }
  }),
);

/** POST /api/auth/login → 200 { user } + session cookie | 401 */
authRouter.post(
  '/login',
  validate(LoginSchema),
  asyncHandler(async (req, res, next) => {
    const result = await login(req.body as Login);
    if (!result) {
      return next({
        status: 401,
        message: 'Incorrect email or password.',
        code: 'INVALID_CREDENTIALS',
      });
    }
    setSessionCookie(res, result.token);
    res.json({ user: result.user });
  }),
);

/** POST /api/auth/logout → 204. Idempotent — always clears the cookie. */
authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    const token = readSessionCookie(req.headers.cookie);
    if (token) await logout(token);
    clearSessionCookie(res);
    res.status(204).end();
  }),
);

/** GET /api/auth/me → 200 { user } | 401. The client's "am I logged in?" probe. */
authRouter.get(
  '/me',
  authRequired,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user });
  }),
);
