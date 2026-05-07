import type { Schema } from "./types";
import { generateSql } from "./sql-generator";
import { generateModels } from "./model-generator";
import { getCanvasPngBytes } from "./export-utils";
import { buildZip } from "./zip";

export interface BulkExportOptions {
  baseName?: string;
  includePng?: boolean;
}

/**
 * Builds a ZIP with all common artifacts for the given schema:
 *  - schema.sql (PostgreSQL)
 *  - schema.mysql.sql, schema.sqlite.sql
 *  - schema.json (raw schema state)
 *  - schema.prisma
 *  - models.ts (Sequelize)
 *  - schema.dbml
 *  - schema.graphql
 *  - openapi.json
 *  - er.png (canvas snapshot, if mounted)
 */
export async function bulkExport(
  schema: Schema,
  options: BulkExportOptions = {}
): Promise<Blob> {
  const base = (options.baseName ?? "schema").replace(/[^a-z0-9_-]+/gi, "_");
  // Wrap every entry in a top-level folder named `<base>/` so extracting on
  // Windows / macOS doesn't scatter a dozen files into the user's CWD.
  const dir = `${base}/`;

  const entries: { name: string; data: Uint8Array | string }[] = [];
  entries.push({ name: `${dir}${base}.pgsql.sql`, data: generateSql(schema, "postgresql") });
  entries.push({ name: `${dir}${base}.mysql.sql`, data: generateSql(schema, "mysql") });
  entries.push({ name: `${dir}${base}.sqlite.sql`, data: generateSql(schema, "sqlite") });
  entries.push({ name: `${dir}${base}.mssql.sql`, data: generateSql(schema, "mssql") });
  entries.push({ name: `${dir}${base}.oracle.sql`, data: generateSql(schema, "oracle") });
  entries.push({
    name: `${dir}${base}.json`,
    data: JSON.stringify(schema, null, 2),
  });
  entries.push({ name: `${dir}schema.prisma`, data: generateModels(schema, "prisma") });
  entries.push({ name: `${dir}models.ts`, data: generateModels(schema, "sequelize") });
  entries.push({ name: `${dir}${base}.dbml`, data: generateModels(schema, "dbml") });
  entries.push({ name: `${dir}${base}.graphql`, data: generateModels(schema, "graphql") });
  entries.push({ name: `${dir}openapi.json`, data: generateModels(schema, "openapi") });

  if (options.includePng !== false) {
    try {
      const png = await getCanvasPngBytes();
      if (png) entries.push({ name: `${dir}er.png`, data: png });
    } catch {
      /* canvas not mounted — skip */
    }
  }

  // README
  entries.push({
    name: `${dir}README.md`,
    data: [
      `# ${base} — Super Schema bundle`,
      "",
      `Generated at: ${new Date().toISOString()}`,
      "",
      "## Files",
      "",
      `- \`${base}.pgsql.sql\` — PostgreSQL CREATE TABLE statements`,
      `- \`${base}.mysql.sql\` — MySQL CREATE TABLE statements`,
      `- \`${base}.sqlite.sql\` — SQLite CREATE TABLE statements`,
      `- \`${base}.json\` — Raw schema state (re-importable into Super Schema)`,
      "- `schema.prisma` — Prisma schema",
      "- `models.ts` — Sequelize model definitions",
      `- \`${base}.dbml\` — DBML for dbdiagram.io`,
      `- \`${base}.graphql\` — GraphQL SDL`,
      "- `openapi.json` — OpenAPI 3.1 stub with CRUD paths per table",
      "- `er.png` — Canvas snapshot (when present)",
      "",
    ].join("\n"),
  });

  return buildZip(entries);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  // Defer revoke so the browser actually starts the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
