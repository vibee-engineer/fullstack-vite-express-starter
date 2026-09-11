/**
 * authRepository.ts — persistence seam for auth, mirroring taskRepository.
 *
 * The auth SERVICE (../services/auth) never imports Prisma or mongoose; it
 * depends only on this interface, so the same register/login/session logic runs
 * on Postgres, Mongo, or the in-memory store (SKIP_DB / tests) unchanged.
 *
 * Two internal shapes cross this seam that are NOT the wire type:
 *   - `StoredUser` carries `passwordHash` (never serialized to a client).
 *   - `StoredSession` carries the raw token + expiry.
 * The service maps `StoredUser` → the `AuthUser` wire type (dropping the hash)
 * before anything reaches a response.
 */

import { isMongo, isPostgres } from '../env';
import type { UserRole } from '@shared/types';

/** A user row as auth needs it internally — includes the password hash. */
export interface StoredUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
  passwordHash: string | null;
}

/** A session row. `expiresAt` is a real Date; expiry is enforced by the service. */
export interface StoredSession {
  token: string;
  userId: string;
  expiresAt: Date;
}

export interface NewUser {
  email: string;
  name: string | null;
  passwordHash: string;
  role: UserRole;
}

export interface AuthRepository {
  /** Email must already be normalized (trimmed + lowercased) by the caller. */
  findUserByEmail(email: string): Promise<StoredUser | null>;
  findUserById(id: string): Promise<StoredUser | null>;
  /** Throws `EMAIL_TAKEN` (see below) when the email collides. */
  createUser(input: NewUser): Promise<StoredUser>;
  createSession(input: StoredSession): Promise<StoredSession>;
  /** Session + its user in one hop. `null` if the token is unknown. */
  findSessionWithUser(token: string): Promise<{ session: StoredSession; user: StoredUser } | null>;
  /** `false` when no session matched. */
  deleteSession(token: string): Promise<boolean>;
}

/**
 * Sentinel thrown by `createUser` on a duplicate email. The service catches it
 * and turns it into a clean 409 rather than leaking a Prisma/Mongo error.
 */
export class EmailTakenError extends Error {
  constructor() {
    super('EMAIL_TAKEN');
    this.name = 'EmailTakenError';
  }
}

/** Prisma unique-constraint violation. */
function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: string }).code === 'P2002';
}

/** Mongo duplicate-key violation. */
function isMongoDuplicate(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

// ---------------------------------------------------------------------------
// Prisma / Postgres
// ---------------------------------------------------------------------------

export function createPrismaAuthRepository(): AuthRepository {
  const db = async () => (await import('../db/prisma')).prisma;

  const toUser = (row: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    passwordHash: string | null;
  }): StoredUser => ({
    id: row.id,
    email: row.email,
    name: row.name ?? null,
    role: row.role as UserRole,
    passwordHash: row.passwordHash ?? null,
  });

  return {
    async findUserByEmail(email) {
      const prisma = await db();
      const row = await prisma.user.findUnique({ where: { email } });
      return row ? toUser(row) : null;
    },

    async findUserById(id) {
      const prisma = await db();
      const row = await prisma.user.findUnique({ where: { id } });
      return row ? toUser(row) : null;
    },

    async createUser(input) {
      const prisma = await db();
      try {
        const row = await prisma.user.create({
          data: {
            email: input.email,
            name: input.name,
            passwordHash: input.passwordHash,
            role: input.role,
          },
        });
        return toUser(row);
      } catch (err) {
        if (isUniqueViolation(err)) throw new EmailTakenError();
        throw err;
      }
    },

    async createSession(input) {
      const prisma = await db();
      await prisma.session.create({
        data: { token: input.token, userId: input.userId, expiresAt: input.expiresAt },
      });
      return input;
    },

    async findSessionWithUser(token) {
      const prisma = await db();
      const row = await prisma.session.findUnique({
        where: { token },
        include: { user: true },
      });
      if (!row) return null;
      return {
        session: { token: row.token, userId: row.userId, expiresAt: row.expiresAt },
        user: toUser(row.user),
      };
    },

    async deleteSession(token) {
      const prisma = await db();
      const { count } = await prisma.session.deleteMany({ where: { token } });
      return count > 0;
    },
  };
}

