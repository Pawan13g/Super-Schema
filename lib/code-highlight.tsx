import React from "react";

const PRISMA_KEYWORDS = new Set([
  "model", "enum", "type", "datasource", "generator",
  "Int", "BigInt", "String", "Boolean", "DateTime", "Float",
  "Decimal", "Json", "Bytes",
]);

const PRISMA_ATTRS = new Set([
  "@id", "@unique", "@default", "@relation", "@map", "@@map",
  "@@index", "@@unique", "@updatedAt", "@db", "autoincrement",
  "uuid", "now", "cuid",
]);

const TS_KEYWORDS = new Set([
  "import", "from", "export", "const", "let", "var", "function",
  "return", "if", "else", "for", "while", "true", "false", "null",
  "undefined", "new", "class", "extends", "interface", "type",
  "enum", "as", "async", "await", "default", "this",
]);

const SEQUELIZE_TOKENS = new Set([
  "Sequelize", "DataTypes", "INTEGER", "BIGINT", "SMALLINT", "FLOAT",
  "DOUBLE", "DECIMAL", "BOOLEAN", "STRING", "TEXT", "CHAR", "DATE",
  "DATEONLY", "TIME", "JSON", "UUID", "UUIDV4", "BLOB", "NOW",
  "primaryKey", "autoIncrement", "unique", "allowNull", "defaultValue",
  "type", "tableName", "timestamps", "foreignKey", "belongsTo",
  "hasOne", "hasMany", "belongsToMany", "define",
]);

type Lang = "prisma" | "typescript" | "json" | "plaintext";

export function highlightCode(code: string, lang: Lang): React.ReactNode[] {
  return code.split("\n").map((line, i) => {
    const trimmed = line.trimStart();
    if (trimmed.startsWith("//") || trimmed.startsWith("#")) {
      return (
        <div key={i} className="text-muted-foreground/60">
          {line}
        </div>
      );
    }

    const tokens = line.split(/(\s+|[(){}\[\],;:?])/);
    return (
      <div key={i}>
        {tokens.map((token, j) => renderToken(token, j, lang))}
      </div>
    );
  });
}

function renderToken(token: string, key: number, lang: Lang): React.ReactNode {
  if (!token) return null;

  // Strings
  if (/^['"`].*['"`]$/.test(token) || /^['"`]/.test(token)) {
    return (
      <span key={key} className="text-emerald-600 dark:text-emerald-400">
        {token}
      </span>
    );
  }

  // Numbers
  if (/^\d+(\.\d+)?$/.test(token)) {
    return (
      <span key={key} className="text-amber-600 dark:text-amber-400">
        {token}
      </span>
    );
  }

  if (lang === "prisma") {
    if (PRISMA_KEYWORDS.has(token)) {
      return (
        <span key={key} className="font-semibold text-violet-600 dark:text-violet-400">
          {token}
        </span>
      );
    }
    // Attributes start with @ or @@
    if (token.startsWith("@")) {
      const base = token.split("(")[0];
      if (PRISMA_ATTRS.has(base) || base.startsWith("@@") || base.startsWith("@")) {
        return (
          <span key={key} className="text-pink-600 dark:text-pink-400">
            {token}
          </span>
        );
      }
    }
    // Optional type marker
    if (token.endsWith("?") || token.endsWith("[]")) {
      const base = token.replace(/[?\[\]]+$/, "");
      if (PRISMA_KEYWORDS.has(base) || /^[A-Z]/.test(base)) {
        return (
          <span key={key} className="text-cyan-600 dark:text-cyan-400">
            {token}
          </span>
        );
      }
    }
    // Pascal-case = model reference
    if (/^[A-Z][A-Za-z0-9]*$/.test(token)) {
      return (
        <span key={key} className="text-cyan-600 dark:text-cyan-400">
          {token}
        </span>
      );
    }
  }

  if (lang === "typescript") {
    if (TS_KEYWORDS.has(token)) {
      return (
        <span key={key} className="font-semibold text-violet-600 dark:text-violet-400">
          {token}
        </span>
      );
    }
    if (SEQUELIZE_TOKENS.has(token)) {
      return (
        <span key={key} className="text-cyan-600 dark:text-cyan-400">
          {token}
        </span>
      );
    }
  }

  return <span key={key}>{token}</span>;
}
