/**
 * auth.test.ts — the auth routes end-to-end via supertest.
 *
 * Real Express app + real middleware + real service, backed by the in-memory
 * auth repository (no DB). Exercises the full cookie round-trip with
 * `request.agent`, which persists Set-Cookie between calls like a browser.
 *
 * What this must cover: register (201 + cookie), duplicate (409), login
 * (200 + cookie / 401), me (200 authed / 401 anon), logout (204 + cookie
 * cleared + session actually revoked), and validation 400s.
 */

import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMemoryAuthRepository, setAuthRepository } from '../../repositories/authRepository';
import { createApp } from '../../app';

const app = createApp();

beforeEach(() => {
  setAuthRepository(createMemoryAuthRepository());
});

afterEach(() => {
  setAuthRepository(null);
});

/** Pull the Set-Cookie header as an array (supertest gives string | string[]). */
function cookies(res: request.Response): string[] {
  const raw = res.headers['set-cookie'];
  return Array.isArray(raw) ? raw : raw ? [raw] : [];
}

describe('POST /api/auth/register', () => {
  it('creates a user, returns 201 { user } and sets an httpOnly session cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'owner@example.com', password: 'password123', name: 'Owen' })
      .expect(201);

    expect(res.body.user).toMatchObject({
      email: 'owner@example.com',
      role: 'owner',
      name: 'Owen',
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');

    const [cookie] = cookies(res);
    expect(cookie).toMatch(/^session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('409s EMAIL_TAKEN on a duplicate email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'password123' })
      .expect(201);

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'dup@example.com', password: 'password123' })
      .expect(409);

    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('400s VALIDATION on a short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'x@example.com', password: 'short' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION');
    expect(res.body.error.details.fieldErrors.password).toBeDefined();
  });

  it('400s VALIDATION on a malformed email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'password123' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION');
  });
});

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'user@example.com', password: 'password123', name: 'Uma' });
  });

  it('200s with { user } and a fresh cookie on correct credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'password123' })
      .expect(200);

    expect(res.body.user).toMatchObject({ email: 'user@example.com', name: 'Uma' });
    expect(cookies(res)[0]).toMatch(/^session=/);
  });

  it('is case-insensitive on the email', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({ email: 'USER@Example.com', password: 'password123' })
      .expect(200);
  });

  it('401s INVALID_CREDENTIALS on a wrong password (no cookie set)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'wrongpass1' })
      .expect(401);

    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(cookies(res)).toHaveLength(0);
  });

  it('401s INVALID_CREDENTIALS on an unknown email (same shape, no enumeration)', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'password123' })
      .expect(401);

    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });
});

describe('GET /api/auth/me', () => {
  it('401s UNAUTHENTICATED with no cookie', async () => {
    const res = await request(app).get('/api/auth/me').expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('401s on a bogus session cookie', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', 'session=deadbeef')
      .expect(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns the current user after register (cookie carried by the agent)', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/register')
      .send({ email: 'me@example.com', password: 'password123', name: 'Mia' })
      .expect(201);

    const res = await agent.get('/api/auth/me').expect(200);
    expect(res.body.user).toMatchObject({ email: 'me@example.com', name: 'Mia', role: 'owner' });
  });
});

describe('POST /api/auth/logout', () => {
  it('204s, clears the cookie, and revokes the session', async () => {
    const agent = request.agent(app);
    await agent
      .post('/api/auth/register')
      .send({ email: 'out@example.com', password: 'password123' })
      .expect(201);

    // Authenticated before logout.
    await agent.get('/api/auth/me').expect(200);

    const res = await agent.post('/api/auth/logout').expect(204);
    // Clearing sends a session cookie with an expiry in the past.
    const [cleared] = cookies(res);
    expect(cleared).toMatch(/^session=/);
    expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970|Max-Age=0/i);

    // The agent now carries the cleared cookie → 401.
    await agent.get('/api/auth/me').expect(401);
  });

  it('204s even with no session (idempotent)', async () => {
    await request(app).post('/api/auth/logout').expect(204);
  });
});
