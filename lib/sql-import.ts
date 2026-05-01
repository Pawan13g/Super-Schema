import initSqlJs from "sql.js";
import {
  TABLE_COLORS,
  type Column,
  type ColumnConstraint,
  type ColumnType,
  type Relation,
  type Schema,
  type Table,
  type TableIndex,
} from "./types";

export type SqlImportDialect = "auto" | "postgresql" | "mysql" | "sqlite";

const TYPE_RULES: Array<{ pattern: RegExp; type: ColumnType }> = [
  { pattern: /\bBIGINT\b/i, type: "BIGINT" },
  { pattern: /\bSMALLINT\b/i, type: "SMALLINT" },
  { pattern: /\bINT\b/i, type: "INT" },
  { pattern: /\bDOUBLE\b/i, type: "DOUBLE" },
  { pattern: /\bREAL\b/i, type: "DOUBLE" },
  { pattern: /\bFLOAT\b/i, type: "FLOAT" },
  { pattern: /\bDECIMAL\b/i, type: "DECIMAL" },
  { pattern: /\bNUMERIC\b/i, type: "DECIMAL" },
  { pattern: /\bBOOLEAN\b/i, type: "BOOLEAN" },
  { pattern: /\bBOOL\b/i, type: "BOOLEAN" },
  { pattern: /\bVARCHAR\b/i, type: "VARCHAR" },
  { pattern: /\bCHARACTER VARYING\b/i, type: "VARCHAR" },
  { pattern: /\bCHAR\b/i, type: "CHAR" },
  { pattern: /\bTEXT\b/i, type: "TEXT" },
  { pattern: /\bTIMESTAMP\b/i, type: "TIMESTAMP" },
  { pattern: /\bDATETIME\b/i, type: "DATETIME" },
  { pattern: /\bDATE\b/i, type: "DATE" },
  { pattern: /\bTIME\b/i, type: "TIME" },
  { pattern: /\bJSON\b/i, type: "JSON" },
  { pattern: /\bUUID\b/i, type: "UUID" },
  { pattern: /\bBLOB\b/i, type: "BLOB" },
];

function mapColumnType(typeRaw: string, autoIncrement: boolean): ColumnType {
  if (autoIncrement) return "SERIAL";
  const normalized = typeRaw.trim();
  for (const rule of TYPE_RULES) {
    if (rule.pattern.test(normalized)) return rule.type;
  }
  return "VARCHAR";
}

