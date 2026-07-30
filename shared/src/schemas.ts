/**
 * shared/schemas.ts — zod schemas consumed by both client and server.
 *
 * Convention: one schema per DB write shape (`CreateXSchema`), one per DB
 * read shape (`XSchema`). Server routes validate requests against these
 * via the `validate()` middleware; client forms validate via
 * `@hookform/resolvers/zod`. Types flow from `./types.ts`.
 *
 * Update this file BEFORE writing route handlers or form components — the
 * schema is the contract; both sides derive from it.
 */

import { z } from 'zod';

/** Example: user creation payload (POST body). */
export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(120).optional(),
});

/** Example: user as returned by GET /api/users/:id. */
export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

/** Health probe response. */
export const HealthSchema = z.object({
  status: z.literal('ok'),
  timestamp: z.string(),
});
