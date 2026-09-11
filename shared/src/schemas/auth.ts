/**
 * shared/src/schemas/auth.ts — auth wire contracts (client + server).
 *
 * The starter ships email + password auth with two roles (owner / staff). Keep
 * it dead simple for non-technical owners: an email and a password, no OAuth
 * dance required. Passwords are never returned; the session lives in an
 * httpOnly cookie the client cannot read.
 */

import { z } from 'zod';

/** Roles. `owner` is the business owner (full access); `staff` is an invited user. */
export const USER_ROLES = ['owner', 'staff'] as const;
export const UserRoleSchema = z.enum(USER_ROLES);

/** The authenticated user as returned by /api/auth/me and /login. No password. */
export const AuthUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  role: UserRoleSchema,
});

/** POST /api/auth/register body. */
export const RegisterSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  name: z.string().trim().min(1).max(120).optional(),
});

/** POST /api/auth/login body. */
export const LoginSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required').max(200),
});
