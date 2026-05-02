-- AlterTable: soft-delete columns for trash bin (30-day recovery).
ALTER TABLE "Project" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "Schema" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Project_deletedAt_idx" ON "Project"("deletedAt");
CREATE INDEX "Schema_deletedAt_idx" ON "Schema"("deletedAt");
