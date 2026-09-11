-- File-upload metadata. The bytes live in the storage driver; this table only
-- points at them. Opt-in — unused when an app has no uploads. See
-- server/src/services/storage and routes/files.ts.

-- CreateTable
CREATE TABLE "File" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "File_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "File_createdAt_idx" ON "File"("createdAt");
