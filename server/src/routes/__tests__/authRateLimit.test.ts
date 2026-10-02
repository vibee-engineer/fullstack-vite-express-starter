/**
 * Brute-force protection on /api/auth/login + /register.
 *
 * Only FAILED attempts count (skipSuccessfulRequests), so a real user signing
 * in repeatedly is never locked out; an attacker guessing passwords is, after
 * AUTH_RATE_LIMIT (default 10) failures per 15 minutes per client IP.
 */

import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { authLimiter } from '../../middleware/rate-limit';
import { createMemoryAuthRepository, setAuthRepository } from '../../repositories/authRepository';

const app = createApp();

beforeEach(async () => {
  setAuthRepository(createMemoryAuthRepository());
  await authLimiter.resetKey('::ffff:127.0.0.1');
  await authLimiter.resetKey('127.0.0.1');
  await authLimiter.resetKey('192.0.2.50');
});
afterEach(() => setAuthRepository(null));

const badLogin = (ip?: string) => {
  const r = request(app).post('/api/auth/login');
  if (ip) r.set('X-Forwarded-For', ip);
  return r.send({ email: 'nobody@example.com', password: 'wrong-password' });
};

describe('auth rate limit', () => {
  it('blocks the 11th failed login with 429 and the standard RateLimit headers', async () => {
    for (let i = 0; i < 10; i += 1) await badLogin().expect(401);
    const res = await badLogin().expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(res.headers['ratelimit-policy'] ?? res.headers['ratelimit']).toBeTruthy();
  });

  it('successful logins never count toward the limit', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'owner@example.com', password: 'password123' })
      .expect(201);
    for (let i = 0; i < 15; i += 1) {
      await request(app)
        .post('/api/auth/login')
        .send({ email: 'owner@example.com', password: 'password123' })
        .expect(200);
    }
  });

  it('a forged X-Forwarded-For prefix does not give the client a fresh bucket', async () => {
    // A proxy (nginx / Fly) APPENDS the real peer address, so the attacker
    // controls only the entries to its left. Express walks from the right and
    // stops at the first untrusted address: the real client, 192.0.2.50.
    for (let i = 0; i < 10; i += 1) await badLogin(`203.0.113.${i}, 192.0.2.50`).expect(401);
    await badLogin('198.51.100.7, 192.0.2.50').expect(429);
    // A genuinely different client behind the same proxy is unaffected.
    await badLogin('192.0.2.51').expect(401);
  });
});
