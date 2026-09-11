-- Auth: adds Role, extends User with password + role + sessions, and a Session
-- table. Auth is opt-in — these columns are harmless when an app never mounts
-- the auth routes. See server/src/services/auth.

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('owner', 'staff');

-- AlterTable
ALTER TABLE "User"
    ADD COLUMN "passwordHash" TEXT,
    ADD COLUMN "role" "Role" NOT NULL DEFAULT 'owner';

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
