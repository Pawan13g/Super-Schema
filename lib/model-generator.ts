import type { Schema, Table, Column, Relation, ColumnType } from "./types";

export type ModelTarget = "prisma" | "sequelize";

const PRISMA_TYPE_MAP: Record<ColumnType, string> = {
  INT: "Int",
  BIGINT: "BigInt",
  SMALLINT: "Int",
  SERIAL: "Int",
  FLOAT: "Float",
  DOUBLE: "Float",
  DECIMAL: "Decimal",
  BOOLEAN: "Boolean",
  VARCHAR: "String",
  TEXT: "String",
  CHAR: "String",
  DATE: "DateTime",
  TIMESTAMP: "DateTime",
  DATETIME: "DateTime",
  TIME: "DateTime",
  JSON: "Json",
  UUID: "String",
  BLOB: "Bytes",
};

const SEQUELIZE_TYPE_MAP: Record<ColumnType, string> = {
  INT: "DataTypes.INTEGER",
  BIGINT: "DataTypes.BIGINT",
  SMALLINT: "DataTypes.SMALLINT",
  SERIAL: "DataTypes.INTEGER",
  FLOAT: "DataTypes.FLOAT",
  DOUBLE: "DataTypes.DOUBLE",
  DECIMAL: "DataTypes.DECIMAL(10, 2)",
  BOOLEAN: "DataTypes.BOOLEAN",
  VARCHAR: "DataTypes.STRING",
  TEXT: "DataTypes.TEXT",
  CHAR: "DataTypes.CHAR",
  DATE: "DataTypes.DATEONLY",
  TIMESTAMP: "DataTypes.DATE",
  DATETIME: "DataTypes.DATE",
  TIME: "DataTypes.TIME",
  JSON: "DataTypes.JSON",
  UUID: "DataTypes.UUID",
  BLOB: "DataTypes.BLOB",
};

function pascalCase(s: string): string {
  return s
    .replace(/[_-]+/g, " ")
    .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (c) => c.toUpperCase());
}

function singularize(s: string): string {
  if (s.endsWith("ies")) return s.slice(0, -3) + "y";
  if (s.endsWith("ses") || s.endsWith("xes") || s.endsWith("zes")) return s.slice(0, -2);
  if (s.endsWith("s") && !s.endsWith("ss")) return s.slice(0, -1);
  return s;
}

function modelName(tableName: string): string {
  return pascalCase(singularize(tableName));
}

function generatePrismaField(
  col: Column,
  table: Table,
  relations: Relation[],
  allTables: Table[]
): string {
  const parts: string[] = [col.name];
  let type = PRISMA_TYPE_MAP[col.type];

  const isOptional = !col.constraints.includes("NOT NULL") && !col.constraints.includes("PRIMARY KEY");
  if (isOptional) type += "?";
  parts.push(type);

  const attrs: string[] = [];
  if (col.constraints.includes("PRIMARY KEY")) attrs.push("@id");
  if (col.constraints.includes("UNIQUE")) attrs.push("@unique");
  if (col.type === "SERIAL" || col.constraints.includes("AUTO_INCREMENT")) {
    attrs.push("@default(autoincrement())");
  } else if (col.type === "UUID" && col.constraints.includes("PRIMARY KEY")) {
    attrs.push("@default(uuid())");
  } else if (
    (col.type === "TIMESTAMP" || col.type === "DATETIME") &&
    col.defaultValue?.toUpperCase().includes("NOW")
  ) {
    attrs.push("@default(now())");
  } else if (col.constraints.includes("DEFAULT") && col.defaultValue) {
    attrs.push(`@default(${formatPrismaDefault(col.type, col.defaultValue)})`);
  }

  // Map column name if non-snake or with quotes
  if (col.name !== col.name.toLowerCase()) attrs.push(`@map("${col.name}")`);

  if (attrs.length) parts.push(attrs.join(" "));

  // Inline FK relation marker
  for (const rel of relations) {
    if (rel.sourceTable === table.id && rel.sourceColumn === col.id) {
      const target = allTables.find((t) => t.id === rel.targetTable);
      const targetCol = target?.columns.find((c) => c.id === rel.targetColumn);
      if (target && targetCol) {
        const relModelName = modelName(target.name);
        const relFieldName = singularize(target.name).toLowerCase();
        parts.push(
          `\n  ${relFieldName} ${relModelName}${isOptional ? "?" : ""} @relation(fields: [${col.name}], references: [${targetCol.name}])`
        );
      }
    }
  }

  return "  " + parts.join(" ");
}

