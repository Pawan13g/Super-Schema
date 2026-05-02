import type { Schema, Table, Column, Relation } from "./types";

export type DiffKind = "added" | "removed" | "modified";

export interface TableDiff {
  kind: DiffKind;
  tableName: string;
  tableId?: string;
  details?: string[];
}

export interface ColumnDiff {
  kind: DiffKind;
  tableName: string;
  columnName: string;
  details?: string[];
}

export interface RelationDiff {
  kind: DiffKind;
  description: string;
}

export interface SchemaDiff {
  tables: TableDiff[];
  columns: ColumnDiff[];
  relations: RelationDiff[];
  summary: {
    tablesAdded: number;
    tablesRemoved: number;
    tablesModified: number;
    columnsAdded: number;
    columnsRemoved: number;
    columnsModified: number;
    relationsAdded: number;
    relationsRemoved: number;
  };
  hasChanges: boolean;
}

export function diffSchemas(older: Schema, newer: Schema): SchemaDiff {
  const tables: TableDiff[] = [];
  const columns: ColumnDiff[] = [];
  const relations: RelationDiff[] = [];

  const oldTablesByName = new Map<string, Table>();
  const newTablesByName = new Map<string, Table>();
  older.tables.forEach((t) => oldTablesByName.set(t.name, t));
  newer.tables.forEach((t) => newTablesByName.set(t.name, t));

  // Tables added
  for (const t of newer.tables) {
    if (!oldTablesByName.has(t.name)) {
      tables.push({
        kind: "added",
        tableName: t.name,
        tableId: t.id,
        details: [`${t.columns.length} column${t.columns.length !== 1 ? "s" : ""}`],
      });
      t.columns.forEach((c) => {
        columns.push({ kind: "added", tableName: t.name, columnName: c.name });
      });
    }
  }

  // Tables removed
  for (const t of older.tables) {
    if (!newTablesByName.has(t.name)) {
      tables.push({
        kind: "removed",
        tableName: t.name,
        tableId: t.id,
        details: [`${t.columns.length} column${t.columns.length !== 1 ? "s" : ""}`],
      });
      t.columns.forEach((c) => {
        columns.push({ kind: "removed", tableName: t.name, columnName: c.name });
      });
    }
  }

  // Tables modified
  for (const newTable of newer.tables) {
    const oldTable = oldTablesByName.get(newTable.name);
    if (!oldTable) continue;

    const oldColsByName = new Map<string, Column>();
    const newColsByName = new Map<string, Column>();
    oldTable.columns.forEach((c) => oldColsByName.set(c.name, c));
    newTable.columns.forEach((c) => newColsByName.set(c.name, c));

    const tableDetails: string[] = [];

    // Columns added
    for (const c of newTable.columns) {
      if (!oldColsByName.has(c.name)) {
        columns.push({ kind: "added", tableName: newTable.name, columnName: c.name });
        tableDetails.push(`+${c.name}`);
      }
    }

    // Columns removed
    for (const c of oldTable.columns) {
      if (!newColsByName.has(c.name)) {
        columns.push({ kind: "removed", tableName: newTable.name, columnName: c.name });
        tableDetails.push(`-${c.name}`);
      }
    }

    // Columns modified
    for (const newCol of newTable.columns) {
      const oldCol = oldColsByName.get(newCol.name);
      if (!oldCol) continue;

      const changes: string[] = [];
      if (oldCol.type !== newCol.type) {
        changes.push(`type: ${oldCol.type} → ${newCol.type}`);
      }
      const oldConstraints = [...oldCol.constraints].sort().join(",");
      const newConstraints = [...newCol.constraints].sort().join(",");
      if (oldConstraints !== newConstraints) {
        changes.push(`constraints changed`);
      }
      if (changes.length > 0) {
        columns.push({
          kind: "modified",
          tableName: newTable.name,
          columnName: newCol.name,
          details: changes,
        });
        tableDetails.push(`~${newCol.name}`);
      }
    }

    if (tableDetails.length > 0) {
      tables.push({
        kind: "modified",
        tableName: newTable.name,
        tableId: newTable.id,
        details: tableDetails,
      });
    }
  }

  // Relations
  const relKey = (r: Relation) =>
    `${r.sourceTable}:${r.sourceColumn}->${r.targetTable}:${r.targetColumn}:${r.type}`;

  const describeRel = (r: Relation, schema: Schema) => {
    const src = schema.tables.find((t) => t.id === r.sourceTable)?.name ?? r.sourceTable;
    const tgt = schema.tables.find((t) => t.id === r.targetTable)?.name ?? r.targetTable;
    return `${src} → ${tgt} (${r.type})`;
  };

  const oldRelKeys = new Set(older.relations.map(relKey));
  const newRelKeys = new Set(newer.relations.map(relKey));

  for (const r of newer.relations) {
    if (!oldRelKeys.has(relKey(r))) {
      relations.push({ kind: "added", description: describeRel(r, newer) });
    }
  }
  for (const r of older.relations) {
    if (!newRelKeys.has(relKey(r))) {
      relations.push({ kind: "removed", description: describeRel(r, older) });
    }
  }

  const summary = {
    tablesAdded: tables.filter((t) => t.kind === "added").length,
    tablesRemoved: tables.filter((t) => t.kind === "removed").length,
    tablesModified: tables.filter((t) => t.kind === "modified").length,
    columnsAdded: columns.filter((c) => c.kind === "added").length,
    columnsRemoved: columns.filter((c) => c.kind === "removed").length,
    columnsModified: columns.filter((c) => c.kind === "modified").length,
    relationsAdded: relations.filter((r) => r.kind === "added").length,
    relationsRemoved: relations.filter((r) => r.kind === "removed").length,
  };

  return {
    tables,
    columns,
    relations,
    summary,
    hasChanges:
      tables.length > 0 || columns.length > 0 || relations.length > 0,
  };
}
