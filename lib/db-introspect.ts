import "server-only";
import { Client } from "pg";
import mysql, { type RowDataPacket } from "mysql2/promise";
import type {
  Column,
  ColumnConstraint,
  ColumnType,
  Relation,
  Schema,
  Table,
  TableIndex,
} from "./types";
import { TABLE_COLORS } from "./types";

export type IntrospectDialect = "postgresql" | "mysql";

const MAX_TABLES = 200;
const CONN_TIMEOUT_MS = 8000;
const QUERY_TIMEOUT_MS = 15000;

function genId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(
    Math.random() * 1e9
  ).toString(36)}`;
}

// Best-effort coercion of a vendor type string to our ColumnType enum. Falls
// back to VARCHAR for anything we don't recognize. Names are intentionally
// case-insensitive substring matches — vendor strings vary ("character varying",
// "int8", "timestamp without time zone", etc).
function mapDbType(raw: string): ColumnType {
  const t = raw.toLowerCase();
  if (t.includes("uuid")) return "UUID";
  if (t.includes("bigserial") || t.includes("bigint")) return "BIGINT";
  if (t.includes("smallserial") || t.includes("smallint")) return "SMALLINT";
  if (t.includes("serial")) return "SERIAL";
  if (t.includes("int")) return "INT";
  if (t.includes("double") || t.includes("real")) return "DOUBLE";
  if (t.includes("float")) return "FLOAT";
  if (t.includes("decimal") || t.includes("numeric")) return "DECIMAL";
  if (t.includes("bool") || t === "tinyint(1)") return "BOOLEAN";
  if (t.includes("jsonb") || t.includes("json")) return "JSON";
  if (t.includes("blob") || t.includes("bytea")) return "BLOB";
  if (t.includes("timestamp")) return "TIMESTAMP";
  if (t.includes("datetime")) return "DATETIME";
  if (t.includes("date")) return "DATE";
  if (t.includes("time")) return "TIME";
  if (t.includes("text")) return "TEXT";
  if (t.includes("char")) return "VARCHAR";
  return "VARCHAR";
}

function gridPosition(i: number): { x: number; y: number } {
  const COLS = 4;
  return { x: (i % COLS) * 320 + 60, y: Math.floor(i / COLS) * 280 + 60 };
}

interface RawColumn {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

interface RawConstraint {
  table_name: string;
  column_name: string;
  constraint_type: string;
}

interface RawForeignKey {
  src_table: string;
  src_column: string;
  tgt_table: string;
  tgt_column: string;
}

interface RawIndex {
  table_name: string;
  index_name: string;
  column_name: string;
  is_unique: boolean;
  is_primary: boolean;
}

// ─── Postgres ───────────────────────────────────────────────────────────

async function introspectPostgres(connectionString: string): Promise<Schema> {
  const client = new Client({
    connectionString,
    statement_timeout: QUERY_TIMEOUT_MS,
    connectionTimeoutMillis: CONN_TIMEOUT_MS,
  });
  await client.connect();
  try {
    const colsRes = await client.query<RawColumn>(
      `SELECT table_name, column_name, data_type, is_nullable, column_default
       FROM information_schema.columns
       WHERE table_schema = current_schema()
       ORDER BY table_name, ordinal_position`
    );
    const conRes = await client.query<RawConstraint>(
      `SELECT tc.table_name, kcu.column_name, tc.constraint_type
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = current_schema()
         AND tc.constraint_type IN ('PRIMARY KEY', 'UNIQUE')`
    );
    const fkRes = await client.query<RawForeignKey>(
      `SELECT
         tc.table_name AS src_table,
         kcu.column_name AS src_column,
         ccu.table_name AS tgt_table,
         ccu.column_name AS tgt_column
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_schema = current_schema()`
    );
    const idxRes = await client.query<RawIndex>(
      `SELECT
         t.relname AS table_name,
         i.relname AS index_name,
         a.attname AS column_name,
         ix.indisunique AS is_unique,
         ix.indisprimary AS is_primary
       FROM pg_class t
       JOIN pg_index ix ON t.oid = ix.indrelid
       JOIN pg_class i ON i.oid = ix.indexrelid
       JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
       JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE t.relkind = 'r'
         AND n.nspname = current_schema()`
    );

    return assembleSchema(
      colsRes.rows,
      conRes.rows,
      fkRes.rows,
      idxRes.rows
    );
  } finally {
    await client.end().catch(() => {});
  }
}

// ─── MySQL ──────────────────────────────────────────────────────────────

async function introspectMysql(connectionString: string): Promise<Schema> {
  const conn = await mysql.createConnection({
    uri: connectionString,
    connectTimeout: CONN_TIMEOUT_MS,
  });
  try {
    const [colRows] = await conn.query<RowDataPacket[]>(
      `SELECT TABLE_NAME AS table_name,
              COLUMN_NAME AS column_name,
              COLUMN_TYPE AS data_type,
              IS_NULLABLE AS is_nullable,
              COLUMN_DEFAULT AS column_default,
              EXTRA AS extra
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
       ORDER BY table_name, ordinal_position`
    );
    const [conRows] = await conn.query<RowDataPacket[]>(
      `SELECT tc.TABLE_NAME AS table_name,
              kcu.COLUMN_NAME AS column_name,
              tc.CONSTRAINT_TYPE AS constraint_type
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = DATABASE()
         AND tc.CONSTRAINT_TYPE IN ('PRIMARY KEY', 'UNIQUE')`
    );
    const [fkRows] = await conn.query<RowDataPacket[]>(
      `SELECT TABLE_NAME AS src_table,
              COLUMN_NAME AS src_column,
              REFERENCED_TABLE_NAME AS tgt_table,
              REFERENCED_COLUMN_NAME AS tgt_column
       FROM information_schema.key_column_usage
       WHERE table_schema = DATABASE()
         AND REFERENCED_TABLE_NAME IS NOT NULL`
    );
    const [idxRows] = await conn.query<RowDataPacket[]>(
      `SELECT TABLE_NAME AS table_name,
              INDEX_NAME AS index_name,
              COLUMN_NAME AS column_name,
              (NON_UNIQUE = 0) AS is_unique,
              (INDEX_NAME = 'PRIMARY') AS is_primary
       FROM information_schema.statistics
       WHERE table_schema = DATABASE()`
    );

    // MySQL EXTRA contains "auto_increment" for SERIAL-ish columns. Promote.
    const cols = colRows.map((r) => {
      const c: RawColumn & { extra?: string } = {
        table_name: String(r.table_name),
        column_name: String(r.column_name),
        data_type: String(r.data_type),
        is_nullable: String(r.is_nullable),
        column_default:
          r.column_default == null ? null : String(r.column_default),
        extra: r.extra ? String(r.extra).toLowerCase() : "",
      };
      return c;
    });

    return assembleSchema(
      cols,
      conRows.map((r) => ({
        table_name: String(r.table_name),
        column_name: String(r.column_name),
        constraint_type: String(r.constraint_type),
      })),
      fkRows.map((r) => ({
        src_table: String(r.src_table),
        src_column: String(r.src_column),
        tgt_table: String(r.tgt_table),
        tgt_column: String(r.tgt_column),
      })),
      idxRows.map((r) => ({
        table_name: String(r.table_name),
        index_name: String(r.index_name),
        column_name: String(r.column_name),
        is_unique: !!r.is_unique,
        is_primary: !!r.is_primary,
      }))
    );
  } finally {
    await conn.end().catch(() => {});
  }
}

// ─── Assembly ───────────────────────────────────────────────────────────

function assembleSchema(
  cols: (RawColumn & { extra?: string })[],
  constraints: RawConstraint[],
  fks: RawForeignKey[],
  indexes: RawIndex[]
): Schema {
  // Group columns by table preserving order
  const byTable = new Map<string, (RawColumn & { extra?: string })[]>();
  for (const c of cols) {
    if (!byTable.has(c.table_name)) byTable.set(c.table_name, []);
    byTable.get(c.table_name)!.push(c);
  }

  if (byTable.size === 0) {
    return { tables: [], relations: [] };
  }
  if (byTable.size > MAX_TABLES) {
    throw new Error(
      `Schema has ${byTable.size} tables — too many to import (limit ${MAX_TABLES}). Use a smaller schema or a filtered view.`
    );
  }

  // Build constraint lookup: tableName.columnName → Set<constraintType>
  const conKey = (t: string, c: string) => `${t}::${c}`;
  const constraintSet = new Map<string, Set<string>>();
  for (const c of constraints) {
    const k = conKey(c.table_name, c.column_name);
    if (!constraintSet.has(k)) constraintSet.set(k, new Set());
    constraintSet.get(k)!.add(c.constraint_type.toUpperCase());
  }

  // FK lookup for column-level REFERENCES marker
  const fkColKey = new Set(fks.map((f) => conKey(f.src_table, f.src_column)));

  const tableIdByName = new Map<string, string>();
  const colIdByTableCol = new Map<string, Map<string, string>>();
  const tables: Table[] = [];

  let tableIdx = 0;
  for (const [tableName, columns] of byTable) {
    const tableId = genId("tbl");
    tableIdByName.set(tableName, tableId);

    const colMap = new Map<string, string>();
    const tableColumns: Column[] = columns.map((c) => {
      const colId = genId("col");
      colMap.set(c.column_name, colId);
      const cons: ColumnConstraint[] = [];
      const conTypes = constraintSet.get(conKey(tableName, c.column_name));
      if (conTypes?.has("PRIMARY KEY")) cons.push("PRIMARY KEY");
      if (conTypes?.has("UNIQUE") && !cons.includes("PRIMARY KEY")) {
        cons.push("UNIQUE");
      }
      if (c.is_nullable === "NO" && !cons.includes("PRIMARY KEY")) {
        cons.push("NOT NULL");
      }
      if (c.extra?.includes("auto_increment")) cons.push("AUTO_INCREMENT");
      if (c.column_default != null) cons.push("DEFAULT");
      if (fkColKey.has(conKey(tableName, c.column_name))) cons.push("REFERENCES");

      // Postgres SERIAL: data_type often "integer" with a default like
      // nextval('seq'). Promote to SERIAL for nicer UX.
      let mappedType = mapDbType(c.data_type);
      if (
        mappedType === "INT" &&
        c.column_default &&
        c.column_default.includes("nextval")
      ) {
        mappedType = "SERIAL";
      }

      return {
        id: colId,
        name: c.column_name,
        type: mappedType,
        constraints: cons,
        comment: "",
        defaultValue: c.column_default ?? undefined,
      };
    });
    colIdByTableCol.set(tableName, colMap);

    // Group indexes by name, dedupe out the implicit PK / UNIQUE constraint
    // indexes (already represented as column constraints).
    const tableIndexes = new Map<string, RawIndex[]>();
    for (const i of indexes) {
      if (i.table_name !== tableName) continue;
      if (i.is_primary) continue;
      // Skip auto-named UNIQUE indexes that mirror a column UNIQUE constraint.
      if (
        i.is_unique &&
        constraintSet
          .get(conKey(tableName, i.column_name))
          ?.has("UNIQUE")
      ) {
        // Likely the implicit constraint index — skip.
        continue;
      }
      if (!tableIndexes.has(i.index_name)) tableIndexes.set(i.index_name, []);
      tableIndexes.get(i.index_name)!.push(i);
    }
    const indexList: TableIndex[] = [];
    for (const [name, rows] of tableIndexes) {
      const colIds = rows
        .map((r) => colMap.get(r.column_name))
        .filter((id): id is string => !!id);
      if (colIds.length === 0) continue;
      indexList.push({
        id: genId("idx"),
        name,
        columns: colIds,
        unique: rows.some((r) => r.is_unique),
      });
    }

    tables.push({
      id: tableId,
      name: tableName,
      color: TABLE_COLORS[tableIdx % TABLE_COLORS.length],
      columns: tableColumns,
      indexes: indexList,
      comment: "",
      position: gridPosition(tableIdx),
    });
    tableIdx++;
  }

  // Build relations from FKs
  const relations: Relation[] = [];
  for (const fk of fks) {
    const sId = tableIdByName.get(fk.src_table);
    const tId = tableIdByName.get(fk.tgt_table);
    const sc = colIdByTableCol.get(fk.src_table)?.get(fk.src_column);
    const tc = colIdByTableCol.get(fk.tgt_table)?.get(fk.tgt_column);
    if (!sId || !tId || !sc || !tc) continue;
    // Wire source column with the references metadata so SQL/Models codegen
    // can render the FK.
    const srcTable = tables.find((t) => t.id === sId);
    const srcCol = srcTable?.columns.find((c) => c.id === sc);
    if (srcCol) {
      srcCol.references = { table: fk.tgt_table, column: fk.tgt_column };
    }
    relations.push({
      id: genId("rel"),
      sourceTable: sId,
      sourceColumn: sc,
      targetTable: tId,
      targetColumn: tc,
      type: "one-to-many",
    });
  }

  return { tables, relations };
}

export async function introspectDatabase(
  dialect: IntrospectDialect,
  connectionString: string
): Promise<Schema> {
  if (dialect === "postgresql") return introspectPostgres(connectionString);
  return introspectMysql(connectionString);
}
