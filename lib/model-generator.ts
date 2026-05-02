import type { Schema, Table, Column, Relation, ColumnType } from "./types";

export type ModelTarget =
  | "prisma"
  | "sequelize"
  | "dbml"
  | "graphql"
  | "openapi";

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

// ─── DBML ─────────────────────────────────────────────────────────────

const DBML_TYPE_MAP: Record<ColumnType, string> = {
  INT: "int",
  BIGINT: "bigint",
  SMALLINT: "smallint",
  SERIAL: "int",
  FLOAT: "float",
  DOUBLE: "double",
  DECIMAL: "decimal",
  BOOLEAN: "boolean",
  VARCHAR: "varchar",
  TEXT: "text",
  CHAR: "char",
  DATE: "date",
  TIMESTAMP: "timestamp",
  DATETIME: "datetime",
  TIME: "time",
  JSON: "json",
  UUID: "uuid",
  BLOB: "blob",
};

function escapeDbmlString(s: string): string {
  return s.replace(/'/g, "\\'");
}

function generateDbml(schema: Schema): string {
  const lines: string[] = [
    "// Generated by Super Schema",
    "// DBML — see https://dbml.dbdiagram.io/docs/",
    "",
  ];

  for (const t of schema.tables) {
    const tableLines: string[] = [];
    tableLines.push(`Table ${t.name} {`);
    for (const col of t.columns) {
      const settings: string[] = [];
      if (col.constraints.includes("PRIMARY KEY")) settings.push("pk");
      if (col.constraints.includes("UNIQUE")) settings.push("unique");
      if (col.constraints.includes("NOT NULL")) settings.push("not null");
      if (col.type === "SERIAL" || col.constraints.includes("AUTO_INCREMENT")) {
        settings.push("increment");
      }
      if (col.constraints.includes("DEFAULT") && col.defaultValue) {
        settings.push(`default: \`${col.defaultValue}\``);
      }
      if (col.comment?.trim()) {
        settings.push(`note: '${escapeDbmlString(col.comment.trim())}'`);
      }
      const settingsStr = settings.length ? ` [${settings.join(", ")}]` : "";
      tableLines.push(`  ${col.name} ${DBML_TYPE_MAP[col.type]}${settingsStr}`);
    }
    for (const idx of t.indexes ?? []) {
      const cols = idx.columns
        .map((cid) => t.columns.find((c) => c.id === cid)?.name)
        .filter((n): n is string => !!n);
      if (cols.length === 0) continue;
      const opts: string[] = [`name: '${idx.name}'`];
      if (idx.unique) opts.push("unique");
      if (cols.length === 1) {
        tableLines.push(`  Indexes {`);
        tableLines.push(`    ${cols[0]} [${opts.join(", ")}]`);
        tableLines.push(`  }`);
      } else {
        tableLines.push(`  Indexes {`);
        tableLines.push(`    (${cols.join(", ")}) [${opts.join(", ")}]`);
        tableLines.push(`  }`);
      }
    }
    if (t.comment?.trim()) {
      tableLines.push(`  Note: '${escapeDbmlString(t.comment.trim())}'`);
    }
    tableLines.push("}");
    lines.push(...tableLines, "");
  }

  // Relationships — DBML uses Ref:
  // 1:1 → -, 1:N → <, N:1 → >, M:N → <>
  for (const rel of schema.relations) {
    const src = schema.tables.find((t) => t.id === rel.sourceTable);
    const tgt = schema.tables.find((t) => t.id === rel.targetTable);
    const sCol = src?.columns.find((c) => c.id === rel.sourceColumn);
    const tCol = tgt?.columns.find((c) => c.id === rel.targetColumn);
    if (!src || !tgt || !sCol || !tCol) continue;
    const op =
      rel.type === "one-to-one"
        ? "-"
        : rel.type === "many-to-many"
          ? "<>"
          : ">";
    lines.push(
      `Ref: ${src.name}.${sCol.name} ${op} ${tgt.name}.${tCol.name}`
    );
  }

  return lines.join("\n") + "\n";
}

// ─── GraphQL SDL ──────────────────────────────────────────────────────

const GQL_TYPE_MAP: Record<ColumnType, string> = {
  INT: "Int",
  BIGINT: "String",
  SMALLINT: "Int",
  SERIAL: "Int",
  FLOAT: "Float",
  DOUBLE: "Float",
  DECIMAL: "Float",
  BOOLEAN: "Boolean",
  VARCHAR: "String",
  TEXT: "String",
  CHAR: "String",
  DATE: "String",
  TIMESTAMP: "String",
  DATETIME: "String",
  TIME: "String",
  JSON: "JSON",
  UUID: "ID",
  BLOB: "String",
};

function generateGraphql(schema: Schema): string {
  const lines: string[] = [
    "# Generated by Super Schema",
    "# GraphQL SDL",
    "",
    "scalar JSON",
    "",
  ];

  for (const t of schema.tables) {
    if (t.comment?.trim()) {
      lines.push(`"""${t.comment.trim().replace(/"""/g, '"')}"""`);
    }
    lines.push(`type ${pascalCase(singularize(t.name))} {`);
    for (const col of t.columns) {
      const required =
        col.constraints.includes("NOT NULL") ||
        col.constraints.includes("PRIMARY KEY");
      const type = GQL_TYPE_MAP[col.type] + (required ? "!" : "");
      if (col.comment?.trim()) {
        lines.push(`  "${col.comment.trim().replace(/"/g, "'")}"`);
      }
      lines.push(`  ${col.name}: ${type}`);
    }
    // Inverse references (parent fields)
    for (const rel of schema.relations) {
      if (rel.sourceTable === t.id) {
        const tgt = schema.tables.find((x) => x.id === rel.targetTable);
        if (tgt) {
          const fname = singularize(tgt.name).toLowerCase();
          lines.push(
            `  ${fname}: ${pascalCase(singularize(tgt.name))}`
          );
        }
      }
      if (rel.targetTable === t.id) {
        const src = schema.tables.find((x) => x.id === rel.sourceTable);
        if (src) {
          const fname = src.name.toLowerCase();
          lines.push(
            `  ${fname}: [${pascalCase(singularize(src.name))}!]!`
          );
        }
      }
    }
    lines.push("}", "");
  }

  // Top-level Query stub
  lines.push("type Query {");
  for (const t of schema.tables) {
    const single = pascalCase(singularize(t.name));
    const lcSingle = singularize(t.name).toLowerCase();
    lines.push(`  ${lcSingle}(id: ID!): ${single}`);
    lines.push(`  ${t.name.toLowerCase()}: [${single}!]!`);
  }
  lines.push("}", "");

  return lines.join("\n");
}

// ─── OpenAPI ──────────────────────────────────────────────────────────

const OPENAPI_TYPE_MAP: Record<
  ColumnType,
  { type: string; format?: string }
> = {
  INT: { type: "integer", format: "int32" },
  BIGINT: { type: "integer", format: "int64" },
  SMALLINT: { type: "integer", format: "int32" },
  SERIAL: { type: "integer", format: "int32" },
  FLOAT: { type: "number", format: "float" },
  DOUBLE: { type: "number", format: "double" },
  DECIMAL: { type: "number" },
  BOOLEAN: { type: "boolean" },
  VARCHAR: { type: "string" },
  TEXT: { type: "string" },
  CHAR: { type: "string" },
  DATE: { type: "string", format: "date" },
  TIMESTAMP: { type: "string", format: "date-time" },
  DATETIME: { type: "string", format: "date-time" },
  TIME: { type: "string" },
  JSON: { type: "object" },
  UUID: { type: "string", format: "uuid" },
  BLOB: { type: "string", format: "binary" },
};

interface OpenApiSchemaProperty {
  type: string;
  format?: string;
  description?: string;
}
interface OpenApiSchemaObject {
  type: "object";
  description?: string;
  required?: string[];
  properties: Record<string, OpenApiSchemaProperty>;
}

function generateOpenApi(schema: Schema): string {
  const components: Record<string, OpenApiSchemaObject> = {};
  for (const t of schema.tables) {
    const required: string[] = [];
    const properties: Record<string, OpenApiSchemaProperty> = {};
    for (const col of t.columns) {
      const map = OPENAPI_TYPE_MAP[col.type];
      properties[col.name] = {
        type: map.type,
        ...(map.format ? { format: map.format } : {}),
        ...(col.comment?.trim() ? { description: col.comment.trim() } : {}),
      };
      if (
        col.constraints.includes("NOT NULL") ||
        col.constraints.includes("PRIMARY KEY")
      ) {
        required.push(col.name);
      }
    }
    components[pascalCase(singularize(t.name))] = {
      type: "object",
      ...(t.comment?.trim() ? { description: t.comment.trim() } : {}),
      ...(required.length ? { required } : {}),
      properties,
    };
  }

  // Minimal CRUD-ish paths per table.
  const paths: Record<string, unknown> = {};
  for (const t of schema.tables) {
    const single = pascalCase(singularize(t.name));
    const ref = `#/components/schemas/${single}`;
    paths[`/${t.name}`] = {
      get: {
        summary: `List ${t.name}`,
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { type: "array", items: { $ref: ref } },
              },
            },
          },
        },
      },
      post: {
        summary: `Create ${single}`,
        requestBody: {
          required: true,
          content: { "application/json": { schema: { $ref: ref } } },
        },
        responses: {
          "201": {
            description: "Created",
            content: { "application/json": { schema: { $ref: ref } } },
          },
        },
      },
    };
    paths[`/${t.name}/{id}`] = {
      parameters: [
        {
          name: "id",
          in: "path",
          required: true,
          schema: { type: "string" },
        },
      ],
      get: {
        summary: `Get ${single} by id`,
        responses: {
          "200": {
            description: "OK",
            content: { "application/json": { schema: { $ref: ref } } },
          },
          "404": { description: "Not found" },
        },
      },
      delete: {
        summary: `Delete ${single}`,
        responses: { "204": { description: "Deleted" } },
      },
    };
  }

  const doc = {
    openapi: "3.1.0",
    info: {
      title: "Super Schema API",
      version: "1.0.0",
      description: "Auto-generated from Super Schema",
    },
    paths,
    components: { schemas: components },
  };

  return JSON.stringify(doc, null, 2) + "\n";
}

export function generateModels(schema: Schema, target: ModelTarget): string {
  if (schema.tables.length === 0) {
    return `// No tables defined yet.\n// Add tables in the sidebar to generate ${target} output.`;
  }
  switch (target) {
    case "prisma":
      return generatePrismaSchema(schema);
    case "sequelize":
      return generateSequelizeFile(schema);
    case "dbml":
      return generateDbml(schema);
    case "graphql":
      return generateGraphql(schema);
    case "openapi":
      return generateOpenApi(schema);
  }
}
