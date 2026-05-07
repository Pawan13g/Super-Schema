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

export type SqlImportDialect =
  | "auto"
  | "postgresql"
  | "mysql"
  | "sqlite"
  | "mssql"
  | "oracle";

const TYPE_RULES: Array<{ pattern: RegExp; type: ColumnType }> = [
  // Oracle's NUMBER(p,s) lookup must come before generic INT/DOUBLE so a
  // `NUMBER(10)` column doesn't get scooped up by the loose INT pattern
  // when the importer sees the original Oracle DDL pre-preprocessing.
  { pattern: /\bNUMBER\s*\(\s*\d+\s*,\s*\d+\s*\)/i, type: "DECIMAL" },
  { pattern: /\bNUMBER\b/i, type: "DECIMAL" },
  { pattern: /\bBINARY_DOUBLE\b/i, type: "DOUBLE" },
  { pattern: /\bBINARY_FLOAT\b/i, type: "FLOAT" },
  { pattern: /\bVARCHAR2\b/i, type: "VARCHAR" },
  { pattern: /\bNVARCHAR2\b/i, type: "VARCHAR" },
  { pattern: /\bCLOB\b/i, type: "TEXT" },
  { pattern: /\bNCLOB\b/i, type: "TEXT" },
  { pattern: /\bBIGINT\b/i, type: "BIGINT" },
  { pattern: /\bSMALLINT\b/i, type: "SMALLINT" },
  { pattern: /\bTINYINT\b/i, type: "SMALLINT" },
  { pattern: /\bINT\b/i, type: "INT" },
  { pattern: /\bDOUBLE\b/i, type: "DOUBLE" },
  { pattern: /\bREAL\b/i, type: "DOUBLE" },
  { pattern: /\bFLOAT\b/i, type: "FLOAT" },
  { pattern: /\bDECIMAL\b/i, type: "DECIMAL" },
  { pattern: /\bNUMERIC\b/i, type: "DECIMAL" },
  { pattern: /\bMONEY\b/i, type: "DECIMAL" },
  { pattern: /\bBIT\b/i, type: "BOOLEAN" },
  { pattern: /\bBOOLEAN\b/i, type: "BOOLEAN" },
  { pattern: /\bBOOL\b/i, type: "BOOLEAN" },
  { pattern: /\bN?VARCHAR\b/i, type: "VARCHAR" },
  { pattern: /\bCHARACTER VARYING\b/i, type: "VARCHAR" },
  { pattern: /\bN?CHAR\b/i, type: "CHAR" },
  { pattern: /\bN?TEXT\b/i, type: "TEXT" },
  { pattern: /\bDATETIME2\b/i, type: "DATETIME" },
  { pattern: /\bDATETIMEOFFSET\b/i, type: "DATETIME" },
  { pattern: /\bSMALLDATETIME\b/i, type: "DATETIME" },
  { pattern: /\bTIMESTAMP\b/i, type: "TIMESTAMP" },
  { pattern: /\bDATETIME\b/i, type: "DATETIME" },
  { pattern: /\bDATE\b/i, type: "DATE" },
  { pattern: /\bTIME\b/i, type: "TIME" },
  { pattern: /\bJSON\b/i, type: "JSON" },
  { pattern: /\bUUID\b/i, type: "UUID" },
  { pattern: /\bUNIQUEIDENTIFIER\b/i, type: "UUID" },
  { pattern: /\bVARBINARY\b/i, type: "BLOB" },
  { pattern: /\bIMAGE\b/i, type: "BLOB" },
  { pattern: /\bROWVERSION\b/i, type: "BLOB" },
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

// Decide whether a single statement contributes to the schema shape we extract
// (tables + columns + indexes + alters). Everything else — functions across
// every PL language, triggers in every flavor, views, policies, sequences,
// types, comments, partition children, etc. — is skipped without trying to
// run it through sql.js. This is a positive allow-list rather than a negative
// strip; that way new keyword combinations don't silently break parsing.
function isSchemaShapeStatement(stmt: string): boolean {
  const head = stmt.replace(/^\s+/, "");
  // CREATE TABLE — but NOT child partition declarations
  // (`CREATE TABLE x PARTITION OF y FOR VALUES ...`).
  if (/^CREATE\s+(?:GLOBAL\s+|LOCAL\s+)?(?:TEMP(?:ORARY)?\s+|UNLOGGED\s+)?TABLE\b/i.test(head)) {
    if (/\bPARTITION\s+OF\b/i.test(head)) return false;
    return true;
  }
  // CREATE [UNIQUE] INDEX … — including PG `USING` clauses, partial WHERE.
  if (/^CREATE\s+(?:UNIQUE\s+)?(?:CLUSTERED\s+|NONCLUSTERED\s+)?(?:FULLTEXT\s+|SPATIAL\s+)?INDEX\b/i.test(head)) {
    return true;
  }
  // ALTER TABLE.
  if (/^ALTER\s+TABLE\b/i.test(head)) return true;
  // Everything else (CREATE FUNCTION/TRIGGER/PROCEDURE/VIEW/MATERIALIZED VIEW/
  // POLICY/RULE/AGGREGATE/OPERATOR/DOMAIN/TYPE/SEQUENCE/EXTENSION/SCHEMA/CAST/
  // EVENT TRIGGER/PUBLICATION/SUBSCRIPTION/SERVER/USER MAPPING/FOREIGN TABLE
  // helpers, plus any DROP/COMMENT/SET/GRANT/USE/DELETE/INSERT/UPDATE) — skip.
  return false;
}

function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let inLineComment = false;
  let inBlockComment = false;
  // Postgres dollar-quoted string state. The opening tag is $tag$ where tag is
  // any (possibly empty) identifier. Body ends at the same $tag$. Crucially,
  // semicolons inside a dollar-quoted body are NOT statement terminators —
  // PL/pgSQL function bodies depend on this.
  let dollarTag: string | null = null;
  // MySQL DELIMITER state. mysqldump output for stored procedures emits:
  //   DELIMITER //
  //   CREATE PROCEDURE … BEGIN … END //
  //   DELIMITER ;
  // While `delimiter` differs from `;`, we must split on it instead of `;`
  // so the procedure body (which contains plain semicolons) stays one
  // statement. Stripped from the output entirely.
  let delimiter = ";";

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (dollarTag !== null) {
      // Look for the closing $tag$.
      if (char === "$") {
        const close = `$${dollarTag}$`;
        if (sql.startsWith(close, i)) {
          current += close;
          i += close.length - 1;
          dollarTag = null;
          continue;
        }
      }
      current += char;
      continue;
    }

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
      // Dollar-quote opener: $tag$ (tag = identifier chars or empty).
      if (char === "$") {
        const m = sql.slice(i).match(/^\$([A-Za-z_][\w]*|)\$/);
        if (m) {
          const opener = m[0];
          dollarTag = m[1];
          current += opener;
          i += opener.length - 1;
          continue;
        }
      }
      // MySQL `DELIMITER <token>` directive at start of a logical line.
      // Switches the active terminator until the next DELIMITER appears.
      // We don't preserve the directive itself in the output — it's not
      // valid SQL anywhere downstream.
      if ((char === "D" || char === "d") && (i === 0 || sql[i - 1] === "\n")) {
        const m = sql.slice(i).match(/^DELIMITER[\t ]+(\S+)[ \t]*\r?\n?/i);
        if (m) {
          if (current.trim()) statements.push(current.trim());
          current = "";
          delimiter = m[1];
          i += m[0].length - 1;
          continue;
        }
      }
      // Match the active multi-char delimiter.
      if (
        delimiter !== ";" &&
        char === delimiter[0] &&
        sql.startsWith(delimiter, i)
      ) {
        if (current.trim()) statements.push(current.trim());
        current = "";
        i += delimiter.length - 1;
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

    if (
      delimiter === ";" &&
      char === ";" &&
      !inSingle &&
      !inDouble &&
      !inBacktick
    ) {
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

// Score-based dialect detector. Each signal contributes a weighted vote;
// the dialect with the highest score wins. Replaces the previous "first
// match wins" cascade where a single PG-style word inside a MySQL dump
// could mis-classify the whole file. Ties fall back to SQLite (the safest
// generic parser).
function detectDialect(
  sql: string
): "postgresql" | "mysql" | "sqlite" | "mssql" | "oracle" {
  type Dialect = "postgresql" | "mysql" | "sqlite" | "mssql" | "oracle";
  const scores: Record<Dialect, number> = {
    postgresql: 0,
    mysql: 0,
    sqlite: 0,
    mssql: 0,
    oracle: 0,
  };
  const hit = (d: Dialect, w: number, re: RegExp) => {
    if (re.test(sql)) scores[d] += w;
  };

  // SQL Server signals.
  hit("mssql", 5, /\bIDENTITY\s*\(/i);
  hit("mssql", 5, /\bUNIQUEIDENTIFIER\b/i);
  hit("mssql", 4, /\bDATETIME2\b/i);
  hit("mssql", 4, /\bDATETIMEOFFSET\b/i);
  hit("mssql", 4, /\bN?VARCHAR\s*\(\s*MAX\s*\)/i);
  hit("mssql", 5, /\bsp_addextendedproperty\b/i);
  hit("mssql", 4, /^\s*GO\s*$/im);
  hit("mssql", 3, /\bdbo\.\b/i);
  if (/\[[a-zA-Z_]\w*\]/.test(sql) && /\bdbo\.\b/i.test(sql))
    scores.mssql += 3;

  // Postgres signals.
  hit("postgresql", 5, /\b(?:BIG|SMALL)?SERIAL\b/i);
  hit("postgresql", 4, /::\s*\w/);
  hit("postgresql", 5, /\bJSONB\b/i);
  hit("postgresql", 5, /\bTIMESTAMPTZ\b/i);
  hit("postgresql", 5, /\bBYTEA\b/i);
  hit("postgresql", 5, /\bgen_random_uuid\s*\(/i);
  hit("postgresql", 5, /\buuid_generate_v\d+\s*\(/i);
  hit("postgresql", 5, /\bCREATE\s+EXTENSION\b/i);
  hit("postgresql", 4, /\bCOMMENT\s+ON\s+(?:TABLE|COLUMN)\b/i);
  hit("postgresql", 5, /\bPARTITION\s+BY\s+(?:HASH|RANGE|LIST)\s*\(/i);
  hit("postgresql", 5, /\bPARTITION\s+OF\b/i);
  hit("postgresql", 4, /\bTSVECTOR\b/i);
  hit("postgresql", 4, /\bINET\b/i);
  hit("postgresql", 4, /\bCITEXT\b/i);
  hit("postgresql", 5, /\bRETURNS\s+TRIGGER\b/i);
  hit("postgresql", 5, /\$\$/);

  // MySQL signals. Backticks alone are weak — many tools quote with them
  // even on PG-derived dumps — but combined with other MySQL markers the
  // total wins the score.
  hit("mysql", 2, /`/);
  hit("mysql", 5, /\bAUTO_INCREMENT\b/i);
  hit("mysql", 5, /\bENGINE\s*=/i);
  hit("mysql", 4, /\bDEFAULT\s+CHARSET\b/i);
  hit("mysql", 4, /\bCOLLATE\s+\w+_\w+_ci\b/i);
  hit("mysql", 5, /^\s*DELIMITER\b/im);
  hit("mysql", 4, /\bUNSIGNED\b/i);

  // Oracle signals.
  hit("oracle", 5, /\bVARCHAR2\b/i);
  hit("oracle", 5, /\bNVARCHAR2\b/i);
  hit("oracle", 5, /\bN?CLOB\b/i);
  hit("oracle", 5, /\bBINARY_(?:FLOAT|DOUBLE)\b/i);
  hit("oracle", 4, /\bGENERATED\s+(?:ALWAYS|BY\s+DEFAULT)\s+AS\s+IDENTITY\b/i);
  hit("oracle", 5, /\bCREATE\s+SEQUENCE\b/i);
  hit("oracle", 4, /\bDUAL\b/i);
  hit("oracle", 5, /\bSYSDATE\b/i);
  hit("oracle", 4, /\bROWNUM\b/i);
  hit("oracle", 4, /\bNUMBER\s*\(\s*\d+\s*(?:,\s*\d+\s*)?\)/i);

  // Pick the max; ties → sqlite as the safest generic parser.
  let best: Dialect = "sqlite";
  let bestScore = 0;
  (Object.keys(scores) as Dialect[]).forEach((d) => {
    if (scores[d] > bestScore) {
      best = d;
      bestScore = scores[d];
    }
  });
  return bestScore > 0 ? best : "sqlite";
}

// Recover from common copy-paste errors inside CREATE TABLE bodies. These
// are forgiving heuristics that turn a "near (: syntax error" into a
// successful parse for typical real-world DDL dumps. Each transform is
// scoped to the body of a single `CREATE TABLE ... ( ... )` so it can't
// accidentally rewrite unrelated SQL.
function autoRepairCreateTableBodies(sql: string): string {
  // Pre-scan to find every CREATE TABLE … ( body ) span using paren matching.
  // Doing this with regex alone is unreliable (function defaults, nested
  // parens in CHECK clauses); a depth counter is correct.
  const out: string[] = [];
  let cursor = 0;
  const re = /CREATE\s+(?:TEMP(?:ORARY)?\s+|UNLOGGED\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:[`"]?\w+[`"]?\s*\.\s*)?(?:[`"]?\w+[`"]?|\[\w+\])\s*\(/gi;
  for (let m; (m = re.exec(sql)); ) {
    const headerEnd = m.index + m[0].length; // position right after the `(`
    let i = headerEnd;
    let depth = 1;
    let inSingle = false;
    let inDouble = false;
    while (i < sql.length && depth > 0) {
      const c = sql[i];
      if (inSingle) {
        if (c === "'") inSingle = false;
      } else if (inDouble) {
        if (c === '"') inDouble = false;
      } else if (c === "'") inSingle = true;
      else if (c === '"') inDouble = true;
      else if (c === "(") depth += 1;
      else if (c === ")") depth -= 1;
      i += 1;
    }
    const closeIdx = i - 1; // position of the matching `)`
    out.push(sql.slice(cursor, headerEnd));
    const body = sql.slice(headerEnd, closeIdx);
    out.push(repairCreateTableBody(body));
    cursor = closeIdx;
    re.lastIndex = closeIdx;
  }
  out.push(sql.slice(cursor));
  return out.join("");
}

function repairCreateTableBody(body: string): string {
  let b = body;

  // (1) Insert a comma when a table-level constraint clause (PRIMARY KEY,
  //     UNIQUE, FOREIGN KEY, CHECK, CONSTRAINT) starts on a new line right
  //     after a column definition that wasn't terminated with a comma. This
  //     is the #1 paste error: "...CURRENT_TIMESTAMP\n\n PRIMARY KEY (...)".
  b = b.replace(
    /([^\s,(])(\s*\n\s*)(PRIMARY\s+KEY|UNIQUE|FOREIGN\s+KEY|CHECK|CONSTRAINT)\b/gi,
    "$1,$2$3"
  );

  // (2) Drop a redundant table-level `PRIMARY KEY (...)` when one of the
  //     column-defs already has an inline `PRIMARY KEY`. SQLite — and any
  //     real DB — rejects "more than one primary key" outright. The user's
  //     intent in this paste pattern is almost always the table-level
  //     composite PK, but stripping THAT would lose information; we instead
  //     drop the inline PRIMARY KEY on the surrogate id column. To do that
  //     safely we'd have to parse the body — too aggressive. So we drop the
  //     table-level PK only if the inline PK clearly belongs to a separate
  //     surrogate (id-style) column. Heuristic: inline PK appears on a
  //     column whose name doesn't appear in the table-level PK list.
  const tablePkMatch = b.match(
    /,\s*PRIMARY\s+KEY\s*\(([^)]+)\)(?=\s*(?:,|\)|$|\n))/i
  );
  if (tablePkMatch) {
    const tablePkCols = new Set(
      tablePkMatch[1]
        .split(",")
        .map((s) => s.trim().replace(/^[`"\[]|[`"\]]$/g, "").toLowerCase())
        .filter(Boolean)
    );
    const inlinePkCol = b.match(
      /(?:^|\s|,)([`"\[]?\w+[`"\]]?)\s+[^,]*?\bPRIMARY\s+KEY\b/i
    );
    if (inlinePkCol) {
      const inlineName = inlinePkCol[1]
        .replace(/^[`"\[]|[`"\]]$/g, "")
        .toLowerCase();
      if (!tablePkCols.has(inlineName)) {
        // The inline PK is on a different column than the table-level PK.
        // Strip the inline `PRIMARY KEY` keyword (keep the column itself
        // and any AUTOINCREMENT will follow naturally as just an id field).
        b = b.replace(
          /(\s+)PRIMARY\s+KEY\b(?=[^,]*,)/i,
          "$1"
        );
      }
    }
  }

  return b;
}

function preprocessCommon(sql: string): string {
  let r = sql;
  // Auto-repair common paste errors inside table bodies (missing comma
  // before a table-level constraint, duplicate inline + table-level PK).
  // Runs first so dialect-specific passes see a syntactically valid body.
  r = autoRepairCreateTableBodies(r);
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

// Strips matches of `opener` (which must include the trailing `(` it opens)
// along with the balanced paren block that follows. `trimAfter` returns the
// number of chars to additionally consume immediately after the close paren —
// e.g. for `GENERATED ALWAYS AS (…) STORED` we also consume " STORED".
function stripBalanced(
  src: string,
  opener: RegExp,
  open: string,
  close: string,
  trimAfter: (after: string) => number
): string {
  const parts: string[] = [];
  let cursor = 0;
  opener.lastIndex = 0;
  for (let m: RegExpExecArray | null; (m = opener.exec(src)); ) {
    const start = m.index;
    let i = start + m[0].length;
    if (src[i - 1] !== open) continue;
    let depth = 1;
    let inSingle = false;
    let inDouble = false;
    while (i < src.length && depth > 0) {
      const c = src[i];
      if (inSingle) {
        if (c === "'") inSingle = false;
      } else if (inDouble) {
        if (c === '"') inDouble = false;
      } else if (c === "'") inSingle = true;
      else if (c === '"') inDouble = true;
      else if (c === open) depth += 1;
      else if (c === close) depth -= 1;
      i += 1;
    }
    const consumedExtra = trimAfter(src.slice(i));
    parts.push(src.slice(cursor, start));
    cursor = i + consumedExtra;
    opener.lastIndex = cursor;
  }
  parts.push(src.slice(cursor));
  return parts.join("");
}

function preprocessPostgres(sql: string): string {
  let r = sql;
  // NOTE: CREATE FUNCTION / TRIGGER / PROCEDURE / VIEW / etc. and the child
  // CREATE TABLE … PARTITION OF … statements are filtered out at the
  // statement level after splitting (see runnableStatement / parseInDialect).
  // We do NOT regex-strip them here — a regex with `[\s\S]*?` between
  // `CREATE TABLE` and `PARTITION OF` happily spans `;` boundaries and eats
  // every preceding table along with the partition declaration.
  // Strip the PARTITION BY clause that hangs after a parent table's closing
  // paren so the parent's CREATE TABLE itself parses.
  r = r.replace(/\)\s*PARTITION\s+BY\s+(?:HASH|RANGE|LIST)\s*\([^)]*\)/gi, ")");
  // GENERATED ALWAYS AS (...) STORED — drop the whole expression so the column
  // collapses to its base type. Use balanced-paren scanner since the
  // expression body can contain arbitrarily nested function calls.
  r = stripBalanced(r, /\bGENERATED\s+ALWAYS\s+AS\s*\(/gi, "(", ")", (after) => {
    const m = after.match(/^\s*(?:STORED|VIRTUAL)\b/i);
    return m ? m[0].length : 0;
  });
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
  // Postgres-only types sql.js' SQLite doesn't know — coerce to a parseable
  // approximation. Schema shape is preserved; semantics aren't critical here.
  r = r.replace(/\bTSVECTOR\b/gi, "TEXT");
  r = r.replace(/\bTSQUERY\b/gi, "TEXT");
  r = r.replace(/\bCITEXT\b/gi, "TEXT");
  r = r.replace(/\bINET\b/gi, "TEXT");
  r = r.replace(/\bCIDR\b/gi, "TEXT");
  r = r.replace(/\bMACADDR\d*\b/gi, "TEXT");
  r = r.replace(/\bMONEY\b/gi, "DECIMAL");
  r = r.replace(/\bINTERVAL\b/gi, "TEXT");
  r = r.replace(/\bXML\b/gi, "TEXT");
  // Index/constraint trailers: USING gin, WITH (...), TABLESPACE x.
  // NOTE: don't consume parentheses after USING — for `CREATE INDEX … USING
  // GIN (col gin_trgm_ops)` the parens hold the index column list.
  r = r.replace(/\bUSING\s+\w+/gi, "");
  r = r.replace(/\bWITH\s*\([^)]*\)/gi, "");
  r = r.replace(/\bTABLESPACE\s+\w+/gi, "");
  // Per-column operator class on PG indexes: `(username gin_trgm_ops)` →
  // `(username)`. Strip `<ident>_ops` tokens inside parens.
  r = r.replace(/(\b\w+)\s+\w+_ops\b/g, "$1");
  // NULLS FIRST/LAST in index column lists — sql.js' SQLite doesn't support it.
  r = r.replace(/\bNULLS\s+(?:FIRST|LAST)\b/gi, "");
  // Postgres-only DEFAULT functions sql.js doesn't know
  r = r.replace(/\bDEFAULT\s+nextval\s*\([^)]*\)/gi, "");
  r = r.replace(/\bDEFAULT\s+(?:gen_random_uuid|uuid_generate_v\d+)\s*\([^)]*\)/gi, "");
  r = r.replace(/\bDEFAULT\s+now\s*\(\s*\)/gi, "DEFAULT CURRENT_TIMESTAMP");
  // Strip array brackets (UUID[], TEXT[], INTEGER[]) — convert to scalar.
  r = r.replace(/\[\s*\]/g, "");
  // COLLATE "default" / COLLATE pg_catalog.default
  r = r.replace(/\bCOLLATE\s+(?:"[^"]+"|[\w.]+)/gi, "");
  // Partial-index predicate `WHERE …` is fine; SQLite supports it. Leave alone.
  return r;
}

function preprocessMssql(sql: string): string {
  let r = sql;
  // Strip GO batch terminators on their own lines.
  r = r.replace(/^\s*GO\s*;?\s*$/gim, "");
  // sp_addextendedproperty / sp_rename / EXEC … -> drop entire statement.
  r = r.replace(/EXEC(?:UTE)?\s+sp_\w+[^;]*;?/gi, "");
  // USE [db]; / SET XACT_ABORT … / SET QUOTED_IDENTIFIER … — covered by
  // preprocessCommon's SET strip; also drop USE.
  r = r.replace(/^\s*USE\s+[^;]+;?/gim, "");
  // CREATE SCHEMA [name] AUTHORIZATION …
  r = r.replace(/CREATE\s+SCHEMA\s+[^;]+;?/gi, "");
  // dbo. / [dbo]. schema prefix
  r = r.replace(/\b(?:\[\s*dbo\s*\]|dbo)\s*\./gi, "");
  // Convert [ident] -> "ident" for sql.js
  r = r.replace(/\[([^\]]+)\]/g, (_m, name: string) => `"${name.replace(/"/g, '""')}"`);
  // T-SQL types -> SQLite-friendly
  r = r.replace(/\bN(VARCHAR|CHAR|TEXT)\b/gi, "$1");
  r = r.replace(/\bVARCHAR\s*\(\s*MAX\s*\)/gi, "TEXT");
  r = r.replace(/\bVARBINARY\s*\(\s*MAX\s*\)/gi, "BLOB");
  r = r.replace(/\bVARBINARY\b/gi, "BLOB");
  r = r.replace(/\bIMAGE\b/gi, "BLOB");
  r = r.replace(/\bROWVERSION\b/gi, "BLOB");
  r = r.replace(/\bUNIQUEIDENTIFIER\b/gi, "TEXT");
  r = r.replace(/\bDATETIME2\s*(?:\(\s*\d+\s*\))?/gi, "TIMESTAMP");
  r = r.replace(/\bDATETIMEOFFSET\s*(?:\(\s*\d+\s*\))?/gi, "TIMESTAMP");
  r = r.replace(/\bSMALLDATETIME\b/gi, "TIMESTAMP");
  r = r.replace(/\bMONEY\b/gi, "DECIMAL");
  r = r.replace(/\bSMALLMONEY\b/gi, "DECIMAL");
  r = r.replace(/\bBIT\b/gi, "INTEGER");
  // IDENTITY(seed, incr) — drop; autoinc detected from original SQL.
  r = r.replace(/\bIDENTITY\s*(?:\(\s*\d+\s*,\s*\d+\s*\))?/gi, "");
  // Trailing storage clauses on CREATE TABLE / INDEX:
  // ON [PRIMARY], TEXTIMAGE_ON, FILESTREAM_ON, WITH (...) (index/table options)
  r = r.replace(/\bON\s+(?:\[\s*\w+\s*\]|"\w+"|\w+)\s*(?:\(\s*\w+\s*\))?/gi, "");
  r = r.replace(/\bTEXTIMAGE_ON\s+(?:\[\s*\w+\s*\]|"\w+"|\w+)/gi, "");
  r = r.replace(/\bFILESTREAM_ON\s+(?:\[\s*\w+\s*\]|"\w+"|\w+)/gi, "");
  r = r.replace(/\bWITH\s*\([^)]*\)/gi, "");
  // CONSTRAINT name DEFAULT (val) FOR col — flatten to DEFAULT val (sql.js
  // accepts inline DEFAULT expressions in column defs only; this surfaces in
  // ALTER TABLE … ADD DEFAULT which we ignore at parse time).
  r = r.replace(/\bGETDATE\s*\(\s*\)/gi, "CURRENT_TIMESTAMP");
  r = r.replace(/\bSYSDATETIME\s*\(\s*\)/gi, "CURRENT_TIMESTAMP");
  r = r.replace(/\bGETUTCDATE\s*\(\s*\)/gi, "CURRENT_TIMESTAMP");
  r = r.replace(/\bNEWID\s*\(\s*\)/gi, "''");
  r = r.replace(/\bNEWSEQUENTIALID\s*\(\s*\)/gi, "''");
  // CLUSTERED / NONCLUSTERED keywords on PK/UNIQUE/INDEX
  r = r.replace(/\b(?:NON)?CLUSTERED\b/gi, "");
  // ASC / DESC after column refs in indexes — sql.js accepts this; safe to keep.
  // [name] type COLLATE … — strip collations
  r = r.replace(/\bCOLLATE\s+[\w\d_]+/gi, "");
  return r;
}

function preprocessOracle(sql: string): string {
  let r = sql;
  // Drop schema prefixes like SYS. / HR.
  r = r.replace(/\b[A-Z][A-Z0-9_]*\s*\./g, (m) => {
    // Conservative: only drop ALL-CAPS prefixes that look like schema
    // names. Mixed-case "Public.Foo" we leave alone.
    return /^[A-Z][A-Z0-9_]*\s*\.$/.test(m) ? "" : m;
  });
  // Oracle types → SQLite-friendly equivalents.
  r = r.replace(/\bN?VARCHAR2\s*\(([^)]*)\)/gi, "VARCHAR($1)");
  r = r.replace(/\bN?CLOB\b/gi, "TEXT");
  r = r.replace(/\bBINARY_DOUBLE\b/gi, "DOUBLE");
  r = r.replace(/\bBINARY_FLOAT\b/gi, "FLOAT");
  r = r.replace(/\bRAW\s*\(\s*\d+\s*\)/gi, "BLOB");
  r = r.replace(/\bLONG\s+RAW\b/gi, "BLOB");
  r = r.replace(/\bBFILE\b/gi, "BLOB");
  // NUMBER(p) / NUMBER(p,s) / bare NUMBER → INTEGER (sql.js accepts).
  r = r.replace(/\bNUMBER\s*\(\s*\d+\s*,\s*0\s*\)/gi, "INTEGER");
  r = r.replace(/\bNUMBER\s*\(\s*\d+\s*\)/gi, "INTEGER");
  r = r.replace(/\bNUMBER\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi, "DECIMAL($1,$2)");
  r = r.replace(/\bNUMBER\b/gi, "DECIMAL");
  // Oracle DATE includes time-of-day; treat as TIMESTAMP for canvas-shape
  // purposes (we lose the distinction but avoid broken parses).
  r = r.replace(/\bTIMESTAMP\s*\(\s*\d+\s*\)\s+WITH\s+(?:LOCAL\s+)?TIME\s+ZONE\b/gi, "TIMESTAMP");
  r = r.replace(/\bTIMESTAMP\s+WITH\s+(?:LOCAL\s+)?TIME\s+ZONE\b/gi, "TIMESTAMP");
  r = r.replace(/\bTIMESTAMP\s*\(\s*\d+\s*\)/gi, "TIMESTAMP");
  // SERIAL-equivalents
  r = r.replace(/\bGENERATED\s+(?:ALWAYS|BY\s+DEFAULT)(?:\s+ON\s+NULL)?\s+AS\s+IDENTITY(?:\s*\([^)]*\))?/gi, "");
  // Defaults that sql.js can't evaluate
  r = r.replace(/\bDEFAULT\s+SYS_GUID\s*\(\s*\)/gi, "");
  r = r.replace(/\bDEFAULT\s+SYSDATE\b/gi, "DEFAULT CURRENT_TIMESTAMP");
  r = r.replace(/\bDEFAULT\s+SYSTIMESTAMP\b/gi, "DEFAULT CURRENT_TIMESTAMP");
  // Storage clauses + tablespace + segment options on CREATE TABLE.
  r = r.replace(/\bSTORAGE\s*\([^)]*\)/gi, "");
  r = r.replace(/\bTABLESPACE\s+[\w$]+/gi, "");
  r = r.replace(/\bPCTFREE\s+\d+/gi, "");
  r = r.replace(/\bPCTUSED\s+\d+/gi, "");
  r = r.replace(/\bINITRANS\s+\d+/gi, "");
  r = r.replace(/\bMAXTRANS\s+\d+/gi, "");
  r = r.replace(/\bLOGGING\b/gi, "");
  r = r.replace(/\bNOLOGGING\b/gi, "");
  r = r.replace(/\bCOMPRESS(?:\s+\w+)?/gi, "");
  r = r.replace(/\bNOCOMPRESS\b/gi, "");
  r = r.replace(/\bCACHE\b/gi, "");
  r = r.replace(/\bNOCACHE\b/gi, "");
  r = r.replace(/\bENABLE\s+ROW\s+MOVEMENT\b/gi, "");
  r = r.replace(/\bSEGMENT\s+CREATION\s+(?:DEFERRED|IMMEDIATE)/gi, "");
  // ENABLE / DISABLE / VALIDATE on CHECK / FK constraints
  r = r.replace(/\b(?:ENABLE|DISABLE|VALIDATE|NOVALIDATE)\b/gi, "");
  // USING INDEX (...) clause on PK / UNIQUE
  r = r.replace(/\bUSING\s+INDEX\s*\([^)]*\)/gi, "");
  // Drop CREATE OR REPLACE EDITIONABLE prefix etc.
  r = r.replace(/\bEDITIONABLE\b/gi, "");
  return r;
}

function preprocessSql(
  sql: string,
  dialect: "postgresql" | "mysql" | "sqlite" | "mssql" | "oracle"
): string {
  let r = preprocessCommon(sql);
  if (dialect === "mysql") r = preprocessMysql(r);
  else if (dialect === "postgresql") r = preprocessPostgres(r);
  else if (dialect === "mssql") r = preprocessMssql(r);
  else if (dialect === "oracle") r = preprocessOracle(r);
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
      /^\s*CREATE\s+(?:TEMP(?:ORARY)?\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:(?:[`"]?\w+[`"]?|\[\w+\])\s*\.\s*)?(?:[`"]?(\w+)[`"]?|\[(\w+)\])/i
    );
    if (!tableMatch) continue;
    const tableName = (tableMatch[1] ?? tableMatch[2] ?? "").toLowerCase();
    if (!tableName) continue;
    const cols = new Set<string>();

    const parenStart = stmt.indexOf("(");
    const parenEnd = stmt.lastIndexOf(")");
    if (parenStart < 0 || parenEnd < 0 || parenEnd <= parenStart) continue;

    const body = stmt.substring(parenStart + 1, parenEnd);
    for (const part of splitTopLevelCommas(body)) {
      const trimmed = part.trim();
      const colMatch = trimmed.match(/^(?:[`"]?(\w+)[`"]?|\[(\w+)\])(?:\s|$)/);
      if (!colMatch) continue;
      const colName = colMatch[1] ?? colMatch[2];
      if (!colName) continue;
      if (NON_COLUMN_KEYWORDS.has(colName.toUpperCase())) continue;
      if (
        /\b(?:AUTO_INCREMENT|AUTOINCREMENT|BIGSERIAL|SMALLSERIAL|SERIAL)\b/i.test(
          trimmed
        ) ||
        /\bIDENTITY\s*(?:\(\s*\d+\s*,\s*\d+\s*\))?/i.test(trimmed)
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

// Per-statement parse warnings surfaced from `parseSqlToSchemaDetailed`.
// `excerpt` is the first ~120 chars of the offending statement so the user
// can locate it in their original input without re-running.
export interface ImportWarning {
  message: string;
  excerpt: string;
}

export interface ParseResult {
  schema: Schema;
  warnings: ImportWarning[];
  // Dialect actually used (auto-detection may pick a different one than the
  // requested `dialect`).
  dialect: "postgresql" | "mysql" | "sqlite" | "mssql" | "oracle";
}

export async function parseSqlToSchema(
  sql: string,
  dialect: SqlImportDialect = "auto"
): Promise<Schema> {
  const result = await parseSqlToSchemaDetailed(sql, dialect);
  return result.schema;
}

export async function parseSqlToSchemaDetailed(
  sql: string,
  dialect: SqlImportDialect = "auto"
): Promise<ParseResult> {
  const trimmed = sql.trim();
  if (!trimmed) {
    throw new Error("SQL is empty.");
  }

  const detected = detectDialect(trimmed);
  const primary: "postgresql" | "mysql" | "sqlite" | "mssql" | "oracle" =
    dialect === "auto" ? detected : dialect;

  // Try the requested (or auto-detected) dialect first. If it yields no
  // tables, fall back through the remaining dialects so a misclick on the
  // dialect tab doesn't leave the user staring at an unhelpful error.
  const candidates: (
    | "postgresql"
    | "mysql"
    | "sqlite"
    | "mssql"
    | "oracle"
  )[] = [primary];
  for (const d of [
    detected,
    "postgresql",
    "mysql",
    "mssql",
    "oracle",
    "sqlite",
  ] as const) {
    if (!candidates.includes(d)) candidates.push(d);
  }

  let firstError: Error | null = null;
  for (const candidate of candidates) {
    try {
      const out = await parseInDialect(trimmed, candidate);
      return { schema: out.schema, warnings: out.warnings, dialect: candidate };
    } catch (err) {
      if (!firstError && err instanceof Error) firstError = err;
    }
  }
  throw firstError ?? new Error("No tables could be parsed.");
}

async function parseInDialect(
  trimmed: string,
  resolvedDialect: "postgresql" | "mysql" | "sqlite" | "mssql" | "oracle"
): Promise<{ schema: Schema; warnings: ImportWarning[] }> {
  const autoincMap = buildAutoincMap(trimmed);
  const cleaned = preprocessSql(trimmed, resolvedDialect);

  const SQL = await initSqlJs({
    locateFile: (file: string) => `/${file}`,
  });
  const db = new SQL.Database();

  try {
    const statements = splitSqlStatements(cleaned);
    const errors: string[] = [];
    const warnings: ImportWarning[] = [];
    for (const stmt of statements) {
      const trimmedStmt = stmt.trim();
      if (!trimmedStmt) continue;
      if (!isSchemaShapeStatement(trimmedStmt)) continue;
      try {
        db.run(trimmedStmt);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const excerpt = `${trimmedStmt.slice(0, 120)}${trimmedStmt.length > 120 ? "…" : ""}`;
        errors.push(`Skipped a statement (${msg}): ${excerpt}`);
        warnings.push({ message: msg, excerpt });
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

    return { schema: { tables, relations }, warnings };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse SQL.";
    throw new Error(message);
  } finally {
    db.close();
  }
}
