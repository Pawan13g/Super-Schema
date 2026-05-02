import type { Schema, Column, Relation, ColumnType, ColumnConstraint } from "./types";
import { diffSchemas, type SchemaDiff } from "./schema-diff";

export type SqlDialect = "postgresql" | "mysql" | "sqlite";

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

function quoteIdent(name: string, dialect: SqlDialect): string {
  if (dialect === "mysql") return `\`${name}\``;
  return `"${name}"`;
}

function inlineConstraints(col: Column, dialect: SqlDialect): string {
  const parts: string[] = [];
  for (const c of col.constraints) {
    if (c === "PRIMARY KEY") parts.push("PRIMARY KEY");
    else if (c === "NOT NULL") parts.push("NOT NULL");
    else if (c === "UNIQUE") parts.push("UNIQUE");
    else if (c === "AUTO_INCREMENT" && dialect === "mysql") parts.push("AUTO_INCREMENT");
    else if (c === "DEFAULT" && col.defaultValue) parts.push(`DEFAULT ${col.defaultValue}`);
  }
  return parts.join(" ");
}

function columnDef(col: Column, dialect: SqlDialect): string {
  const q = (n: string) => quoteIdent(n, dialect);
  const mapped = mapType(col.type, dialect);
  const tail = inlineConstraints(col, dialect);
  return [q(col.name), mapped, tail].filter(Boolean).join(" ");
}

function relationToFk(
  rel: Relation,
  schema: Schema,
  dialect: SqlDialect
): { table: string; constraint: string; constraintName: string } | null {
  const src = schema.tables.find((t) => t.id === rel.sourceTable);
  const tgt = schema.tables.find((t) => t.id === rel.targetTable);
  const sCol = src?.columns.find((c) => c.id === rel.sourceColumn);
  const tCol = tgt?.columns.find((c) => c.id === rel.targetColumn);
  if (!src || !tgt || !sCol || !tCol) return null;
  const q = (n: string) => quoteIdent(n, dialect);
  const name = `fk_${src.name}_${sCol.name}`;
  return {
    table: src.name,
    constraintName: name,
    constraint: `CONSTRAINT ${q(name)} FOREIGN KEY (${q(sCol.name)}) REFERENCES ${q(tgt.name)}(${q(tCol.name)})`,
  };
}

function constraintsChanged(a: Column, b: Column): {
  nullability?: "set-not-null" | "drop-not-null";
  defaultChanged?: boolean;
  uniqueAdded?: boolean;
  uniqueDropped?: boolean;
  pkAdded?: boolean;
  pkDropped?: boolean;
} {
  const aHas = (c: ColumnConstraint) => a.constraints.includes(c);
  const bHas = (c: ColumnConstraint) => b.constraints.includes(c);
  const out: ReturnType<typeof constraintsChanged> = {};
  if (!aHas("NOT NULL") && bHas("NOT NULL")) out.nullability = "set-not-null";
  if (aHas("NOT NULL") && !bHas("NOT NULL")) out.nullability = "drop-not-null";
  if ((a.defaultValue ?? "") !== (b.defaultValue ?? "")) out.defaultChanged = true;
  if (!aHas("UNIQUE") && bHas("UNIQUE")) out.uniqueAdded = true;
  if (aHas("UNIQUE") && !bHas("UNIQUE")) out.uniqueDropped = true;
  if (!aHas("PRIMARY KEY") && bHas("PRIMARY KEY")) out.pkAdded = true;
  if (aHas("PRIMARY KEY") && !bHas("PRIMARY KEY")) out.pkDropped = true;
  return out;
}

export interface MigrationResult {
  sql: string;
  warnings: string[];
}

