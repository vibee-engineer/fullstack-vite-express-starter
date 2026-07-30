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
import { Schema, model, models } from 'mongoose';

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, index: true },
    name: { type: String, default: null },
  },
  { timestamps: true },
);

export const User = models.User || model('User', UserSchema);