function formatPrismaDefault(type: ColumnType, value: string): string {
  const stringTypes: ColumnType[] = ["VARCHAR", "TEXT", "CHAR", "DATE", "TIME", "JSON", "UUID"];
  if (stringTypes.includes(type)) {
    if (/^['"].*['"]$/.test(value)) return `"${value.slice(1, -1)}"`;
    return `"${value}"`;
  }
  if (type === "BOOLEAN") {
    return /^(1|true)$/i.test(value) ? "true" : "false";
  }
  return value;
}

function generatePrismaModel(
  table: Table,
  relations: Relation[],
  allTables: Table[]
): string {
  const lines: string[] = [];
  lines.push(`model ${modelName(table.name)} {`);

  for (const col of table.columns) {
    lines.push(generatePrismaField(col, table, relations, allTables));
  }

  // Add inverse (back-reference) lists
  for (const rel of relations) {
    if (rel.targetTable === table.id) {
      const sourceTable = allTables.find((t) => t.id === rel.sourceTable);
      if (sourceTable) {
        const childModel = modelName(sourceTable.name);
        const childField = sourceTable.name.toLowerCase();
        lines.push(`  ${childField} ${childModel}[]`);
      }
    }
  }

  for (const index of table.indexes ?? []) {
    const fields = index.columns
      .map((columnId) => table.columns.find((column) => column.id === columnId)?.name)
      .filter((name): name is string => Boolean(name));
    if (fields.length === 0) continue;
    const line = index.unique
      ? `  @@unique([${fields.join(", ")}])`
      : `  @@index([${fields.join(", ")}])`;
    lines.push(`\n${line}`);
  }

  // Map table name if needed
  if (table.name !== table.name.toLowerCase()) {
    lines.push(`\n  @@map("${table.name}")`);
  }

  lines.push("}");
  return lines.join("\n");
}

function generatePrismaSchema(schema: Schema): string {
  const header = `// Generated by Super Schema
// Prisma schema file — see https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
`;

  const models = schema.tables
    .map((t) => generatePrismaModel(t, schema.relations, schema.tables))
    .join("\n\n");

  return header + "\n" + models + "\n";
}

function generateSequelizeAttribute(col: Column): string {
  const lines: string[] = [];
  lines.push(`    ${col.name}: {`);
  lines.push(`      type: ${SEQUELIZE_TYPE_MAP[col.type]},`);

  if (col.constraints.includes("PRIMARY KEY")) lines.push("      primaryKey: true,");
  if (col.type === "SERIAL" || col.constraints.includes("AUTO_INCREMENT")) {
    lines.push("      autoIncrement: true,");
  }
  if (col.constraints.includes("UNIQUE")) lines.push("      unique: true,");
  if (col.constraints.includes("NOT NULL")) lines.push("      allowNull: false,");
  else lines.push("      allowNull: true,");

  if (col.constraints.includes("DEFAULT") && col.defaultValue) {
    lines.push(`      defaultValue: ${formatSequelizeDefault(col.type, col.defaultValue)},`);
  } else if (col.type === "UUID" && col.constraints.includes("PRIMARY KEY")) {
    lines.push("      defaultValue: DataTypes.UUIDV4,");
  }

  lines.push("    },");
  return lines.join("\n");
}

function formatSequelizeDefault(type: ColumnType, value: string): string {
  const stringTypes: ColumnType[] = ["VARCHAR", "TEXT", "CHAR", "DATE", "TIME", "UUID"];
  if (stringTypes.includes(type)) {
    if (/^['"].*['"]$/.test(value)) return `'${value.slice(1, -1)}'`;
    return `'${value}'`;
  }
  if (type === "BOOLEAN") return /^(1|true)$/i.test(value) ? "true" : "false";
  if (type === "TIMESTAMP" || type === "DATETIME") {
    if (value.toUpperCase().includes("NOW")) return "DataTypes.NOW";
    return `'${value.replace(/^['"]|['"]$/g, "")}'`;
  }
  return value;
}

function generateSequelizeModel(
  table: Table,
  relations: Relation[],
  allTables: Table[]
): string {
  const className = modelName(table.name);
  const lines: string[] = [];

  lines.push(`// ${className} model`);
  lines.push(`export const ${className} = sequelize.define('${className}', {`);

  for (const col of table.columns) {
    lines.push(generateSequelizeAttribute(col));
  }

  lines.push("  }, {");
  lines.push(`    tableName: '${table.name}',`);
  lines.push("    timestamps: false,");
  if ((table.indexes ?? []).length > 0) {
    lines.push("    indexes: [");
    for (const index of table.indexes ?? []) {
      const fields = index.columns
        .map((columnId) => table.columns.find((column) => column.id === columnId)?.name)
        .filter((name): name is string => Boolean(name));
      if (fields.length === 0) continue;
      lines.push("      {");
      lines.push(`        unique: ${index.unique ? "true" : "false"},`);
      lines.push(`        fields: [${fields.map((field) => `'${field}'`).join(", ")}],`);
      lines.push("      },");
    }
    lines.push("    ],");
  }
  lines.push("  });");

  // Associations
  const assocs: string[] = [];
  for (const rel of relations) {
    if (rel.sourceTable === table.id) {
      const target = allTables.find((t) => t.id === rel.targetTable);
      const sourceCol = table.columns.find((c) => c.id === rel.sourceColumn);
      if (target && sourceCol) {
        assocs.push(
          `${className}.belongsTo(${modelName(target.name)}, { foreignKey: '${sourceCol.name}' });`
        );
      }
    }
    if (rel.targetTable === table.id) {
      const source = allTables.find((t) => t.id === rel.sourceTable);
      const sourceCol = source?.columns.find((c) => c.id === rel.sourceColumn);
      if (source && sourceCol) {
        const fn = rel.type === "one-to-one" ? "hasOne" : "hasMany";
        assocs.push(
          `${className}.${fn}(${modelName(source.name)}, { foreignKey: '${sourceCol.name}' });`
        );
      }
    }
  }

  if (assocs.length) {
    lines.push("");
    lines.push(...assocs);
  }

  return lines.join("\n");
}

function generateSequelizeFile(schema: Schema): string {
  const header = `// Generated by Super Schema
// Sequelize models — npm i sequelize

import { Sequelize, DataTypes } from 'sequelize';

export const sequelize = new Sequelize(process.env.DATABASE_URL!, {
  dialect: 'postgres',
  logging: false,
});
`;

  const models = schema.tables
    .map((t) => generateSequelizeModel(t, schema.relations, schema.tables))
    .join("\n\n");

  return header + "\n" + models + "\n";
}

export function generateModels(schema: Schema, target: ModelTarget): string {
  if (schema.tables.length === 0) {
    return `// No tables defined yet.\n// Add tables in the sidebar to generate ${target} models.`;
  }
  return target === "prisma"
    ? generatePrismaSchema(schema)
    : generateSequelizeFile(schema);
}
