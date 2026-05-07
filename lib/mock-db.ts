import initSqlJs, { type Database } from "sql.js";
import { faker } from "@faker-js/faker";
import { generateSql } from "./sql-generator";
import type { Schema, Table, Column, ColumnType } from "./types";

// Safety: block destructive queries
const BLOCKED_PATTERNS = [
  /\bDROP\b/i,
  /\bDELETE\b/i,
  /\bTRUNCATE\b/i,
  /\bALTER\b/i,
  /\bUPDATE\b/i,
  /\bINSERT\b/i,
  /\bCREATE\b/i,
  /\bREPLACE\b/i,
];

export function validateQuery(sql: string): { valid: boolean; error?: string } {
  const trimmed = sql.trim();
  if (!trimmed) return { valid: false, error: "Query is empty" };

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(trimmed)) {
      const keyword = pattern.source.replace(/\\b/g, "");
      return {
        valid: false,
        error: `Destructive operation "${keyword}" is not allowed. Only SELECT queries are permitted.`,
      };
    }
  }

  if (!trimmed.toUpperCase().startsWith("SELECT")) {
    return {
      valid: false,
      error: "Only SELECT queries are allowed in the sandbox.",
    };
  }

  return { valid: true };
}

function generateFakeValue(col: Column, rowIndex: number): string | number | null {
  // Primary keys get sequential IDs
  if (col.constraints.includes("PRIMARY KEY")) {
    if (col.type === "SERIAL" || col.type === "INT" || col.type === "BIGINT") {
      return rowIndex + 1;
    }
    if (col.type === "UUID") return `'${faker.string.uuid()}'`;
  }

  return generateValueForType(col.type, col.name);
}

function generateValueForType(type: ColumnType, name: string): string | number | null {
  // Try to infer from column name
  const n = name.toLowerCase();

  if (n.includes("email")) return `'${faker.internet.email()}'`;
  if (n.includes("phone")) return `'${faker.phone.number()}'`;
  if (n.includes("first_name") || n === "fname") return `'${faker.person.firstName()}'`;
  if (n.includes("last_name") || n === "lname") return `'${faker.person.lastName()}'`;
  if (n.includes("name") && !n.includes("_name")) return `'${faker.person.fullName()}'`;
  if (n.includes("username")) return `'${faker.internet.username()}'`;
  if (n.includes("password")) return `'${faker.internet.password()}'`;
  if (n.includes("url") || n.includes("website")) return `'${faker.internet.url()}'`;
  if (n.includes("avatar") || n.includes("image")) return `'${faker.image.avatar()}'`;
  if (n.includes("address") || n.includes("street")) return `'${faker.location.streetAddress()}'`;
  if (n.includes("city")) return `'${faker.location.city()}'`;
  if (n.includes("state")) return `'${faker.location.state()}'`;
  if (n.includes("country")) return `'${faker.location.country()}'`;
  if (n.includes("zip") || n.includes("postal")) return `'${faker.location.zipCode()}'`;
  if (n.includes("company")) return `'${faker.company.name()}'`;
  if (n.includes("title")) return `'${faker.lorem.words(3)}'`;
  if (n.includes("description") || n.includes("bio") || n.includes("content")) return `'${faker.lorem.sentence()}'`;
  if (n.includes("price") || n.includes("amount") || n.includes("cost")) return Number(faker.commerce.price({ min: 1, max: 999 }));
  if (n.includes("quantity") || n.includes("count") || n.includes("stock")) return faker.number.int({ min: 0, max: 100 });
  if (n.includes("status")) return `'${faker.helpers.arrayElement(["active", "inactive", "pending"])}'`;
  if (n.includes("category")) return `'${faker.commerce.department()}'`;
  if (n.includes("color")) return `'${faker.color.human()}'`;
  if (n.includes("rating") || n.includes("score")) return faker.number.float({ min: 1, max: 5, fractionDigits: 1 });

  // Fall back to type-based generation
  switch (type) {
    case "INT":
    case "BIGINT":
    case "SMALLINT":
    case "SERIAL":
      return faker.number.int({ min: 1, max: 10000 });
    case "FLOAT":
    case "DOUBLE":
    case "DECIMAL":
      return faker.number.float({ min: 0, max: 1000, fractionDigits: 2 });
    case "BOOLEAN":
      return faker.datatype.boolean() ? 1 : 0;
    case "VARCHAR":
    case "TEXT":
    case "CHAR":
      return `'${faker.lorem.words(2).replace(/'/g, "''")}'`;
    case "DATE":
      return `'${faker.date.past().toISOString().split("T")[0]}'`;
    case "TIMESTAMP":
    case "DATETIME":
      return `'${faker.date.past().toISOString()}'`;
    case "TIME":
      return `'${faker.date.past().toISOString().split("T")[1].split(".")[0]}'`;
    case "JSON":
      return `'{}'`;
    case "UUID":
      return `'${faker.string.uuid()}'`;
    case "BLOB":
      return "NULL";
    default:
      return "NULL";
  }
}

