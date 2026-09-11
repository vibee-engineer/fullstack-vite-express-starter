/**
 * auth.test.ts — the auth service against the in-memory repository.
 *
 * No DB, no Express: `setAuthRepository(createMemoryAuthRepository())` gives the
 * service a real (process-local) store, so every branch of register / login /
 * verifySession / logout is exercised end-to-end.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createMemoryAuthRepository,
  EmailTakenError,
  setAuthRepository,
  type AuthRepository,
} from '../../../repositories/authRepository';
import { hashPassword, verifyPassword, newSessionToken } from '../password';
import { login, logout, normalizeEmail, register, SESSION_TTL_MS, verifySession } from '../index';

let repo: AuthRepository;

beforeEach(() => {
  repo = createMemoryAuthRepository();
  setAuthRepository(repo);
});

afterEach(() => {
  setAuthRepository(null);
});

describe('password hashing', () => {
  it('round-trips a correct password and rejects a wrong one', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(stored.startsWith('scrypt$')).toBe(true);
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true);
    expect(await verifyPassword('wrong password', stored)).toBe(false);
  });

  it('produces a different hash each time (random salt)', async () => {
    const a = await hashPassword('same');
    const b = await hashPassword('same');
    expect(a).not.toBe(b);
    expect(await verifyPassword('same', a)).toBe(true);
    expect(await verifyPassword('same', b)).toBe(true);
  });

  it('never throws on malformed stored values', async () => {
    expect(await verifyPassword('x', null)).toBe(false);
    expect(await verifyPassword('x', undefined)).toBe(false);
    expect(await verifyPassword('x', '')).toBe(false);
    expect(await verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(await verifyPassword('x', 'scrypt$zz$zz')).toBe(false);
    expect(await verifyPassword('x', 'bcrypt$a$b')).toBe(false);
  });

  it('mints unique, url-safe tokens', () => {
    const a = newSessionToken();
    const b = newSessionToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Owner@Example.COM ')).toBe('owner@example.com');
  });
});

describe('register', () => {
  it('creates the first user as owner and issues a session', async () => {
    const result = await register({ email: 'owner@example.com', password: 'password123' });
    expect(result.user).toMatchObject({ email: 'owner@example.com', role: 'owner', name: null });
    expect(result.user).not.toHaveProperty('passwordHash');
    expect(result.token).toBeTruthy();
    expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('stores the email normalized so a differently-cased login works', async () => {
    await register({ email: '  Owner@Example.com ', password: 'password123', name: 'Ann' });
    const result = await login({ email: 'OWNER@example.COM', password: 'password123' });
    expect(result?.user.email).toBe('owner@example.com');
    expect(result?.user.name).toBe('Ann');
  });

  it('rejects a duplicate email with EmailTakenError', async () => {
    await register({ email: 'dup@example.com', password: 'password123' });
    await expect(
      register({ email: 'dup@example.com', password: 'otherpass1' }),
    ).rejects.toBeInstanceOf(EmailTakenError);
  });

  it('rejects a duplicate even across casing/whitespace', async () => {
    await register({ email: 'dup@example.com', password: 'password123' });
    await expect(
      register({ email: ' DUP@Example.com ', password: 'password123' }),
    ).rejects.toBeInstanceOf(EmailTakenError);
  });

  it('does not persist a session for a rejected duplicate', async () => {
    const first = await register({ email: 'dup@example.com', password: 'password123' });
    await expect(register({ email: 'dup@example.com', password: 'password123' })).rejects.toThrow();
    // The first user's session still resolves; no partial state leaked.
    expect(await verifySession(first.token)).toMatchObject({ email: 'dup@example.com' });
  });
});

describe('login', () => {
  beforeEach(async () => {
    await register({ email: 'user@example.com', password: 'password123', name: 'Uma' });
  });

  it('succeeds with the right password', async () => {
    const result = await login({ email: 'user@example.com', password: 'password123' });
    expect(result?.user).toMatchObject({ email: 'user@example.com', name: 'Uma' });
    expect(result?.token).toBeTruthy();
  });

  it('returns null on a wrong password', async () => {
    expect(await login({ email: 'user@example.com', password: 'wrongpass1' })).toBeNull();
  });

  it('returns null on an unknown email', async () => {
    expect(await login({ email: 'nobody@example.com', password: 'password123' })).toBeNull();
  });

  it('returns null for a passwordless user (invited, no password set)', async () => {
    await repo.createUser({
      email: 'invited@example.com',
      name: null,
      passwordHash: '',
      role: 'staff',
    });
    // Empty hash never verifies, and login must not treat it as a match.
    expect(await login({ email: 'invited@example.com', password: '' })).toBeNull();
  });

  it('issues a distinct session per login', async () => {
    const a = await login({ email: 'user@example.com', password: 'password123' });
    const b = await login({ email: 'user@example.com', password: 'password123' });
    expect(a?.token).not.toBe(b?.token);
    // Both sessions are independently valid.
    expect(await verifySession(a!.token)).toBeTruthy();
    expect(await verifySession(b!.token)).toBeTruthy();
  });
});

describe('verifySession', () => {
  it('resolves the user for a live token', async () => {
    const { token } = await register({ email: 'live@example.com', password: 'password123' });
    expect(await verifySession(token)).toMatchObject({ email: 'live@example.com', role: 'owner' });
  });

  it('returns null for an unknown token', async () => {
    expect(await verifySession('nope')).toBeNull();
    expect(await verifySession('')).toBeNull();
  });

  it('returns null and reaps an expired session', async () => {
    const user = await repo.createUser({
      email: 'exp@example.com',
      name: null,
      passwordHash: await hashPassword('password123'),
      role: 'owner',
    });
    const token = newSessionToken();
    await repo.createSession({ token, userId: user.id, expiresAt: new Date(Date.now() - 1000) });

    expect(await verifySession(token)).toBeNull();
    // Reaped: a second lookup finds nothing (and the row is gone).
    expect(await repo.findSessionWithUser(token)).toBeNull();
  });

  it('honors a ~30-day TTL', async () => {
    const { token } = await register({ email: 'ttl@example.com', password: 'password123' });
    const found = await repo.findSessionWithUser(token);
    const ms = found!.session.expiresAt.getTime() - Date.now();
    // Within a minute of 30 days.
    expect(Math.abs(ms - SESSION_TTL_MS)).toBeLessThan(60_000);
  });
});

describe('logout', () => {
  it('revokes the session so verifySession stops resolving it', async () => {
    const { token } = await register({ email: 'out@example.com', password: 'password123' });
    expect(await verifySession(token)).toBeTruthy();

    await logout(token);
    expect(await verifySession(token)).toBeNull();
  });

  it('is idempotent for unknown/empty tokens', async () => {
    await expect(logout('nope')).resolves.toBeUndefined();
    await expect(logout('')).resolves.toBeUndefined();
  });

  it('revokes only the targeted session, leaving others live', async () => {
    await register({ email: 'multi@example.com', password: 'password123' });
    const a = await login({ email: 'multi@example.com', password: 'password123' });
    const b = await login({ email: 'multi@example.com', password: 'password123' });

    await logout(a!.token);
    expect(await verifySession(a!.token)).toBeNull();
    expect(await verifySession(b!.token)).toBeTruthy();
  });
});
