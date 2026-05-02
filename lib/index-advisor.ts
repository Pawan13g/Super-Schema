import type { Schema } from "./types";

export interface IndexCandidate {
  tableName: string;
  tableId: string;
  columns: string[];
  columnIds: string[];
  unique: boolean;
  reason: string;
  source: "rule" | "ai";
}

const COMMON_LOOKUP_NAMES = new Set([
  "email",
  "username",
  "slug",
  "handle",
  "phone",
  "status",
  "state",
  "type",
  "kind",
  "role",
]);

const TIME_NAMES = new Set([
  "created_at",
  "updated_at",
  "deleted_at",
  "published_at",
  "started_at",
  "ended_at",
]);

function existingIndexCovers(
  table: Schema["tables"][number],
  columnIds: string[]
): boolean {
  // PRIMARY KEY column counts as a covering index for that single column.
  if (columnIds.length === 1) {
    const col = table.columns.find((c) => c.id === columnIds[0]);
    if (
      col?.constraints.includes("PRIMARY KEY") ||
      col?.constraints.includes("UNIQUE")
    ) {
      return true;
    }
  }
  return (table.indexes ?? []).some(
    (idx) =>
      idx.columns.length === columnIds.length &&
      idx.columns.every((c, i) => c === columnIds[i])
  );
}

export function ruleBasedIndexCandidates(schema: Schema): IndexCandidate[] {
  const out: IndexCandidate[] = [];
  const tableById = new Map(schema.tables.map((t) => [t.id, t]));

  // 1. FK columns — every relation source column gets an index.
  for (const rel of schema.relations) {
    const t = tableById.get(rel.sourceTable);
    const targetT = tableById.get(rel.targetTable);
    const col = t?.columns.find((c) => c.id === rel.sourceColumn);
    if (!t || !col) continue;
    if (existingIndexCovers(t, [col.id])) continue;
    out.push({
      tableName: t.name,
      tableId: t.id,
      columns: [col.name],
      columnIds: [col.id],
      unique: false,
      reason: `FK to ${targetT?.name ?? "?"} — speed up joins.`,
      source: "rule",
    });
  }

  // 2. Common lookup columns by name.
  for (const t of schema.tables) {
    for (const col of t.columns) {
      const lower = col.name.toLowerCase();
      if (COMMON_LOOKUP_NAMES.has(lower) && !existingIndexCovers(t, [col.id])) {
        // Skip if already PK/UNIQUE
        if (
          col.constraints.includes("PRIMARY KEY") ||
          col.constraints.includes("UNIQUE")
        ) {
          continue;
        }
        out.push({
          tableName: t.name,
          tableId: t.id,
          columns: [col.name],
          columnIds: [col.id],
          unique: false,
          reason: `"${col.name}" is a common lookup column.`,
          source: "rule",
        });
      }
      if (TIME_NAMES.has(lower) && !existingIndexCovers(t, [col.id])) {
        out.push({
          tableName: t.name,
          tableId: t.id,
          columns: [col.name],
          columnIds: [col.id],
          unique: false,
          reason: `Timestamp column — useful for range/sort queries.`,
          source: "rule",
        });
      }
    }
  }

  // Dedupe: same (tableId, columnIds joined) keeps first reason.
  const seen = new Set<string>();
  return out.filter((c) => {
    const key = `${c.tableId}::${c.columnIds.join(",")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function resolveAiSuggestions(
  schema: Schema,
  raw: { tableName: string; columns: string[]; unique: boolean; reason: string }[]
): IndexCandidate[] {
  const out: IndexCandidate[] = [];
  for (const s of raw) {
    const t = schema.tables.find((x) => x.name === s.tableName);
    if (!t) continue;
    const columnIds: string[] = [];
    let allFound = true;
    for (const cn of s.columns) {
      const col = t.columns.find((c) => c.name === cn);
      if (!col) {
        allFound = false;
        break;
      }
      columnIds.push(col.id);
    }
    if (!allFound || columnIds.length === 0) continue;
    if (existingIndexCovers(t, columnIds)) continue;
    out.push({
      tableName: t.name,
      tableId: t.id,
      columns: s.columns,
      columnIds,
      unique: s.unique,
      reason: s.reason,
      source: "ai",
    });
  }
  return out;
}