function generateInsertStatements(
  table: Table,
  allTables: Table[],
  schema: Schema,
  rowCount: number,
  parentRowCounts: Map<string, number>
): string[] {
  const statements: string[] = [];

  // Find FK columns and pin their `maxId` to the *actual* parent row count
  // we already inserted (parent-first via topologicalSort). Earlier this
  // was hard-coded to `rowCount`, which produced FK values pointing past
  // the parent table when the parent had fewer rows — silently corrupt
  // data in SQLite (no FK enforcement on by default) or visible failures
  // elsewhere.
  const fkColumns = new Map<string, { tableName: string; maxId: number }>();
  for (const rel of schema.relations) {
    if (rel.sourceTable === table.id) {
      const targetTable = allTables.find((t) => t.id === rel.targetTable);
      const sourceCol = table.columns.find((c) => c.id === rel.sourceColumn);
      if (targetTable && sourceCol) {
        const actualParent = parentRowCounts.get(targetTable.id) ?? 0;
        fkColumns.set(sourceCol.name, {
          tableName: targetTable.name,
          maxId: actualParent,
        });
      }
    }
  }

  for (let i = 0; i < rowCount; i++) {
    const colNames = table.columns.map((c) => `"${c.name}"`).join(", ");
    const values = table.columns
      .map((col) => {
        // FK columns: pick a valid parent id from [1..parentRowCount].
        // If the parent has zero rows (cyclic graph, missing data), emit
        // NULL so the row at least inserts cleanly when nullable.
        const fk = fkColumns.get(col.name);
        if (fk) {
          if (fk.maxId === 0) return "NULL";
          return faker.number.int({ min: 1, max: fk.maxId });
        }
        return generateFakeValue(col, i);
      })
      .join(", ");

    statements.push(
      `INSERT INTO "${table.name}" (${colNames}) VALUES (${values});`
    );
  }

  return statements;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
}

// Hard caps so an accidental cartesian join + huge dataset can't lock the
// browser tab. sql.js runs synchronously on the main thread; the only way
// to truly interrupt it is `Worker.terminate()`. Until we move execution
// into a Web Worker, these input bounds + a soft post-execution warning
// are the practical guardrail.
const MAX_ROWS_PER_TABLE = 500;
const MAX_TOTAL_INSERT_ROWS = 5_000;
const MAX_QUERY_LEN = 10_000;
const SOFT_EXEC_WARN_MS = 5_000;

