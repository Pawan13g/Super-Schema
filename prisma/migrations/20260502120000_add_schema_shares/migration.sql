-- CreateTable
CREATE TABLE "SchemaShare" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "schemaId" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchemaShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SchemaShare_token_key" ON "SchemaShare"("token");

-- CreateIndex
CREATE INDEX "SchemaShare_schemaId_idx" ON "SchemaShare"("schemaId");

-- AddForeignKey
ALTER TABLE "SchemaShare" ADD CONSTRAINT "SchemaShare_schemaId_fkey" FOREIGN KEY ("schemaId") REFERENCES "Schema"("id") ON DELETE CASCADE ON UPDATE CASCADE;
