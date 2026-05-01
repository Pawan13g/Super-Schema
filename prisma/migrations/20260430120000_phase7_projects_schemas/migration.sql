-- Phase 7: split schemaJson out of Workspace into Project -> Schema
-- 1. Create Project and Schema tables
-- 2. Backfill: for every existing Workspace, create a default Project and a Schema
--    that carries the existing schemaJson, so no data is lost.
-- 3. Drop the now-redundant schemaJson column from Workspace.

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "workspaceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Schema" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "schemaJson" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schema_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Project_workspaceId_idx" ON "Project"("workspaceId");

-- CreateIndex
CREATE INDEX "Schema_projectId_idx" ON "Schema"("projectId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Schema" ADD CONSTRAINT "Schema_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill existing data: one Project + one Schema per existing Workspace
INSERT INTO "Project" ("id", "name", "description", "workspaceId", "createdAt", "updatedAt")
SELECT
    'prj_' || substr(md5(random()::text || w."id"), 1, 24),
    'Default Project',
    NULL,
    w."id",
    w."createdAt",
    w."updatedAt"
FROM "Workspace" w;

INSERT INTO "Schema" ("id", "name", "projectId", "schemaJson", "version", "createdAt", "updatedAt")
SELECT
    'sch_' || substr(md5(random()::text || w."id"), 1, 24),
    'Main Schema',
    p."id",
    w."schemaJson",
    1,
    w."createdAt",
    w."updatedAt"
FROM "Workspace" w
JOIN "Project" p ON p."workspaceId" = w."id";

-- Drop the now-redundant schemaJson column from Workspace
ALTER TABLE "Workspace" DROP COLUMN "schemaJson";