function genId(prefix: string) {
  const c = (typeof crypto !== "undefined" ? crypto : undefined) as
    | { randomUUID?: () => string }
    | undefined;
  if (c?.randomUUID) {
    return `${prefix}_${c.randomUUID().replace(/-/g, "")}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 10000)}`;
}

function quoteSqliteIdent(name: string): string {
  return `"${name.replace(/"/g, "\"\"")}"`;
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (inLineComment) {
      if (char === "\n") {
        inLineComment = false;
        current += char;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === "*" && next === "/") {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick) {
      if (char === "-" && next === "-") {
        inLineComment = true;
        i += 1;
        continue;
      }
      if (char === "/" && next === "*") {
        inBlockComment = true;
        i += 1;
        continue;
      }
    }

    if (char === "'" && !inDouble && !inBacktick) {
      inSingle = !inSingle;
      current += char;
      continue;
    }

    if (char === "\"" && !inSingle && !inBacktick) {
      inDouble = !inDouble;
      current += char;
      continue;
    }

    if (char === "`" && !inSingle && !inDouble) {
      inBacktick = !inBacktick;
      current += char;
      continue;
    }

    if (char === ";" && !inSingle && !inDouble && !inBacktick) {
      if (current.trim()) statements.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

function splitTopLevelCommas(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (inSingle) {
      if (c === "'") inSingle = false;
      current += c;
      continue;
    }
    if (inDouble) {
      if (c === "\"") inDouble = false;
      current += c;
      continue;
    }
    if (inBacktick) {
      if (c === "`") inBacktick = false;
      current += c;
      continue;
    }
    if (c === "'") inSingle = true;
    else if (c === "\"") inDouble = true;
    else if (c === "`") inBacktick = true;
    else if (c === "(") depth += 1;
    else if (c === ")") depth -= 1;
    else if (c === "," && depth === 0) {
      if (current.trim()) out.push(current);
      current = "";
      continue;
    }
    current += c;
  }
  if (current.trim()) out.push(current);
  return out;
}

function detectDialect(sql: string): "postgresql" | "mysql" | "sqlite" {
  if (/`/.test(sql)) return "mysql";
  if (/\bAUTO_INCREMENT\b/i.test(sql)) return "mysql";
  if (/\bENGINE\s*=/i.test(sql)) return "mysql";
  if (/\b(?:BIG|SMALL)?SERIAL\b/i.test(sql)) return "postgresql";
  if (/::\s*\w/.test(sql)) return "postgresql";
  if (/\bJSONB\b/i.test(sql)) return "postgresql";
  if (/\bTIMESTAMPTZ\b/i.test(sql)) return "postgresql";
  if (/\bBYTEA\b/i.test(sql)) return "postgresql";
  return "sqlite";
}

function preprocessCommon(sql: string): string {
  let r = sql;
  // Strip server-level / connection-level statements that sql.js can't parse.
  r = r.replace(/^\s*SET\s+[^;]+;/gim, "");
  r = r.replace(/CREATE\s+EXTENSION[^;]+;/gi, "");
  r = r.replace(/CREATE\s+SCHEMA[^;]+;/gi, "");
  r = r.replace(/COMMENT\s+ON\s+[^;]+;/gi, "");
  r = r.replace(/CREATE\s+TYPE\s+[^;]+\bAS\s+ENUM\s*\([^)]*\)\s*;/gi, "");
  r = r.replace(/CREATE\s+SEQUENCE[^;]+;/gi, "");
  r = r.replace(/ALTER\s+SEQUENCE[^;]+;/gi, "");
  r = r.replace(/ALTER\s+TABLE\s+[^;]+\s+OWNER\s+TO[^;]+;/gi, "");
  r = r.replace(/(?:GRANT|REVOKE)\s+[^;]+;/gi, "");
  // Match modes shared by all dialects on FK clauses
  r = r.replace(/\bMATCH\s+(?:FULL|PARTIAL|SIMPLE)\b/gi, "");
  r = r.replace(/\b(?:NOT\s+)?DEFERRABLE(?:\s+INITIALLY\s+\w+)?\b/gi, "");
  return r;
}

function preprocessMysql(sql: string): string {
  let r = sql;
  // Drop backticks; SQLite accepts unquoted or double-quoted identifiers.
  r = r.replace(/`/g, "");
  // ENUM('a','b'), SET('a','b') -> TEXT
  r = r.replace(/\bENUM\s*\([^)]*\)/gi, "TEXT");
  r = r.replace(/\bSET\s*\([^)]*\)/gi, "TEXT");
  // Numeric type modifiers
  r = r.replace(/\b(UNSIGNED|ZEROFILL|BINARY)\b/gi, "");
  // Per-column character set / collate
  r = r.replace(/\bCHARACTER\s+SET\s+\w+/gi, "");
  r = r.replace(/\bCOLLATE\s+[\w_]+/gi, "");
  // ON UPDATE CURRENT_TIMESTAMP[(n)]
  r = r.replace(/\bON\s+UPDATE\s+CURRENT_TIMESTAMP(?:\s*\([^)]*\))?/gi, "");
  // Inline COMMENT 'text'
  r = r.replace(/\bCOMMENT\s+'(?:[^']|'')*'/gi, "");
  // Inline KEY/INDEX/FULLTEXT/SPATIAL clauses inside CREATE TABLE — SQLite rejects these.
  r = r.replace(
    /,\s*(?:UNIQUE\s+|FULLTEXT\s+|SPATIAL\s+)?(?:KEY|INDEX)\s+(?:\w+\s*)?\([^)]*\)/gi,
    ""
  );
  // AUTO_INCREMENT keyword — strip; we detect it from the original SQL elsewhere.
  r = r.replace(/\bAUTO_INCREMENT\b/gi, "");
  // Strip table options after the closing paren up to the semicolon.
  // ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=... AUTO_INCREMENT=... ROW_FORMAT=...
  r = r.replace(
    /\)\s*(?:ENGINE\s*=|DEFAULT\s+CHARSET|CHARSET\s*=|COLLATE\s*=|AUTO_INCREMENT\s*=|ROW_FORMAT\s*=|COMMENT\s*=|PACK_KEYS\s*=|MAX_ROWS\s*=|MIN_ROWS\s*=|AVG_ROW_LENGTH\s*=|CHECKSUM\s*=|DELAY_KEY_WRITE\s*=|STATS_AUTO_RECALC\s*=|STATS_PERSISTENT\s*=|STATS_SAMPLE_PAGES\s*=|TABLESPACE)[^;]*?(?=;|$)/gi,
    ")"
  );
  return r;
}