// ---------------------------------------------------------------------------
// Mongoose / Mongo
// ---------------------------------------------------------------------------

export function createMongooseAuthRepository(): AuthRepository {
  const users = async () => (await import('../../mongoose/models/User')).User;
  const sessions = async () => (await import('../../mongoose/models/Session')).Session;

  const toUser = (doc: {
    _id: unknown;
    email: string;
    name: string | null;
    role?: string;
    passwordHash?: string | null;
  }): StoredUser => ({
    id: String(doc._id),
    email: doc.email,
    name: doc.name ?? null,
    role: (doc.role as UserRole) ?? 'owner',
    passwordHash: doc.passwordHash ?? null,
  });

  return {
    async findUserByEmail(email) {
      const User = await users();
      const doc = await User.findOne({ email }).exec();
      return doc ? toUser(doc) : null;
    },

    async findUserById(id) {
      const User = await users();
      const doc = await User.findById(id).exec();
      return doc ? toUser(doc) : null;
    },

    async createUser(input) {
      const User = await users();
      try {
        const doc = await User.create({
          email: input.email,
          name: input.name,
          passwordHash: input.passwordHash,
          role: input.role,
        });
        return toUser(doc);
      } catch (err) {
        if (isMongoDuplicate(err)) throw new EmailTakenError();
        throw err;
      }
    },

    async createSession(input) {
      const Session = await sessions();
      await Session.create({
        token: input.token,
        userId: input.userId,
        expiresAt: input.expiresAt,
      });
      return input;
    },

    async findSessionWithUser(token) {
      const Session = await sessions();
      const sessionDoc = await Session.findOne({ token }).exec();
      if (!sessionDoc) return null;
      const User = await users();
      const userDoc = await User.findById(sessionDoc.userId).exec();
      if (!userDoc) return null;
      return {
        session: {
          token: sessionDoc.token,
          userId: String(sessionDoc.userId),
          expiresAt: sessionDoc.expiresAt,
        },
        user: toUser(userDoc),
      };
    },

    async deleteSession(token) {
      const Session = await sessions();
      const { deletedCount } = await Session.deleteOne({ token }).exec();
      return (deletedCount ?? 0) > 0;
    },
  };
}

// ---------------------------------------------------------------------------
// In-memory (SKIP_DB=1 dev mode + unit tests)
// ---------------------------------------------------------------------------

export function createMemoryAuthRepository(): AuthRepository {
  const usersById = new Map<string, StoredUser>();
  const usersByEmail = new Map<string, StoredUser>();
  const sessionsByToken = new Map<string, StoredSession>();
  let counter = 0;

  const nextId = () => `mem_user_${++counter}_${Date.now().toString(36)}`;

  return {
    async findUserByEmail(email) {
      return usersByEmail.get(email) ?? null;
    },

    async findUserById(id) {
      return usersById.get(id) ?? null;
    },

    async createUser(input) {
      if (usersByEmail.has(input.email)) throw new EmailTakenError();
      const user: StoredUser = {
        id: nextId(),
        email: input.email,
        name: input.name,
        role: input.role,
        passwordHash: input.passwordHash,
      };
      usersById.set(user.id, user);
      usersByEmail.set(user.email, user);
      return user;
    },

    async createSession(input) {
      sessionsByToken.set(input.token, input);
      return input;
    },

    async findSessionWithUser(token) {
      const session = sessionsByToken.get(token);
      if (!session) return null;
      const user = usersById.get(session.userId);
      if (!user) return null;
      return { session, user };
    },

    async deleteSession(token) {
      return sessionsByToken.delete(token);
    },
  };
}

// ---------------------------------------------------------------------------
// Selector
// ---------------------------------------------------------------------------

let cached: AuthRepository | null = null;

/** Memoized — the backend is resolved once per process. */
export function getAuthRepository(): AuthRepository {
  if (!cached) {
    cached = isPostgres
      ? createPrismaAuthRepository()
      : isMongo
        ? createMongooseAuthRepository()
        : createMemoryAuthRepository();
  }
  return cached;
}

/** Test/dev hook — swap the active repository. Pass `null` to reset. */
export function setAuthRepository(repo: AuthRepository | null): void {
  cached = repo;
}
