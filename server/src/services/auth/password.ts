/**
 * password.ts — password hashing via Node's built-in scrypt.
 *
 * Zero external dependency on purpose: scrypt ships in node:crypto, so there is
 * no bcrypt/argon2 native module to compile in a per-customer container (a
 * frequent build-break). scrypt is a memory-hard KDF and a sound password hash.
 *
 * Stored format: `scrypt$<saltHex>$<hashHex>`. Verification is constant-time.
 */

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

/** Hash a plaintext password. Returns the self-describing `scrypt$salt$hash`. */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await scryptAsync(plain, salt, KEYLEN)) as Buffer;
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/** Verify a plaintext password against a stored hash. Never throws. */
export async function verifyPassword(plain: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[1] as string, 'hex');
  const expected = Buffer.from(parts[2] as string, 'hex');
  if (salt.length === 0 || expected.length !== KEYLEN) return false;
  try {
    const derived = (await scryptAsync(plain, salt, KEYLEN)) as Buffer;
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

/** A cryptographically-random, URL-safe session token. */
export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}