function preprocessPostgres(sql: string): string {
  let r = sql;
  // Strip schema qualifiers like public.users
  r = r.replace(/\bpublic\./gi, "");
  // ::cast in expressions/defaults: '...'::text, NOW()::timestamp, ARRAY[...]::int[]
  r = r.replace(/::\s*"?\w+"?(?:\s*\([^)]*\))?(?:\s*\[\s*\])?/g, "");
  // SERIAL family -> integer types; auto-increment is detected from original SQL.
  r = r.replace(/\bBIGSERIAL\b/gi, "BIGINT");
  r = r.replace(/\bSMALLSERIAL\b/gi, "SMALLINT");
  r = r.replace(/\bSERIAL\b/gi, "INTEGER");
  // Type aliases not understood by sql.js' SQLite
  r = r.replace(/\bJSONB\b/gi, "JSON");
  r = r.replace(/\bBYTEA\b/gi, "BLOB");
  r = r.replace(/\bTIMESTAMP\s+WITH(?:OUT)?\s+TIME\s+ZONE\b/gi, "TIMESTAMP");
  r = r.replace(/\bTIME\s+WITH(?:OUT)?\s+TIME\s+ZONE\b/gi, "TIME");
  r = r.replace(/\bTIMESTAMPTZ\b/gi, "TIMESTAMP");
  r = r.replace(/\bTIMETZ\b/gi, "TIME");
  r = r.replace(/\bCHARACTER\s+VARYING\b/gi, "VARCHAR");
  r = r.replace(/\bDOUBLE\s+PRECISION\b/gi, "DOUBLE");
  // Index/constraint trailers: USING gin, WITH (...), TABLESPACE x
  r = r.replace(/\bUSING\s+\w+/gi, "");
  r = r.replace(/\bWITH\s*\([^)]*\)/gi, "");
  r = r.replace(/\bTABLESPACE\s+\w+/gi, "");
  // Postgres-only DEFAULT functions sql.js doesn't know
  r = r.replace(/\bDEFAULT\s+nextval\s*\([^)]*\)/gi, "");
  r = r.replace(/\bDEFAULT\s+(?:gen_random_uuid|uuid_generate_v\d+)\s*\([^)]*\)/gi, "");
  // Array type brackets — SQLite doesn't support arrays; drop the brackets.
  r = r.replace(/\[\s*\]/g, "");
  // COLLATE "default" / COLLATE pg_catalog.default
  r = r.replace(/\bCOLLATE\s+(?:"[^"]+"|[\w.]+)/gi, "");
  return r;
}

function preprocessSql(
  sql: string,
  dialect: "postgresql" | "mysql" | "sqlite"
): string {
  let r = preprocessCommon(sql);
  if (dialect === "mysql") r = preprocessMysql(r);
  else if (dialect === "postgresql") r = preprocessPostgres(r);
  return r;
}

const NON_COLUMN_KEYWORDS = new Set([
  "CONSTRAINT",
  "PRIMARY",
  "FOREIGN",
  "UNIQUE",
  "CHECK",
  "KEY",
  "INDEX",
  "FULLTEXT",
  "SPATIAL",
]);

