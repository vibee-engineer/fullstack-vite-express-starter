/**
 * sessionCookie.test.ts — the session cookie's attributes must track the
 * REQUEST's forwarded protocol, never NODE_ENV.
 *
 * The founding.dev preview serves the app in dev mode (NODE_ENV=development)
 * behind an HTTPS proxy inside a CROSS-SITE iframe. A NODE_ENV-gated cookie
 * ships SameSite=Lax there and login silently fails (works in a new tab). Over
 * HTTPS the cookie must be SameSite=None; Secure; Partitioned (CHIPS) so it
 * rides inside the iframe; over plain HTTP (local dev) it stays Lax because
 * SameSite=None requires Secure.
 */

import type { Response } from 'express';
import { describe, expect, it } from 'vitest';

import { clearSessionCookie, SESSION_COOKIE, setSessionCookie } from '../auth';

type CookieCall = { name: string; value?: string; opts: Record<string, unknown> };

function mockRes(headers: Record<string, unknown> = {}, secure = false) {
  const cookies: CookieCall[] = [];
  const clears: CookieCall[] = [];
  const res = {
    req: { headers, secure },
    cookie(name: string, value: string, opts: Record<string, unknown>) {
      cookies.push({ name, value, opts });
      return res;
    },
    clearCookie(name: string, opts: Record<string, unknown>) {
      clears.push({ name, opts });
      return res;
    },
  };
  return { res: res as unknown as Response, cookies, clears };
}

describe('session cookie attributes follow the forwarded protocol', () => {
  it('cross-site HTTPS preview -> SameSite=None; Secure; Partitioned', () => {
    const { res, cookies } = mockRes({ 'x-forwarded-proto': 'https' });
    setSessionCookie(res, 'tok');
    expect(cookies[0]!.opts).toMatchObject({
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      partitioned: true,
      path: '/',
    });
    expect(typeof cookies[0]!.opts.maxAge).toBe('number');
  });

  it('local HTTP dev -> SameSite=Lax, not Secure (None would be rejected)', () => {
    const { res, cookies } = mockRes({});
    setSessionCookie(res, 'tok');
    expect(cookies[0]!.opts).toMatchObject({ httpOnly: true, sameSite: 'lax', secure: false });
    expect(cookies[0]!.opts.partitioned).toBeUndefined();
  });

  it('proxy chain "https, http" uses the first hop', () => {
    const { res, cookies } = mockRes({ 'x-forwarded-proto': 'https, http' });
    setSessionCookie(res, 'tok');
    expect(cookies[0]!.opts.sameSite).toBe('none');
    expect(cookies[0]!.opts.secure).toBe(true);
  });

  it('array-valued x-forwarded-proto uses the first entry', () => {
    const { res, cookies } = mockRes({ 'x-forwarded-proto': ['https', 'http'] });
    setSessionCookie(res, 'tok');
    expect(cookies[0]!.opts.secure).toBe(true);
  });

  it('uppercase HTTPS is matched (case-insensitive)', () => {
    const { res, cookies } = mockRes({ 'x-forwarded-proto': 'HTTPS' });
    setSessionCookie(res, 'tok');
    expect(cookies[0]!.opts.sameSite).toBe('none');
  });

  it('direct HTTPS (req.secure) with no forwarded header still partitions', () => {
    const { res, cookies } = mockRes({}, true);
    setSessionCookie(res, 'tok');
    expect(cookies[0]!.opts.partitioned).toBe(true);
  });

  it('missing res.req falls back to Lax without throwing', () => {
    const cookies: CookieCall[] = [];
    const res = {
      cookie(name: string, value: string, opts: Record<string, unknown>) {
        cookies.push({ name, value, opts });
        return res;
      },
    } as unknown as Response;
    expect(() => setSessionCookie(res, 'tok')).not.toThrow();
    expect(cookies[0]!.opts.sameSite).toBe('lax');
    expect(cookies[0]!.opts.secure).toBe(false);
  });

  it('clearSessionCookie mirrors the set attributes so the browser removes it', () => {
    const { res, clears } = mockRes({ 'x-forwarded-proto': 'https' });
    clearSessionCookie(res);
    expect(clears[0]!.name).toBe(SESSION_COOKIE);
    expect(clears[0]!.opts).toMatchObject({
      sameSite: 'none',
      secure: true,
      partitioned: true,
      path: '/',
    });
  });
});
