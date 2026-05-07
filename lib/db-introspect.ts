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

export type IntrospectDialect = "postgresql" | "mysql" | "mssql" | "oracle";

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
  if (t.includes("uuid") || t.includes("uniqueidentifier")) return "UUID";
  if (t.includes("bigserial") || t.includes("bigint")) return "BIGINT";
  if (t.includes("smallserial") || t.includes("smallint") || t === "tinyint")
    return "SMALLINT";
  if (t.includes("serial")) return "SERIAL";
  if (
    t === "binary_double" ||
    t === "binary_float" ||
    t.includes("double") ||
    t.includes("real")
  )
    return t.includes("float") || t === "binary_float" ? "FLOAT" : "DOUBLE";
  if (t.includes("float")) return "FLOAT";
  if (t.includes("decimal") || t.includes("numeric") || t.includes("money") || t === "number")
    return "DECIMAL";
  if (t.includes("int")) return "INT";
  if (t.includes("bool") || t === "tinyint(1)" || t === "bit") return "BOOLEAN";
  if (t.includes("jsonb") || t.includes("json")) return "JSON";
  if (
    t.includes("blob") ||
    t.includes("bytea") ||
    t.includes("varbinary") ||
    t === "raw" ||
    t === "long raw" ||
    t === "bfile" ||
    t === "image" ||
    t === "rowversion"
  )
    return "BLOB";
  if (t.includes("timestamp")) return "TIMESTAMP";
  if (t.includes("datetime")) return "DATETIME";
  if (t.includes("date")) return "DATE";
  if (t.includes("time")) return "TIME";
  // Oracle CLOB / NCLOB are large text.
  if (t.includes("clob") || t.includes("text") || t.includes("ntext")) return "TEXT";
  if (t.includes("char")) return "VARCHAR";
  // Oracle bare NUMBER → DECIMAL (covered above), VARCHAR2 → handled below.
  if (t.includes("varchar")) return "VARCHAR";
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

// ─── SQL Server (T-SQL) ────────────────────────────────────────────────

async function introspectMssql(connectionString: string): Promise<Schema> {
  // Lazy-import so the package isn't pulled into bundles where it isn't used.
  const mssql = await import("mssql");
  const config = {
    ...parseMssqlConn(connectionString),
    requestTimeout: QUERY_TIMEOUT_MS,
    connectionTimeout: CONN_TIMEOUT_MS,
  } as unknown as import("mssql").config;
  const pool = new mssql.ConnectionPool(config);
  await pool.connect();
  try {
    const colsRes = await pool.request().query<{
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
      is_identity: number;
    }>(
      `SELECT
         c.TABLE_NAME AS table_name,
         c.COLUMN_NAME AS column_name,
         c.DATA_TYPE AS data_type,
         c.IS_NULLABLE AS is_nullable,
         c.COLUMN_DEFAULT AS column_default,
         COLUMNPROPERTY(OBJECT_ID(c.TABLE_SCHEMA + '.' + c.TABLE_NAME), c.COLUMN_NAME, 'IsIdentity') AS is_identity
       FROM INFORMATION_SCHEMA.COLUMNS c
       JOIN INFORMATION_SCHEMA.TABLES t
         ON t.TABLE_NAME = c.TABLE_NAME AND t.TABLE_SCHEMA = c.TABLE_SCHEMA
       WHERE t.TABLE_TYPE = 'BASE TABLE'
         AND c.TABLE_SCHEMA = SCHEMA_NAME()
       ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION`
    );

    const conRes = await pool.request().query<{
      table_name: string;
      column_name: string;
      constraint_type: string;
    }>(
      `SELECT
         tc.TABLE_NAME AS table_name,
         kcu.COLUMN_NAME AS column_name,
         tc.CONSTRAINT_TYPE AS constraint_type
       FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
       JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
         ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
        AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
       WHERE tc.TABLE_SCHEMA = SCHEMA_NAME()
         AND tc.CONSTRAINT_TYPE IN ('PRIMARY KEY', 'UNIQUE')`
    );

    const fkRes = await pool.request().query<{
      src_table: string;
      src_column: string;
      tgt_table: string;
      tgt_column: string;
    }>(
      `SELECT
         OBJECT_NAME(fk.parent_object_id) AS src_table,
         pc.name AS src_column,
         OBJECT_NAME(fk.referenced_object_id) AS tgt_table,
         rc.name AS tgt_column
       FROM sys.foreign_keys fk
       JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
       JOIN sys.columns pc
         ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
       JOIN sys.columns rc
         ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
       WHERE SCHEMA_NAME(fk.schema_id) = SCHEMA_NAME()`
    );

    const idxRes = await pool.request().query<{
      table_name: string;
      index_name: string;
      column_name: string;
      is_unique: number;
      is_primary: number;
    }>(
      `SELECT
         OBJECT_NAME(i.object_id) AS table_name,
         i.name AS index_name,
         c.name AS column_name,
         CAST(i.is_unique AS INT) AS is_unique,
         CAST(i.is_primary_key AS INT) AS is_primary
       FROM sys.indexes i
       JOIN sys.index_columns ic
         ON ic.object_id = i.object_id AND ic.index_id = i.index_id
       JOIN sys.columns c
         ON c.object_id = ic.object_id AND c.column_id = ic.column_id
       JOIN sys.tables t ON t.object_id = i.object_id
       WHERE i.name IS NOT NULL
         AND SCHEMA_NAME(t.schema_id) = SCHEMA_NAME()`
    );

    const cols = colsRes.recordset.map((r) => ({
      table_name: String(r.table_name),
      column_name: String(r.column_name),
      data_type: String(r.data_type),
      is_nullable: String(r.is_nullable),
      column_default: r.column_default == null ? null : String(r.column_default),
      extra: r.is_identity === 1 ? "auto_increment" : "",
    }));

    return assembleSchema(
      cols,
      conRes.recordset.map((r) => ({
        table_name: String(r.table_name),
        column_name: String(r.column_name),
        constraint_type: String(r.constraint_type),
      })),
      fkRes.recordset.map((r) => ({
        src_table: String(r.src_table),
        src_column: String(r.src_column),
        tgt_table: String(r.tgt_table),
        tgt_column: String(r.tgt_column),
      })),
      idxRes.recordset.map((r) => ({
        table_name: String(r.table_name),
        index_name: String(r.index_name),
        column_name: String(r.column_name),
        is_unique: r.is_unique === 1,
        is_primary: r.is_primary === 1,
      }))
    );
  } finally {
    await pool.close().catch(() => {});
  }
}

