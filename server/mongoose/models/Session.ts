/**
 * Mongoose parallel of the Prisma `Session` model.
 *
 * Server-side sessions: the token lives in an httpOnly cookie, this row is the
 * source of truth, so logout (delete the row) revokes instantly and sessions
 * survive a restart. Only used on the Mongo stack; the Postgres stack uses
 * Prisma. Imported dynamically by `authRepository.ts` so Mongo code never loads
 * in a Postgres project.
 *
 * `expiresAt` carries a TTL index — Mongo sweeps expired rows for us. We also
 * treat an expired row as absent in the repository, so a lapse in the sweep
 * never authenticates a stale session.
 */
// Default import + destructure — see the long comment in ./Task.ts for why a
// named `import { models }` throws at runtime on this ESM package.
import mongoose, { type Model, type Types } from 'mongoose';

const { Schema, model, models } = mongoose;

export interface SessionDoc {
  token: string;
  userId: Types.ObjectId;
  expiresAt: Date;
  createdAt: Date;
}

const SessionMongooseSchema = new Schema<SessionDoc>(
  {
    token: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // TTL index: Mongo deletes the row ~60s after expiresAt. Belt-and-braces
    // with the repository's own expiry check.
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const Session: Model<SessionDoc> =
  (models.Session as Model<SessionDoc> | undefined) ??
  model<SessionDoc>('Session', SessionMongooseSchema);
