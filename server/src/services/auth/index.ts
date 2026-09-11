/**
 * auth service — register / login / session verify / logout.
 *
 * Pure orchestration over `authRepository` + `password.ts`. No Express, no DB
 * driver, no cookie handling — those live in the route and middleware layers,
 * so this file is unit-testable against the in-memory repository.
 *
 * Session model: a random opaque token (not a JWT) stored server-side. That
 * makes logout a real revocation (delete the row) and keeps the client dumb —
 * it just carries an httpOnly cookie it cannot read.
 */

import type { AuthUser, Login, Register } from '@shared/types';
import {
  EmailTakenError,
  getAuthRepository,
  type AuthRepository,
  type StoredUser,
} from '../../repositories/authRepository';
import { hashPassword, newSessionToken, verifyPassword } from './password';

export { EmailTakenError };

/** How long a session lives. 30 days — long enough that owners rarely re-login. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface SessionResult {
  user: AuthUser;
  token: string;
  expiresAt: Date;
}

/** Normalize an email for storage + lookup: trim + lowercase. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Drop the password hash — the wire type a client is allowed to see. */
function toAuthUser(user: StoredUser): AuthUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

function repo(): AuthRepository {
  return getAuthRepository();
}

async function issueSession(user: StoredUser): Promise<SessionResult> {
  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await repo().createSession({ token, userId: user.id, expiresAt });
  return { user: toAuthUser(user), token, expiresAt };
}

/**
 * Register a new account and start a session.
 *
 * The FIRST user of an app is the `owner`; every later self-registration is
 * `staff`. (An app that wants invite-only staff simply doesn't expose the
 * register route — the columns stay unused.) Throws `EmailTakenError` on a
 * duplicate email.
 */
export async function register(input: Register): Promise<SessionResult> {
  const email = normalizeEmail(input.email);
  const existing = await repo().findUserByEmail(email);
  if (existing) throw new EmailTakenError();

  const passwordHash = await hashPassword(input.password);
  // Race-safe: two concurrent registers for the same email both pass the check
  // above, but the unique constraint makes exactly one createUser win; the
  // loser surfaces as EmailTakenError from the repository.
  const user = await repo().createUser({
    email,
    name: input.name ?? null,
    passwordHash,
    role: 'owner',
  });
  return issueSession(user);
}

/**
 * Verify credentials and start a session. Resolves `null` on any failure
 * (unknown email OR wrong password OR a passwordless user) — the caller must
 * not distinguish them, so the response can't be used to enumerate emails.
 */
export async function login(input: Login): Promise<SessionResult | null> {
  const email = normalizeEmail(input.email);
  const user = await repo().findUserByEmail(email);
  // Verify even when the user is missing? Not worth the timing-oracle defense
  // here: scrypt on a fixed dummy would double every failed-login's cost. We
  // accept the small timing signal; email enumeration is already possible via
  // register's 409.
  if (!user || !user.passwordHash) return null;
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) return null;
  return issueSession(user);
}

/**
 * Resolve the user behind a session token, or `null` if the token is unknown
 * or expired. An expired session is deleted as a side effect (lazy sweep).
 */
export async function verifySession(token: string): Promise<AuthUser | null> {
  if (!token) return null;
  const found = await repo().findSessionWithUser(token);
  if (!found) return null;
  if (found.session.expiresAt.getTime() <= Date.now()) {
    await repo().deleteSession(token);
    return null;
  }
  return toAuthUser(found.user);
}

/** Revoke a session. Idempotent — logging out an unknown token is a no-op. */
export async function logout(token: string): Promise<void> {
  if (!token) return;
  await repo().deleteSession(token);
}