// Accepts either an ADO-style connection string or a URL form
// (mssql://user:pass@host:port/db?option=value). Returns a node-mssql config
// object. Defaults Encrypt=true and TrustServerCertificate=true so localhost
// dev installs and Azure SQL both work.
function parseMssqlConn(input: string): Record<string, unknown> {
  const trimmed = input.trim();
  const baseOptions = { encrypt: true, trustServerCertificate: true };

  if (/^mssql(?:\+tedious)?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed.replace(/^mssql\+tedious:\/\//i, "mssql://"));
    const port = url.port ? Number(url.port) : 1433;
    const database = decodeURIComponent(url.pathname.replace(/^\//, "")) || "master";
    const user = decodeURIComponent(url.username || "");
    const password = decodeURIComponent(url.password || "");
    const opts: Record<string, unknown> = {
      server: url.hostname,
      port,
      database,
      user,
      password,
      options: { ...baseOptions },
    };
    const encrypt = url.searchParams.get("encrypt");
    const trust = url.searchParams.get("trustServerCertificate");
    if (encrypt != null) (opts.options as Record<string, unknown>).encrypt = encrypt === "true";
    if (trust != null)
      (opts.options as Record<string, unknown>).trustServerCertificate = trust === "true";
    return opts;
  }

  // ADO-style: "Server=host,port;Database=db;User Id=u;Password=p;Encrypt=true"
  const pairs = trimmed
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
  const map = new Map<string, string>();
  for (const p of pairs) {
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    map.set(p.slice(0, eq).trim().toLowerCase(), p.slice(eq + 1).trim());
  }
  const serverRaw = map.get("server") ?? map.get("data source") ?? "localhost";
  const [serverHost, serverPort] = serverRaw.split(/[,:]/);
  const opts: Record<string, unknown> = {
    server: serverHost,
    port: serverPort ? Number(serverPort) : 1433,
    database: map.get("database") ?? map.get("initial catalog") ?? "master",
    user: map.get("user id") ?? map.get("uid") ?? map.get("user"),
    password: map.get("password") ?? map.get("pwd"),
    options: {
      encrypt: (map.get("encrypt") ?? "true").toLowerCase() !== "false",
      trustServerCertificate:
        (map.get("trustservercertificate") ?? "true").toLowerCase() !== "false",
    },
  };
  return opts;
}

// ─── Oracle (oracledb thin mode) ───────────────────────────────────────

async function introspectOracle(connectionString: string): Promise<Schema> {
  // Lazy-import so the package isn't pulled into bundles where it isn't
  // used. oracledb 6+ defaults to "thin mode" — pure JS, no Instant Client
  // required — which is what we want.
  // No published @types package; cast through the loose shape we use.
  type OracleConn = {
    execute: (
      sql: string,
      bindParams?: unknown,
      options?: { outFormat?: number }
    ) => Promise<{ rows?: Record<string, unknown>[] }>;
    close: () => Promise<void>;
  };
  type OracleDb = {
    OUT_FORMAT_OBJECT: number;
    getConnection: (cfg: unknown) => Promise<OracleConn>;
  };
  // @ts-expect-error -- no @types/oracledb published; we type the surface
  // we use via OracleDb / OracleConn above.
  const mod = (await import("oracledb")) as unknown as { default: OracleDb };
  const oracledb = mod.default;

  const config = parseOracleConn(connectionString);
  const pool = await oracledb.getConnection(config);
  try {
    type Row = Record<string, unknown>;
    const exec = async (sql: string): Promise<Row[]> => {
      const r = await pool.execute(sql, [], {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });
      return (r.rows ?? []) as Row[];
    };

    // user_tab_columns lists columns owned by the connected user — same
    // semantics as `current_schema()` in Postgres. We deliberately scope
    // to the user's own schema; cross-schema introspection requires
    // privileges most app users don't have.
    const colRows = await exec(
      `SELECT
         table_name AS "table_name",
         column_name AS "column_name",
         data_type AS "data_type",
         data_length AS "data_length",
         nullable AS "nullable",
         data_default AS "column_default",
         identity_column AS "is_identity"
       FROM user_tab_columns
       ORDER BY table_name, column_id`
    );

    const conRows = await exec(
      `SELECT
         c.table_name AS "table_name",
         cc.column_name AS "column_name",
         c.constraint_type AS "constraint_type"
       FROM user_constraints c
       JOIN user_cons_columns cc ON cc.constraint_name = c.constraint_name
       WHERE c.constraint_type IN ('P','U')`
    );

    const fkRows = await exec(
      `SELECT
         c.table_name AS "src_table",
         cc.column_name AS "src_column",
         rcc.table_name AS "tgt_table",
         rcc.column_name AS "tgt_column"
       FROM user_constraints c
       JOIN user_cons_columns cc
         ON cc.constraint_name = c.constraint_name
       JOIN user_cons_columns rcc
         ON rcc.constraint_name = c.r_constraint_name
        AND rcc.position = cc.position
       WHERE c.constraint_type = 'R'`
    );

    const idxRows = await exec(
      `SELECT
         i.table_name AS "table_name",
         i.index_name AS "index_name",
         ic.column_name AS "column_name",
         CASE WHEN i.uniqueness = 'UNIQUE' THEN 1 ELSE 0 END AS "is_unique",
         CASE WHEN c.constraint_type = 'P' THEN 1 ELSE 0 END AS "is_primary"
       FROM user_indexes i
       JOIN user_ind_columns ic
         ON ic.index_name = i.index_name
       LEFT JOIN user_constraints c
         ON c.index_name = i.index_name
       ORDER BY i.table_name, i.index_name, ic.column_position`
    );

    const cols = colRows.map((r) => ({
      table_name: String(r.table_name),
      column_name: String(r.column_name),
      data_type: String(r.data_type),
      is_nullable: String(r.nullable) === "Y" ? "YES" : "NO",
      column_default:
        r.column_default == null ? null : String(r.column_default).trim(),
      extra: String(r.is_identity ?? "").toUpperCase() === "YES" ? "auto_increment" : "",
    }));

    return assembleSchema(
      cols,
      conRows.map((r) => ({
        table_name: String(r.table_name),
        column_name: String(r.column_name),
        // Oracle uses 'P' / 'U' single-letter codes — normalize.
        constraint_type:
          String(r.constraint_type) === "P" ? "PRIMARY KEY" : "UNIQUE",
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
        is_unique: Number(r.is_unique) === 1,
        is_primary: Number(r.is_primary) === 1,
      }))
    );
  } finally {
    await pool.close().catch(() => {});
  }
}

// Accepts:
//  - URL form:  oracle://user:pass@host:1521/SERVICE_NAME
//  - "easy connect": user/pass@host:1521/SERVICE_NAME
//  - ADO-ish:   User Id=u;Password=p;Data Source=host:1521/SERVICE_NAME
function parseOracleConn(input: string): {
  user: string;
  password: string;
  connectString: string;
} {
  const trimmed = input.trim();

  if (/^oracle(?:db)?:\/\//i.test(trimmed)) {
    const url = new URL(trimmed.replace(/^oracle(?:db)?:\/\//i, "http://"));
    const user = decodeURIComponent(url.username || "");
    const password = decodeURIComponent(url.password || "");
    const port = url.port ? `:${url.port}` : "";
    const service = url.pathname.replace(/^\//, "") || "XEPDB1";
    return {
      user,
      password,
      connectString: `${url.hostname}${port}/${service}`,
    };
  }

  // Easy-connect: user/pass@host:port/service
  const easy = trimmed.match(/^([^/]+)\/([^@]+)@(.+)$/);
  if (easy) {
    return { user: easy[1], password: easy[2], connectString: easy[3] };
  }

  // ADO-style.
  const map = new Map<string, string>();
  for (const p of trimmed.split(";").map((s) => s.trim()).filter(Boolean)) {
    const eq = p.indexOf("=");
    if (eq < 0) continue;
    map.set(p.slice(0, eq).trim().toLowerCase(), p.slice(eq + 1).trim());
  }
  return {
    user: map.get("user id") ?? map.get("uid") ?? map.get("user") ?? "",
    password: map.get("password") ?? map.get("pwd") ?? "",
    connectString:
      map.get("data source") ?? map.get("connect_string") ?? "localhost/XEPDB1",
  };
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
  if (dialect === "mssql") return introspectMssql(connectionString);
  if (dialect === "oracle") return introspectOracle(connectionString);
  return introspectMysql(connectionString);
}
