import type { Schema, Table, Column, Relation, ColumnType } from "./types";

export type SqlDialect = "postgresql" | "mysql" | "sqlite";

// Map our generic types to dialect-specific types
const TYPE_MAP: Record<SqlDialect, Partial<Record<ColumnType, string>>> = {
  postgresql: {
    INT: "INTEGER",
    BIGINT: "BIGINT",
    SMALLINT: "SMALLINT",
    SERIAL: "SERIAL",
    FLOAT: "REAL",
    DOUBLE: "DOUBLE PRECISION",
    DECIMAL: "NUMERIC",
    BOOLEAN: "BOOLEAN",
    VARCHAR: "VARCHAR(255)",
    TEXT: "TEXT",
    CHAR: "CHAR(1)",
    DATE: "DATE",
    TIMESTAMP: "TIMESTAMP",
    DATETIME: "TIMESTAMP",
    TIME: "TIME",
    JSON: "JSONB",
    UUID: "UUID",
    BLOB: "BYTEA",
  },
  mysql: {
    INT: "INT",
    BIGINT: "BIGINT",
    SMALLINT: "SMALLINT",
    SERIAL: "INT AUTO_INCREMENT",
    FLOAT: "FLOAT",
    DOUBLE: "DOUBLE",
    DECIMAL: "DECIMAL(10,2)",
    BOOLEAN: "TINYINT(1)",
    VARCHAR: "VARCHAR(255)",
    TEXT: "TEXT",
    CHAR: "CHAR(1)",
    DATE: "DATE",
    TIMESTAMP: "TIMESTAMP",
    DATETIME: "DATETIME",
    TIME: "TIME",
    JSON: "JSON",
    UUID: "CHAR(36)",
    BLOB: "BLOB",
  },
  sqlite: {
    INT: "INTEGER",
    BIGINT: "INTEGER",
    SMALLINT: "INTEGER",
    SERIAL: "INTEGER",
    FLOAT: "REAL",
    DOUBLE: "REAL",
    DECIMAL: "REAL",
    BOOLEAN: "INTEGER",
    VARCHAR: "TEXT",
    TEXT: "TEXT",
    CHAR: "TEXT",
    DATE: "TEXT",
    TIMESTAMP: "TEXT",
    DATETIME: "TEXT",
    TIME: "TEXT",
    JSON: "TEXT",
    UUID: "TEXT",
    BLOB: "BLOB",
  },
};

function mapType(type: ColumnType, dialect: SqlDialect): string {
  return TYPE_MAP[dialect][type] ?? type;
}

function quoteIdentifier(name: string, dialect: SqlDialect): string {
  if (dialect === "mysql") return `\`${name}\``;
  return `"${name}"`;
}

function quoteStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function generateColumnDef(col: Column, dialect: SqlDialect): string {
  const q = (n: string) => quoteIdentifier(n, dialect);
  const parts: string[] = [q(col.name)];

  // For SERIAL in MySQL, the type map already includes AUTO_INCREMENT
  const mappedType = mapType(col.type, dialect);

  // For SQLite SERIAL + PRIMARY KEY → INTEGER PRIMARY KEY AUTOINCREMENT
  if (dialect === "sqlite" && col.type === "SERIAL" && col.constraints.includes("PRIMARY KEY")) {
    parts.push("INTEGER PRIMARY KEY AUTOINCREMENT");
    // Add remaining constraints except PK and AUTO_INCREMENT
    for (const c of col.constraints) {
      if (c === "PRIMARY KEY" || c === "AUTO_INCREMENT") continue;
      if (c === "NOT NULL") parts.push("NOT NULL");
      if (c === "UNIQUE") parts.push("UNIQUE");
    }
    return parts.join(" ");
  }

  // For MySQL SERIAL type, skip separate AUTO_INCREMENT constraint
  if (dialect === "mysql" && col.type === "SERIAL") {
    parts.push(mappedType);
    for (const c of col.constraints) {
      if (c === "AUTO_INCREMENT") continue; // already in type
      if (c === "PRIMARY KEY") parts.push("PRIMARY KEY");
      if (c === "NOT NULL") parts.push("NOT NULL");
      if (c === "UNIQUE") parts.push("UNIQUE");
      if (c === "DEFAULT" && col.defaultValue) parts.push(`DEFAULT ${col.defaultValue}`);
    }
    return parts.join(" ");
  }

  parts.push(mappedType);

  for (const c of col.constraints) {
    if (c === "PRIMARY KEY") parts.push("PRIMARY KEY");
    if (c === "NOT NULL") parts.push("NOT NULL");
    if (c === "UNIQUE") parts.push("UNIQUE");
    if (c === "AUTO_INCREMENT") {
      if (dialect === "mysql") parts.push("AUTO_INCREMENT");
      // PostgreSQL uses SERIAL type instead; SQLite handled above
    }
    if (c === "DEFAULT" && col.defaultValue) parts.push(`DEFAULT ${col.defaultValue}`);
  }

  if (dialect === "mysql" && col.comment?.trim()) {
    parts.push(`COMMENT ${quoteStringLiteral(col.comment.trim())}`);
  }

  return parts.join(" ");
}

