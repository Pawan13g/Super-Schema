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

function generateColumnDef(
  col: Column,
  dialect: SqlDialect,
  table: Table
): string {
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

function generateTableSql(
  table: Table,
  relations: Relation[],
  allTables: Table[],
  dialect: SqlDialect
): string {
  const q = (n: string) => quoteIdentifier(n, dialect);
  const lines: string[] = [];

  for (const col of table.columns) {
    lines.push(`  ${generateColumnDef(col, dialect, table)}`);
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

  return header + "\n" + statements.join("\n\n") + "\n";
}
