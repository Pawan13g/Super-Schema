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
  defaultValue?: string;
  references?: {
    table: string;
    column: string;
  };
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
