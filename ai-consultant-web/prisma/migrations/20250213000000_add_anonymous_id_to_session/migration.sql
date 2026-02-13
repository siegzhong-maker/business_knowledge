-- AlterTable
ALTER TABLE "Session" ADD COLUMN IF NOT EXISTS "anonymousId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_anonymousId_updatedAt_idx" ON "Session"("anonymousId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Session_userId_updatedAt_idx" ON "Session"("userId", "updatedAt" DESC);