function generateForeignKeys(
  table: Table,
  relations: Relation[],
  allTables: Table[],
  dialect: SqlDialect
): string[] {
  const q = (n: string) => quoteIdentifier(n, dialect);
  const fks: string[] = [];

  for (const rel of relations) {
    if (rel.sourceTable !== table.id) continue;

    const targetTable = allTables.find((t) => t.id === rel.targetTable);
    const sourceCol = table.columns.find((c) => c.id === rel.sourceColumn);
    const targetCol = targetTable?.columns.find((c) => c.id === rel.targetColumn);

    if (!targetTable || !sourceCol || !targetCol) continue;

    fks.push(
      `  CONSTRAINT ${q(`fk_${table.name}_${sourceCol.name}`)} FOREIGN KEY (${q(sourceCol.name)}) REFERENCES ${q(targetTable.name)}(${q(targetCol.name)})`
    );
  }

  return fks;
}

// Map our cross-dialect IndexType down to what each engine actually supports.
// Returns either USING-clause text (PG, MySQL on btree/hash) or a token to
// promote the index syntax (MySQL FULLTEXT / SPATIAL).
function resolveIndexMethod(
  type: string | undefined,
  dialect: SqlDialect
): { syntaxKind: "regular" | "fulltext" | "spatial"; using: string | null } {
  const t = type ?? "btree";
  if (dialect === "postgresql") {
    // PG accepts btree, hash, gin, gist, brin, spgist.
    const pgMap: Record<string, string> = {
      btree: "btree",
      hash: "hash",
      gin: "gin",
      gist: "gist",
      brin: "brin",
      spgist: "spgist",
      // MySQL FULLTEXT → GIN with tsvector usually; we emit GIN as a sensible
      // default. Spatial → GIST.
      fulltext: "gin",
      spatial: "gist",
    };
    const using = pgMap[t] ?? "btree";
    return {
      syntaxKind: "regular",
      using: using === "btree" ? null : using,
    };
  }
  if (dialect === "mysql") {
    if (t === "fulltext") return { syntaxKind: "fulltext", using: null };
    if (t === "spatial") return { syntaxKind: "spatial", using: null };
    if (t === "hash") return { syntaxKind: "regular", using: "HASH" };
    // Everything else (gin, gist, brin, spgist, btree) collapses to BTREE.
    return { syntaxKind: "regular", using: null };
  }
  // SQLite ignores method entirely.
  return { syntaxKind: "regular", using: null };
}

