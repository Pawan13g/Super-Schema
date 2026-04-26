import React from "react";

const SQL_KEYWORDS = new Set([
  "SELECT", "FROM", "WHERE", "JOIN", "LEFT", "RIGHT", "INNER", "OUTER",
  "FULL", "CROSS", "ON", "AND", "OR", "IN", "EXISTS", "BETWEEN", "LIKE",
  "IS", "AS", "ORDER", "BY", "GROUP", "HAVING", "LIMIT", "OFFSET",
  "UNION", "ALL", "DISTINCT", "INSERT", "INTO", "VALUES", "UPDATE", "SET",
  "DELETE", "COUNT", "SUM", "AVG", "MIN", "MAX", "CASE", "WHEN", "THEN",
  "ELSE", "END", "ASC", "DESC", "WITH", "RECURSIVE",
  "CREATE", "TABLE", "PRIMARY", "KEY", "FOREIGN", "NOT", "NULL", "UNIQUE",
  "DEFAULT", "REFERENCES", "CONSTRAINT", "AUTO_INCREMENT", "AUTOINCREMENT",
  "SERIAL", "INTEGER", "VARCHAR", "TEXT", "BOOLEAN", "TIMESTAMP", "JSONB",
  "JSON", "BYTEA", "REAL", "BIGINT", "SMALLINT", "NUMERIC", "DATE", "TIME",
  "DATETIME", "DOUBLE", "PRECISION", "FLOAT", "CHAR", "BLOB", "UUID",
  "TINYINT", "INT", "DECIMAL", "INDEX", "IF", "DROP", "ALTER", "ADD",
  "COLUMN", "CASCADE", "RESTRICT", "NO", "ACTION",
]);

export function highlightSql(sql: string): React.ReactNode[] {
  return sql.split("\n").map((line, i) => {
    if (line.trimStart().startsWith("--")) {
      return (
        <div key={i} className="text-muted-foreground/60">
          {line}
        </div>
      );
    }

    const tokens = line.split(/(\s+|[(),;])/);
    return (
      <div key={i}>
        {tokens.map((token, j) => {
          const upper = token.toUpperCase();
          if (SQL_KEYWORDS.has(upper)) {
            return (
              <span key={j} className="text-indigo-500 dark:text-indigo-400 font-semibold">
                {token}
              </span>
            );
          }
          if (/^["'`]/.test(token)) {
            return (
              <span key={j} className="text-emerald-600 dark:text-emerald-400">
                {token}
              </span>
            );
          }
          if (/^\d+/.test(token)) {
            return (
              <span key={j} className="text-amber-600 dark:text-amber-400">
                {token}
              </span>
            );
          }
          return <span key={j}>{token}</span>;
        })}
      </div>
    );
  });
}
