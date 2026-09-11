/**
 * Mongoose parallel of the Prisma User model.
 *
 * The Postgres variant uses Prisma (`server/prisma/schema.prisma`) and this
 * file sits unused. The Mongo variant swaps in this model — copy it to
 * `server/src/models/User.ts` when converting a project, or import from
 * here directly:
 *
 *   import { User } from '../../mongoose/models/User';
 */
// Default import + destructure — mongoose is CJS and this package is ESM, so
// `import { models }` typechecks but throws at runtime. See the long comment in
// ./Task.ts for the full explanation.
import mongoose, { type Model } from 'mongoose';

import type { UserRole } from '@shared/types';

const { Schema, model, models } = mongoose;

/** Document fields. `_id`, `createdAt`, `updatedAt` are added by mongoose. */
export interface UserDoc {
  email: string;
  name: string | null;
  /** Auth (opt-in): null until a password is set. */
  passwordHash: string | null;
  /** Mirrors the Prisma `Role` enum. */
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: null },
    // Auth (opt-in): null until a password is set. `role` mirrors the Prisma
    // `Role` enum. Apps without a login simply never write these. See
    // server/src/services/auth.
    passwordHash: { type: String, default: null },
    role: { type: String, enum: ['owner', 'staff'], default: 'owner' },
  },
  { timestamps: true },
);

/** `models.User ||` guard: `tsx watch` re-imports on save; avoid OverwriteModelError. */
export const User: Model<UserDoc> =
  (models.User as Model<UserDoc> | undefined) ?? model<UserDoc>('User', UserSchema);