export function generateMigrationSql(
  older: Schema,
  newer: Schema,
  dialect: SqlDialect
): MigrationResult {
  const diff: SchemaDiff = diffSchemas(older, newer);
  const warnings: string[] = [];
  const stmts: string[] = [];
  const q = (n: string) => quoteIdent(n, dialect);

  if (!diff.hasChanges) {
    return {
      sql: `-- No schema differences detected.\n-- Source and target schemas are identical.\n`,
      warnings,
    };
  }

  const oldTablesByName = new Map(older.tables.map((t) => [t.name, t]));
  const newTablesByName = new Map(newer.tables.map((t) => [t.name, t]));

  // 1. DROP TABLEs (removed)
  for (const td of diff.tables.filter((t) => t.kind === "removed")) {
    if (dialect === "postgresql") {
      stmts.push(`DROP TABLE IF EXISTS ${q(td.tableName)} CASCADE;`);
    } else {
      stmts.push(`DROP TABLE IF EXISTS ${q(td.tableName)};`);
    }
    warnings.push(`Dropping table "${td.tableName}" deletes all of its data.`);
  }

  // 2. CREATE TABLEs (added) — include FK constraints from new schema for those tables
  for (const td of diff.tables.filter((t) => t.kind === "added")) {
    const t = newTablesByName.get(td.tableName);
    if (!t) continue;
    const lines = t.columns.map((c) => `  ${columnDef(c, dialect)}`);
    const fkLines: string[] = [];
    for (const rel of newer.relations) {
      if (rel.sourceTable !== t.id) continue;
      const fk = relationToFk(rel, newer, dialect);
      if (fk) fkLines.push(`  ${fk.constraint}`);
    }
    stmts.push(
      `CREATE TABLE ${q(t.name)} (\n${[...lines, ...fkLines].join(",\n")}\n);`
    );
  }

  // 3. ALTER TABLEs (modified) — column add/drop/alter, plus FK delta
  for (const td of diff.tables.filter((t) => t.kind === "modified")) {
    const oldT = oldTablesByName.get(td.tableName);
    const newT = newTablesByName.get(td.tableName);
    if (!oldT || !newT) continue;

    const oldColsByName = new Map(oldT.columns.map((c) => [c.name, c]));
    const newColsByName = new Map(newT.columns.map((c) => [c.name, c]));

    // Column adds
    for (const c of newT.columns) {
      if (!oldColsByName.has(c.name)) {
        stmts.push(
          `ALTER TABLE ${q(newT.name)} ADD COLUMN ${columnDef(c, dialect)};`
        );
        if (c.constraints.includes("NOT NULL") && !c.defaultValue) {
          warnings.push(
            `Adding NOT NULL column "${newT.name}.${c.name}" with no default may fail on tables with existing rows.`
          );
        }
      }
    }

    // Column drops
    for (const c of oldT.columns) {
      if (!newColsByName.has(c.name)) {
        if (dialect === "sqlite") {
          stmts.push(
            `-- SQLite < 3.35 has limited DROP COLUMN support. Manual table rebuild may be needed.`
          );
        }
        stmts.push(`ALTER TABLE ${q(newT.name)} DROP COLUMN ${q(c.name)};`);
        warnings.push(`Dropping column "${newT.name}.${c.name}" deletes its data.`);
      }
    }

    // Column modifications
    for (const newCol of newT.columns) {
      const oldCol = oldColsByName.get(newCol.name);
      if (!oldCol) continue;
      const typeChanged = oldCol.type !== newCol.type;
      const cChanges = constraintsChanged(oldCol, newCol);

      // Type change
      if (typeChanged) {
        const mapped = mapType(newCol.type, dialect);
        if (dialect === "postgresql") {
          stmts.push(
            `ALTER TABLE ${q(newT.name)} ALTER COLUMN ${q(newCol.name)} TYPE ${mapped};`
          );
        } else if (dialect === "mysql") {
          stmts.push(
            `ALTER TABLE ${q(newT.name)} MODIFY COLUMN ${columnDef(newCol, dialect)};`
          );
        } else {
          stmts.push(
            `-- SQLite cannot ALTER COLUMN type for "${newT.name}.${newCol.name}". Manual table rebuild required.`
          );
        }
        warnings.push(
          `Type change "${newT.name}.${newCol.name}" ${oldCol.type} → ${newCol.type} may lose data or fail.`
        );
      }

      // Nullability
      if (cChanges.nullability && dialect !== "sqlite") {
        if (dialect === "postgresql") {
          stmts.push(
            cChanges.nullability === "set-not-null"
              ? `ALTER TABLE ${q(newT.name)} ALTER COLUMN ${q(newCol.name)} SET NOT NULL;`
              : `ALTER TABLE ${q(newT.name)} ALTER COLUMN ${q(newCol.name)} DROP NOT NULL;`
          );
        } else if (dialect === "mysql" && !typeChanged) {
          // MySQL nullability change requires MODIFY COLUMN with full def
          stmts.push(
            `ALTER TABLE ${q(newT.name)} MODIFY COLUMN ${columnDef(newCol, dialect)};`
          );
        }
        if (cChanges.nullability === "set-not-null") {
          warnings.push(
            `Setting "${newT.name}.${newCol.name}" NOT NULL fails if any row has NULL.`
          );
        }
      }

      // Default change
      if (cChanges.defaultChanged && dialect !== "sqlite") {
        if (dialect === "postgresql") {
          if (newCol.defaultValue) {
            stmts.push(
              `ALTER TABLE ${q(newT.name)} ALTER COLUMN ${q(newCol.name)} SET DEFAULT ${newCol.defaultValue};`
            );
          } else {
            stmts.push(
              `ALTER TABLE ${q(newT.name)} ALTER COLUMN ${q(newCol.name)} DROP DEFAULT;`
            );
          }
        } else if (dialect === "mysql" && !typeChanged && !cChanges.nullability) {
          stmts.push(
            `ALTER TABLE ${q(newT.name)} MODIFY COLUMN ${columnDef(newCol, dialect)};`
          );
        }
      }

      // UNIQUE add/drop (use named constraint for portability)
      if (cChanges.uniqueAdded) {
        const cn = `uq_${newT.name}_${newCol.name}`;
        stmts.push(
          `ALTER TABLE ${q(newT.name)} ADD CONSTRAINT ${q(cn)} UNIQUE (${q(newCol.name)});`
        );
      }
      if (cChanges.uniqueDropped) {
        const cn = `uq_${newT.name}_${newCol.name}`;
        if (dialect === "mysql") {
          stmts.push(`ALTER TABLE ${q(newT.name)} DROP INDEX ${q(cn)};`);
        } else {
          stmts.push(`ALTER TABLE ${q(newT.name)} DROP CONSTRAINT ${q(cn)};`);
        }
      }

      // PRIMARY KEY changes — flag as manual
      if (cChanges.pkAdded || cChanges.pkDropped) {
        stmts.push(
          `-- PRIMARY KEY change on "${newT.name}.${newCol.name}" needs manual review.`
        );
        warnings.push(
          `PRIMARY KEY change on "${newT.name}.${newCol.name}" not auto-generated; review manually.`
        );
      }
    }
  }

  // 4. Relation/FK deltas — add/drop FK constraints on existing tables
  // Build FK key maps per source table to find adds/drops independent of column changes above.
  const oldFkSet = new Set<string>();
  const newFkSet = new Set<string>();
  const fkKey = (r: Relation, schema: Schema) => {
    const s = schema.tables.find((t) => t.id === r.sourceTable);
    const t = schema.tables.find((t) => t.id === r.targetTable);
    const sc = s?.columns.find((c) => c.id === r.sourceColumn);
    const tc = t?.columns.find((c) => c.id === r.targetColumn);
    if (!s || !t || !sc || !tc) return null;
    return `${s.name}.${sc.name}->${t.name}.${tc.name}`;
  };
  const oldKeyToRel = new Map<string, Relation>();
  const newKeyToRel = new Map<string, Relation>();
  for (const r of older.relations) {
    const k = fkKey(r, older);
    if (k) {
      oldFkSet.add(k);
      oldKeyToRel.set(k, r);
    }
  }
  for (const r of newer.relations) {
    const k = fkKey(r, newer);
    if (k) {
      newFkSet.add(k);
      newKeyToRel.set(k, r);
    }
  }

  // FK adds — but skip if their source table was just CREATEd above (FKs already inline)
  const newlyCreatedTables = new Set(
    diff.tables.filter((t) => t.kind === "added").map((t) => t.tableName)
  );
  for (const k of newFkSet) {
    if (oldFkSet.has(k)) continue;
    const rel = newKeyToRel.get(k);
    if (!rel) continue;
    const fk = relationToFk(rel, newer, dialect);
    if (!fk) continue;
    if (newlyCreatedTables.has(fk.table)) continue;
    stmts.push(`ALTER TABLE ${q(fk.table)} ADD ${fk.constraint};`);
  }

  // FK drops — skip if source table was DROPped
  const droppedTables = new Set(
    diff.tables.filter((t) => t.kind === "removed").map((t) => t.tableName)
  );
  for (const k of oldFkSet) {
    if (newFkSet.has(k)) continue;
    const rel = oldKeyToRel.get(k);
    if (!rel) continue;
    const fk = relationToFk(rel, older, dialect);
    if (!fk) continue;
    if (droppedTables.has(fk.table)) continue;
    if (dialect === "mysql") {
      stmts.push(
        `ALTER TABLE ${q(fk.table)} DROP FOREIGN KEY ${q(fk.constraintName)};`
      );
    } else if (dialect === "sqlite") {
      stmts.push(
        `-- SQLite cannot drop FK on "${fk.table}" via ALTER. Manual table rebuild required.`
      );
    } else {
      stmts.push(
        `ALTER TABLE ${q(fk.table)} DROP CONSTRAINT ${q(fk.constraintName)};`
      );
    }
  }

  const header = `-- Migration generated by Super Schema\n-- Dialect: ${dialect.toUpperCase()}\n-- Generated at: ${new Date().toISOString()}\n`;
  const warnBlock = warnings.length
    ? "\n-- WARNINGS:\n" + warnings.map((w) => `--   * ${w}`).join("\n") + "\n"
    : "";

  return {
    sql: header + warnBlock + "\n" + stmts.join("\n\n") + "\n",
    warnings,
  };
}