function buildAutoincMap(originalSql: string): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const statements = splitSqlStatements(originalSql);
  for (const stmt of statements) {
    const tableMatch = stmt.match(
      /^\s*CREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[`"]?\w+[`"]?\s*\.\s*)?[`"]?(\w+)[`"]?/i
    );
    if (!tableMatch) continue;
    const tableName = tableMatch[1].toLowerCase();
    const cols = new Set<string>();

    const parenStart = stmt.indexOf("(");
    const parenEnd = stmt.lastIndexOf(")");
    if (parenStart < 0 || parenEnd < 0 || parenEnd <= parenStart) continue;

    const body = stmt.substring(parenStart + 1, parenEnd);
    for (const part of splitTopLevelCommas(body)) {
      const trimmed = part.trim();
      const colMatch = trimmed.match(/^[`"]?(\w+)[`"]?(?:\s|$)/);
      if (!colMatch) continue;
      const colName = colMatch[1];
      if (NON_COLUMN_KEYWORDS.has(colName.toUpperCase())) continue;
      if (
        /\b(?:AUTO_INCREMENT|AUTOINCREMENT|BIGSERIAL|SMALLSERIAL|SERIAL)\b/i.test(
          trimmed
        )
      ) {
        cols.add(colName.toLowerCase());
      }
    }
    map.set(tableName, cols);
  }
  return map;
}

function getRows(result?: { columns: string[]; values: unknown[][] }) {
  if (!result) return [] as Record<string, unknown>[];
  return result.values.map((row) => {
    const entry: Record<string, unknown> = {};
    result.columns.forEach((col, idx) => {
      entry[col] = row[idx];
    });
    return entry;
  });
}