function generateIndexStatements(table: Table, dialect: SqlDialect): string[] {
  const q = (n: string) => quoteIdentifier(n, dialect);
  const statements: string[] = [];

  for (const index of table.indexes ?? []) {
    const columns = index.columns
      .map((columnName) => table.columns.find((column) => column.id === columnName))
      .filter((column): column is Column => Boolean(column))
      .map((column) => q(column.name));

    if (columns.length === 0) continue;

    const indexName = index.name.trim() || `idx_${table.name}_${columns.join("_")}`;
    const method = resolveIndexMethod(index.type, dialect);

    if (method.syntaxKind === "fulltext") {
      // MySQL: CREATE FULLTEXT INDEX … ON tbl (cols)
      statements.push(
        `CREATE FULLTEXT INDEX ${q(indexName)} ON ${q(table.name)} (${columns.join(", ")});`
      );
      continue;
    }
    if (method.syntaxKind === "spatial") {
      statements.push(
        `CREATE SPATIAL INDEX ${q(indexName)} ON ${q(table.name)} (${columns.join(", ")});`
      );
      continue;
    }

    const unique = index.unique ? "UNIQUE " : "";
    if (dialect === "postgresql" && method.using) {
      statements.push(
        `CREATE ${unique}INDEX ${q(indexName)} ON ${q(table.name)} USING ${method.using} (${columns.join(", ")});`
      );
    } else if (dialect === "mysql" && method.using) {
      // MySQL syntax: CREATE [UNIQUE] INDEX name USING HASH ON tbl (cols).
      statements.push(
        `CREATE ${unique}INDEX ${q(indexName)} USING ${method.using} ON ${q(table.name)} (${columns.join(", ")});`
      );
    } else {
      statements.push(
        `CREATE ${unique}INDEX ${q(indexName)} ON ${q(table.name)} (${columns.join(", ")});`
      );
    }
  }

  return statements;
}

function generateCommentStatements(table: Table, dialect: SqlDialect): string[] {
  const q = (n: string) => quoteIdentifier(n, dialect);
  const statements: string[] = [];

  if (table.comment?.trim()) {
    const tableComment = quoteStringLiteral(table.comment.trim());

    if (dialect === "postgresql") {
      statements.push(`COMMENT ON TABLE ${q(table.name)} IS ${tableComment};`);
    } else if (dialect === "mysql") {
      statements.push(`ALTER TABLE ${q(table.name)} COMMENT = ${tableComment};`);
    } else {
      statements.push(`-- Comment on ${table.name}: ${table.comment.trim()}`);
    }
  }

  for (const col of table.columns) {
    if (!col.comment?.trim()) continue;
    const columnComment = quoteStringLiteral(col.comment.trim());

    if (dialect === "postgresql") {
      statements.push(`COMMENT ON COLUMN ${q(table.name)}.${q(col.name)} IS ${columnComment};`);
    } else if (dialect === "sqlite") {
      statements.push(`-- Comment on ${table.name}.${col.name}: ${col.comment.trim()}`);
    }
  }

  return statements;
}

function generateTableSql(
  table: Table,
  relations: Relation[],
  allTables: Table[],
  dialect: SqlDialect
): string {
  const q = (n: string) => quoteIdentifier(n, dialect);
  const lines: string[] = [];

  for (const col of table.columns) {
    lines.push(`  ${generateColumnDef(col, dialect)}`);
  }

  const fks = generateForeignKeys(table, relations, allTables, dialect);
  lines.push(...fks);

  const header = `CREATE TABLE ${q(table.name)}`;
  return `${header} (\n${lines.join(",\n")}\n);`;
}

export function generateSql(schema: Schema, dialect: SqlDialect): string {
  if (schema.tables.length === 0) {
    return `-- No tables defined yet.\n-- Add tables in the sidebar to generate SQL.`;
  }

  const header = `-- Generated by Super Schema\n-- Dialect: ${dialect.toUpperCase()}\n-- Generated at: ${new Date().toISOString()}\n`;

  const statements = schema.tables.map((table) =>
    generateTableSql(table, schema.relations, schema.tables, dialect)
  );

  const extras = schema.tables.flatMap((table) => [
    ...generateIndexStatements(table, dialect),
    ...generateCommentStatements(table, dialect),
  ]);

  return header + "\n" + [...statements, ...extras].join("\n\n") + "\n";
}
