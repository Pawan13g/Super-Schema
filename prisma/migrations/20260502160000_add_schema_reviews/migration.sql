-- CreateTable
CREATE TABLE "SchemaReview" (
    "id" TEXT NOT NULL,
    "schemaId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorName" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "baseVersion" INTEGER NOT NULL,
    "proposedJson" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchemaReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchemaReview_schemaId_status_idx" ON "SchemaReview"("schemaId", "status");

-- CreateIndex
CREATE INDEX "SchemaReview_schemaId_createdAt_idx" ON "SchemaReview"("schemaId", "createdAt");

-- AddForeignKey
ALTER TABLE "SchemaReview" ADD CONSTRAINT "SchemaReview_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "Schema"("id") ON DELETE CASCADE ON UPDATE CASCADE;