export async function parseSqlToSchema(
  sql: string,
  dialect: SqlImportDialect = "auto"
): Promise<Schema> {
  const trimmed = sql.trim();
  if (!trimmed) {
    throw new Error("SQL is empty.");
  }

  const resolvedDialect: "postgresql" | "mysql" | "sqlite" =
    dialect === "auto" ? detectDialect(trimmed) : dialect;

  const autoincMap = buildAutoincMap(trimmed);
  const cleaned = preprocessSql(trimmed, resolvedDialect);

  const SQL = await initSqlJs({
    locateFile: (file: string) => `/${file}`,
  });
  const db = new SQL.Database();

  try {
    const statements = splitSqlStatements(cleaned);
    const errors: string[] = [];
    for (const stmt of statements) {
      const trimmedStmt = stmt.trim();
      if (!trimmedStmt) continue;
      // Only run statements relevant to schema introspection.
      if (!/^(?:CREATE|ALTER)\s/i.test(trimmedStmt)) continue;
      try {
        db.run(trimmedStmt);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(
          `Skipped a statement (${msg}): ${trimmedStmt.slice(0, 120)}${
            trimmedStmt.length > 120 ? "..." : ""
          }`
        );
      }
    }

    const master = db.exec(
      "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    );
    const tableRows = getRows(master[0]);

    if (tableRows.length === 0) {
      const detail = errors.length
        ? `\n\nDetails:\n${errors.slice(0, 3).join("\n")}`
        : "";
      throw new Error(
        `No tables could be parsed from the ${resolvedDialect.toUpperCase()} SQL.${detail}`
      );
    }

    const tables: Table[] = [];
    const relations: Relation[] = [];
    const tableIdMap = new Map<string, string>();
    const columnIdMap = new Map<string, Map<string, string>>();

    const GRID_X = 320;
    const GRID_Y = 240;
    const COLS = 3;

    for (let i = 0; i < tableRows.length; i += 1) {
      const name = String(tableRows[i].name);
      const tableId = genId("tbl");
      tableIdMap.set(name, tableId);

      const autoincCols = autoincMap.get(name.toLowerCase()) ?? new Set<string>();

      const columnsResult = db.exec(`PRAGMA table_info(${quoteSqliteIdent(name)})`);
      const columnsRows = getRows(columnsResult[0]);
      const columnIds = new Map<string, string>();

      const columns: Column[] = columnsRows.map((row) => {
        const colName = String(row.name);
        const autoIncrement = autoincCols.has(colName.toLowerCase());
        const colType = mapColumnType(String(row.type ?? ""), autoIncrement);
        const constraints: ColumnConstraint[] = [];

        if (Number(row.pk) >= 1) constraints.push("PRIMARY KEY");
        if (Number(row.notnull) === 1) constraints.push("NOT NULL");
        if (autoIncrement) constraints.push("AUTO_INCREMENT");
        if (row.dflt_value !== null && row.dflt_value !== undefined) {
          constraints.push("DEFAULT");
        }

        const id = genId("col");
        columnIds.set(colName, id);

        return {
          id,
          name: colName,
          type: colType,
          constraints,
          defaultValue:
            row.dflt_value !== null && row.dflt_value !== undefined
              ? String(row.dflt_value)
              : undefined,
          comment: "",
        };
      });

      columnIdMap.set(name, columnIds);

      const table: Table = {
        id: tableId,
        name,
        color: TABLE_COLORS[i % TABLE_COLORS.length],
        columns,
        indexes: [],
        comment: "",
        position: { x: (i % COLS) * GRID_X + 40, y: Math.floor(i / COLS) * GRID_Y + 40 },
      };

      tables.push(table);
    }

    for (const table of tables) {
      const fkResult = db.exec(`PRAGMA foreign_key_list(${quoteSqliteIdent(table.name)})`);
      const fkRows = getRows(fkResult[0]);

      for (const row of fkRows) {
        const targetTableName = String(row.table);
        const sourceColumnName = String(row.from);
        const targetColumnName = String(row.to);

        const sourceColumnId = columnIdMap.get(table.name)?.get(sourceColumnName);
        const targetTableId = tableIdMap.get(targetTableName);
        const targetColumnId = columnIdMap.get(targetTableName)?.get(targetColumnName);
        if (!sourceColumnId || !targetTableId || !targetColumnId) continue;

        const sourceColumn = table.columns.find((col) => col.id === sourceColumnId);
        if (sourceColumn && !sourceColumn.constraints.includes("REFERENCES")) {
          sourceColumn.constraints = [...sourceColumn.constraints, "REFERENCES"];
          sourceColumn.references = { table: targetTableName, column: targetColumnName };
        }

        relations.push({
          id: genId("rel"),
          sourceTable: table.id,
          sourceColumn: sourceColumnId,
          targetTable: targetTableId,
          targetColumn: targetColumnId,
          type: "one-to-many",
        });
      }

      const indexResult = db.exec(`PRAGMA index_list(${quoteSqliteIdent(table.name)})`);
      const indexRows = getRows(indexResult[0]);

      for (const row of indexRows) {
        const origin = String(row.origin ?? "");
        if (origin === "pk") continue;

        const indexName = String(row.name);
        const unique = Number(row.unique) === 1;
        const indexInfo = db.exec(`PRAGMA index_info(${quoteSqliteIdent(indexName)})`);
        const indexCols = getRows(indexInfo[0])
          .map((info) => String(info.name))
          .filter(Boolean);

        if (indexCols.length === 0) continue;

        if (unique && indexCols.length === 1) {
          const column = table.columns.find((col) => col.name === indexCols[0]);
          if (column && !column.constraints.includes("UNIQUE")) {
            column.constraints = [...column.constraints, "UNIQUE"];
          }
          if (origin === "u") continue;
        }

        const index: TableIndex = {
          id: genId("idx"),
          name: indexName,
          unique,
          columns: indexCols
            .map((colName) => table.columns.find((col) => col.name === colName)?.id)
            .filter((id): id is string => Boolean(id)),
        };

        if (index.columns.length > 0) {
          table.indexes.push(index);
        }
      }
    }

    return { tables, relations };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse SQL.";
    throw new Error(message);
  } finally {
    db.close();
  }
}
