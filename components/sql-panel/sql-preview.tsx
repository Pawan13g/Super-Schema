"use client";

import { useMemo, useState } from "react";
import { useSchema } from "@/lib/schema-store";
import { generateSql, type SqlDialect } from "@/lib/sql-generator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Check, Download, FileJson, Code2 } from "lucide-react";

const SQL_KEYWORDS = new Set([
  "CREATE",
  "TABLE",
  "PRIMARY",
  "KEY",
  "FOREIGN",
  "NOT",
  "NULL",
  "UNIQUE",
  "DEFAULT",
  "REFERENCES",
  "CONSTRAINT",
  "AUTO_INCREMENT",
  "AUTOINCREMENT",
  "SERIAL",
  "INTEGER",
  "VARCHAR",
  "TEXT",
  "BOOLEAN",
  "TIMESTAMP",
  "JSONB",
  "JSON",
  "BYTEA",
  "REAL",
  "BIGINT",
  "SMALLINT",
  "NUMERIC",
  "DATE",
  "TIME",
  "DATETIME",
  "DOUBLE",
  "PRECISION",
  "FLOAT",
  "CHAR",
  "BLOB",
  "UUID",
  "TINYINT",
  "INT",
  "DECIMAL",
]);

function highlightSql(sql: string): React.ReactNode[] {
  return sql.split("\n").map((line, i) => {
    if (line.startsWith("--")) {
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

export function SqlPreview() {
  const { schema } = useSchema();
  const [dialect, setDialect] = useState<SqlDialect>("postgresql");
  const [copied, setCopied] = useState(false);

  const sql = useMemo(() => generateSql(schema, dialect), [schema, dialect]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadSql = () => {
    const ext = dialect === "postgresql" ? "pgsql" : dialect;
    const blob = new Blob([sql], { type: "text/sql" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `schema.${ext}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJson = () => {
    const json = JSON.stringify(schema, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "schema.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <div className="flex items-center gap-2">
          <Code2 className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">SQL Output</span>
        </div>

        <div className="flex items-center gap-1">
          <Tabs
            value={dialect}
            onValueChange={(val) => setDialect(val as SqlDialect)}
          >
            <TabsList className="h-6">
              <TabsTrigger value="postgresql" className="text-[10px] px-2 h-5">
                PostgreSQL
              </TabsTrigger>
              <TabsTrigger value="mysql" className="text-[10px] px-2 h-5">
                MySQL
              </TabsTrigger>
              <TabsTrigger value="sqlite" className="text-[10px] px-2 h-5">
                SQLite
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleCopy}
            title="Copy SQL"
          >
            {copied ? (
              <Check className="size-3 text-emerald-500" />
            ) : (
              <Copy className="size-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleDownloadSql}
            title="Download .sql"
          >
            <Download className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleDownloadJson}
            title="Export JSON"
          >
            <FileJson className="size-3" />
          </Button>
        </div>
      </div>

      {/* SQL Code */}
      <ScrollArea className="flex-1">
        <pre className="p-3 font-mono text-xs leading-relaxed">
          <code>{highlightSql(sql)}</code>
        </pre>
      </ScrollArea>
    </div>
  );
}
