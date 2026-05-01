import type { Schema, Table } from "./types";

export type LintSeverity = "error" | "warning" | "info";

export interface LintIssue {
  id: string;
  severity: LintSeverity;
  rule: string;
  message: string;
  tableId?: string;
  columnId?: string;
}

const SNAKE_CASE = /^[a-z][a-z0-9_]*$/;
const RESERVED_WORDS = new Set([
  "select",
  "from",
  "where",
  "table",
  "user",
  "order",
  "group",
  "join",
  "index",
  "primary",
  "key",
  "default",
]);

export function lintSchema(schema: Schema): LintIssue[] {
  const issues: LintIssue[] = [];
  const tableNames = new Set(schema.tables.map((t) => t.name));
  const tableIdsWithRelations = new Set<string>();
  schema.relations.forEach((r) => {
    tableIdsWithRelations.add(r.sourceTable);
    tableIdsWithRelations.add(r.targetTable);
  });

  // Duplicate table names
  const nameCounts = new Map<string, Table[]>();
  schema.tables.forEach((t) => {
    if (!nameCounts.has(t.name)) nameCounts.set(t.name, []);
    nameCounts.get(t.name)!.push(t);
  });
  nameCounts.forEach((tables, name) => {
    if (tables.length > 1) {
      tables.forEach((t) => {
        issues.push({
          id: `dup-table-${t.id}`,
          severity: "error",
          rule: "unique-table-name",
          message: `Duplicate table name "${name}"`,
          tableId: t.id,
        });
      });
    }
  });

  schema.tables.forEach((table) => {
    // Naming
    if (!SNAKE_CASE.test(table.name)) {
      issues.push({
        id: `case-table-${table.id}`,
        severity: "warning",
        rule: "snake-case-table",
        message: `Table "${table.name}" is not snake_case`,
        tableId: table.id,
      });
    }
    if (RESERVED_WORDS.has(table.name.toLowerCase())) {
      issues.push({
        id: `reserved-table-${table.id}`,
        severity: "warning",
        rule: "reserved-word",
        message: `Table name "${table.name}" is a SQL reserved word`,
        tableId: table.id,
      });
    }

    // Empty / no PK
    if (table.columns.length === 0) {
      issues.push({
        id: `empty-${table.id}`,
        severity: "error",
        rule: "empty-table",
        message: `Table "${table.name}" has no columns`,
        tableId: table.id,
      });
    } else {
      const hasPk = table.columns.some((c) =>
        c.constraints.includes("PRIMARY KEY")
      );
      if (!hasPk) {
        issues.push({
          id: `no-pk-${table.id}`,
          severity: "warning",
          rule: "no-primary-key",
          message: `Table "${table.name}" has no primary key`,
          tableId: table.id,
        });
      }
    }

    // Per-column checks
    const colNames = new Map<string, number>();
    table.columns.forEach((col) => {
      colNames.set(col.name, (colNames.get(col.name) ?? 0) + 1);

      if (!col.name.trim()) {
        issues.push({
          id: `noname-${col.id}`,
          severity: "error",
          rule: "missing-column-name",
          message: `Column in "${table.name}" has no name`,
          tableId: table.id,
          columnId: col.id,
        });
      } else if (!SNAKE_CASE.test(col.name)) {
        issues.push({
          id: `case-col-${col.id}`,
          severity: "warning",
          rule: "snake-case-column",
          message: `Column "${table.name}.${col.name}" is not snake_case`,
          tableId: table.id,
          columnId: col.id,
        });
      }
      if (!col.type) {
        issues.push({
          id: `notype-${col.id}`,
          severity: "error",
          rule: "missing-column-type",
          message: `Column "${table.name}.${col.name}" has no type`,
          tableId: table.id,
          columnId: col.id,
        });
      }
      // FK target validity
      if (col.references) {
        if (!tableNames.has(col.references.table)) {
          issues.push({
            id: `fk-bad-${col.id}`,
            severity: "error",
            rule: "fk-missing-table",
            message: `Column "${table.name}.${col.name}" references missing table "${col.references.table}"`,
            tableId: table.id,
            columnId: col.id,
          });
        } else {
          const target = schema.tables.find(
            (t) => t.name === col.references!.table
          );
          if (
            target &&
            !target.columns.some((c) => c.name === col.references!.column)
          ) {
            issues.push({
              id: `fk-col-${col.id}`,
              severity: "error",
              rule: "fk-missing-column",
              message: `Column "${table.name}.${col.name}" references missing column "${col.references.table}.${col.references.column}"`,
              tableId: table.id,
              columnId: col.id,
            });
          }
        }
      }
    });

    // Duplicate column names within table
    colNames.forEach((count, name) => {
      if (count > 1) {
        issues.push({
          id: `dup-col-${table.id}-${name}`,
          severity: "error",
          rule: "unique-column-name",
          message: `Table "${table.name}" has duplicate column "${name}"`,
          tableId: table.id,
        });
      }
    });

    // Orphan tables (no relations) — informational only, skip if 1 table total
    if (
      schema.tables.length > 1 &&
      !tableIdsWithRelations.has(table.id) &&
      schema.relations.length > 0
    ) {
      issues.push({
        id: `orphan-${table.id}`,
        severity: "info",
        rule: "orphan-table",
        message: `Table "${table.name}" has no relations`,
        tableId: table.id,
      });
    }
  });

  // Relations referencing missing tables/columns
  schema.relations.forEach((r) => {
    const src = schema.tables.find((t) => t.id === r.sourceTable);
    const tgt = schema.tables.find((t) => t.id === r.targetTable);
    if (!src || !tgt) {
      issues.push({
        id: `rel-missing-${r.id}`,
        severity: "error",
        rule: "relation-missing-table",
        message: `Relation references a deleted table`,
      });
    }
  });

  return issues;
}

export function summarizeIssues(issues: LintIssue[]) {
  return {
    error: issues.filter((i) => i.severity === "error").length,
    warning: issues.filter((i) => i.severity === "warning").length,
    info: issues.filter((i) => i.severity === "info").length,
  };
}
