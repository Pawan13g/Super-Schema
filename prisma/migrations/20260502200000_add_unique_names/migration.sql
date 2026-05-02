-- Enforce unique names within scope:
--   - Schema name unique within its project
--   - Project name unique within its workspace
--
-- Existing rows that violate either constraint will block this migration.
-- Resolve by renaming the duplicates beforehand.

CREATE UNIQUE INDEX "Schema_projectId_name_key" ON "Schema"("projectId", "name");
CREATE UNIQUE INDEX "Project_workspaceId_name_key" ON "Project"("workspaceId", "name");
