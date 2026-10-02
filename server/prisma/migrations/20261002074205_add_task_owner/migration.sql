-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "ownerId" TEXT;

-- CreateIndex
CREATE INDEX "Task_ownerId_createdAt_idx" ON "Task"("ownerId", "createdAt");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
