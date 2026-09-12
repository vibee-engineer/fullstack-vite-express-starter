/**
 * auth middleware — turns the session cookie into `req.user`.
 *
 * Zero cookie-parser dependency: the starter reads the one cookie it cares
 * about by hand (see `readSessionCookie`). Wiring is opt-in — an app only gets
 * auth once its routes actually use `authRequired` / `attachUser`; until then
 * these are dormant and no route is silently protected or silently open.
 *
 *   - `attachUser`   — best-effort: sets `req.user` if a valid session exists,
 *                      never blocks. Mount app-wide so any handler can read it.
 *   - `authRequired` — 401s when there is no valid session.
 *   - `requireRole`  — 403s when `req.user.role` isn't in the allow-list
 *                      (implies auth; returns 401 first if unauthenticated).
 */

import type { RequestHandler, Response } from 'express';
import type { AuthUser, UserRole } from '@shared/types';

import { env } from '../env';
import { SESSION_TTL_MS, verifySession } from '../services/auth';

/** The cookie the session token rides in. httpOnly, so JS can't read it. */
export const SESSION_COOKIE = 'session';

// Make `req.user` known to TypeScript across the app.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Parse a single cookie value out of the `Cookie` header without a library.
 * Cookies are `name=value; name2=value2`; values are percent-decoded. Returns
 * `null` when absent or malformed.
 */
export function readCookie(cookieHeader: string | undefined, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const raw = part.slice(eq + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
  return null;
}

/** Read the session token from the request, or `null`. */
export function readSessionCookie(cookieHeader: string | undefined): string | null {
  return readCookie(cookieHeader, SESSION_COOKIE);
}

/**
 * Session-cookie attributes, chosen from the REQUEST's forwarded protocol —
 * never from NODE_ENV.
 *
 * WHY NOT NODE_ENV: the founding.dev preview serves this app in DEV mode
 * (NODE_ENV=development) behind an HTTPS proxy, embedded in a CROSS-SITE iframe
 * (the app is on *.preview.foundingdev.com; the shell is on founding.dev). A
 * `SameSite=Lax` cookie is not sent on a cross-site subframe request, so a
 * NODE_ENV-gated cookie ships `Lax` into the preview and login silently fails
 * there while working in a new tab (first-party) — the exact tell-tale
 * asymmetry seen across several apps.
 *
 * OVER HTTPS we emit `SameSite=None; Secure; Partitioned` (CHIPS): the cookie
 * is stored in a partition keyed to the top-level site, so it rides inside the
 * preview iframe (Chromium + Firefox) without becoming an ambient third-party
 * cookie. The proxy sets `X-Forwarded-Proto: https`, so that header — not
 * NODE_ENV — is the signal. Over plain HTTP (local `docker compose` dev on
 * localhost) we keep `Lax`: `SameSite=None` requires `Secure`, and a
 * non-localhost HTTP origin cannot set a Secure cookie.
 *
 * CAVEAT: Safari/ITP may still drop a partitioned third-party cookie. The
 * durable cross-browser fix is serving the preview same-site under
 * *.founding.dev (a platform change), after which this naturally falls back to
 * plain `Lax`. `partitioned` needs Express >= 4.21 (cookie >= 0.7).
 */
function sessionCookieOptions(res: Response): {
  httpOnly: true;
  sameSite: 'none' | 'lax';
  secure: boolean;
  path: '/';
  partitioned?: boolean;
} {
  const fwd = res.req?.headers['x-forwarded-proto'];
  const raw = Array.isArray(fwd) ? fwd[0] : fwd;
  const proto = (String(raw ?? '').split(',')[0] ?? '').trim().toLowerCase();
  const isHttps = proto === 'https' || res.req?.secure === true;
  return isHttps
    ? { httpOnly: true, sameSite: 'none', secure: true, partitioned: true, path: '/' }
    : { httpOnly: true, sameSite: 'lax', secure: false, path: '/' };
}

/**
 * Write the session cookie. Attributes come from `sessionCookieOptions` (see
 * there for the cross-site-preview reasoning). `maxAge` matches the TTL.
 */
export function setSessionCookie(res: Response, token: string): void {
  res.cookie(SESSION_COOKIE, token, { ...sessionCookieOptions(res), maxAge: SESSION_TTL_MS });
}

/**
 * Clear the session cookie (logout). Must mirror the SET attributes — a browser
 * only removes a cookie when name + path + SameSite/Secure/Partitioned match.
 */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions(res));
}

/**
 * Best-effort: populate `req.user` when a valid session cookie is present,
 * otherwise leave it undefined. Never errors, never blocks — mount it app-wide.
 */
export const attachUser: RequestHandler = async (req, _res, next) => {
  try {
    const token = readSessionCookie(req.headers.cookie);
    if (token) {
      const user = await verifySession(token);
      if (user) req.user = user;
    }
  } catch {
    // A DB hiccup during auth must not 500 an otherwise-public request; treat
    // it as "not logged in". `authRequired` will still 401 protected routes.
  }
  next();
};

/**
 * Gate: require a valid session. Runs `attachUser`'s check itself so it works
 * whether or not `attachUser` is mounted upstream.
 */
export const authRequired: RequestHandler = async (req, _res, next) => {
  try {
    if (!req.user) {
      const token = readSessionCookie(req.headers.cookie);
      const user = token ? await verifySession(token) : null;
      if (user) req.user = user;
    }
  } catch (err) {
    return next(err);
  }
  if (!req.user) {
    return next({ status: 401, message: 'Authentication required.', code: 'UNAUTHENTICATED' });
  }
  next();
};

/**
 * Gate: require the authenticated user to hold one of `roles`. Returns 401
 * (not 403) when unauthenticated, so an anonymous caller can't probe which
 * roles exist.
 */
export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      return next({ status: 401, message: 'Authentication required.', code: 'UNAUTHENTICATED' });
    }
    if (!roles.includes(req.user.role)) {
      return next({ status: 403, message: 'You do not have access to this.', code: 'FORBIDDEN' });
    }
    next();
  };
}
