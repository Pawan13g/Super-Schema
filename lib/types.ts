export type ColumnConstraint =
  | "PRIMARY KEY"
  | "NOT NULL"
  | "UNIQUE"
  | "AUTO_INCREMENT"
  | "DEFAULT"
  | "CHECK"
  | "REFERENCES";

export type ColumnType =
  | "INT"
  | "BIGINT"
  | "SMALLINT"
  | "SERIAL"
  | "FLOAT"
  | "DOUBLE"
  | "DECIMAL"
  | "BOOLEAN"
  | "VARCHAR"
  | "TEXT"
  | "CHAR"
  | "DATE"
  | "TIMESTAMP"
  | "DATETIME"
  | "TIME"
  | "JSON"
  | "UUID"
  | "BLOB";

export const COLUMN_TYPES: ColumnType[] = [
  "INT",
  "BIGINT",
  "SMALLINT",
  "SERIAL",
  "FLOAT",
  "DOUBLE",
  "DECIMAL",
  "BOOLEAN",
  "VARCHAR",
  "TEXT",
  "CHAR",
  "DATE",
  "TIMESTAMP",
  "DATETIME",
  "TIME",
  "JSON",
  "UUID",
  "BLOB",
];

export const COLUMN_CONSTRAINTS: ColumnConstraint[] = [
  "PRIMARY KEY",
  "NOT NULL",
  "UNIQUE",
  "AUTO_INCREMENT",
  "DEFAULT",
  "CHECK",
  "REFERENCES",
];

export interface Column {
  id: string;
  name: string;
  type: ColumnType;
  constraints: ColumnConstraint[];
  comment?: string;
  defaultValue?: string;
  references?: {
    table: string;
    column: string;
  };
}

// Common index method names across PostgreSQL, MySQL, SQLite. Not every
// dialect supports every kind — the SQL generator picks a sensible fallback.
//
// - btree: default ordered index, all dialects.
// - hash: equality only. PG supports HASH; MySQL maps memory-engine; SQLite
//   ignores and falls back to B-tree.
// - gin: PG inverted index for arrays / jsonb / tsvector full-text.
// - gist: PG generalized search tree (geometry, ranges, exclusion).
// - brin: PG block-range index for very large append-only tables.
// - spgist: PG space-partitioned GiST (quad-trees, radix).
// - fulltext: MySQL FULLTEXT, mapped to GIN on PG.
// - spatial: MySQL SPATIAL on geometry, mapped to GIST on PG.
export type IndexType =
  | "btree"
  | "hash"
  | "gin"
  | "gist"
  | "brin"
  | "spgist"
  | "fulltext"
  | "spatial";

export const INDEX_TYPES: IndexType[] = [
  "btree",
  "hash",
  "gin",
  "gist",
  "brin",
  "spgist",
  "fulltext",
  "spatial",
];

export const INDEX_TYPE_LABELS: Record<IndexType, string> = {
  btree: "B-tree (default)",
  hash: "Hash (equality)",
  gin: "GIN (jsonb / arrays / tsvector)",
  gist: "GiST (geometry / ranges)",
  brin: "BRIN (large append-only)",
  spgist: "SP-GiST (quad / radix)",
  fulltext: "Full-text",
  spatial: "Spatial",
};

export interface TableIndex {
  id: string;
  name: string;
  columns: string[];
  unique: boolean;
  // Index method. Defaults to "btree" for backwards compatibility — older
  // schemas saved without this field continue to round-trip.
  type?: IndexType;
}

export const TABLE_COLORS = [
  "#4f46e5", // indigo
  "#7c3aed", // violet
  "#db2777", // pink
  "#ea580c", // orange
  "#0891b2", // cyan
  "#059669", // emerald
  "#d97706", // amber
  "#dc2626", // red
] as const;

export interface Table {
  id: string;
  name: string;
  color: string;
  columns: Column[];
  indexes: TableIndex[];
  comment: string;
  position: { x: number; y: number };
}

export interface Relation {
  id: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
  type: "one-to-one" | "one-to-many" | "many-to-many";
}

export interface Schema {
  tables: Table[];
  relations: Relation[];
}