export async function runMockQuery(
  schema: Schema,
  query: string,
  rowsPerTable: number = 10
): Promise<QueryResult> {
  // Validate
  const validation = validateQuery(query);
  if (!validation.valid) {
    throw new Error(validation.error);
  }

  // Bound the query and the dataset size BEFORE any heavy work so a runaway
  // request fails fast with a clear error instead of pinning the tab.
  if (query.length > MAX_QUERY_LEN) {
    throw new Error(
      `Query is too long (${query.length} chars). Max ${MAX_QUERY_LEN}.`
    );
  }
  const safeRowsPerTable = Math.max(
    1,
    Math.min(rowsPerTable, MAX_ROWS_PER_TABLE)
  );
  const tableCount = schema.tables.length;
  if (tableCount * safeRowsPerTable > MAX_TOTAL_INSERT_ROWS) {
    throw new Error(
      `Mock dataset would exceed ${MAX_TOTAL_INSERT_ROWS} rows (${tableCount} tables × ${safeRowsPerTable} rows). Reduce rows-per-table.`
    );
  }

  // Init sql.js
  const SQL = await initSqlJs({
    locateFile: (file: string) => `/${file}`,
  });
  const db: Database = new SQL.Database();

  try {
    // Create tables using SQLite dialect
    const createSql = generateSql(schema, "sqlite");
    // Execute each statement separately
    for (const stmt of createSql.split(";").filter((s) => s.trim() && !s.trim().startsWith("--"))) {
      db.run(stmt + ";");
    }

    // Sort tables: insert referenced tables first (simple topological sort).
    // Track the actual rowsPerTable count we successfully inserted so child
    // tables can pick FK values from the real parent id range, not the
    // hard-coded `rowCount` that used to produce orphan FKs when a parent
    // table inserted fewer rows than configured.
    const tableOrder = topologicalSort(schema);
    const parentRowCounts = new Map<string, number>();

    for (const table of tableOrder) {
      const inserts = generateInsertStatements(
        table,
        schema.tables,
        schema,
        safeRowsPerTable,
        parentRowCounts
      );
      let inserted = 0;
      for (const insert of inserts) {
        try {
          db.run(insert);
          inserted += 1;
        } catch {
          // Skip failed inserts (FK violations on random data) — but the
          // counter only credits rows that actually landed.
        }
      }
      parentRowCounts.set(table.id, inserted);
    }

    // Run the query
    const start = performance.now();
    const results = db.exec(query);
    const executionTimeMs = Math.round((performance.now() - start) * 100) / 100;
    if (executionTimeMs > SOFT_EXEC_WARN_MS) {
      // sql.js is synchronous; we can't kill mid-execution from outside.
      // Surfacing the slow run in the response lets the UI tell the user
      // their query is expensive even though it ran to completion.
      console.warn(
        `runMockQuery: slow query (${executionTimeMs}ms): ${query.slice(0, 80)}…`
      );
    }

    if (results.length === 0) {
      return { columns: [], rows: [], rowCount: 0, executionTimeMs };
    }

    const result = results[0];
    const columns = result.columns;
    const rows = result.values.map((row) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        obj[col] = row[i];
      });
      return obj;
    });

    return { columns, rows, rowCount: rows.length, executionTimeMs };
  } finally {
    db.close();
  }
}

function topologicalSort(schema: Schema): Table[] {
  const visited = new Set<string>();
  const sorted: Table[] = [];
  const tableMap = new Map(schema.tables.map((t) => [t.id, t]));

  // Find tables that are referenced (should be inserted first)
  const referencedBy = new Map<string, Set<string>>();
  for (const rel of schema.relations) {
    if (!referencedBy.has(rel.sourceTable)) {
      referencedBy.set(rel.sourceTable, new Set());
    }
    referencedBy.get(rel.sourceTable)!.add(rel.targetTable);
  }

  function visit(tableId: string) {
    if (visited.has(tableId)) return;
    visited.add(tableId);
    // Visit dependencies first
    const deps = referencedBy.get(tableId);
    if (deps) {
      for (const dep of deps) {
        visit(dep);
      }
    }
    const table = tableMap.get(tableId);
    if (table) sorted.push(table);
  }

  for (const table of schema.tables) {
    visit(table.id);
  }

  return sorted;
}
