"use client";

import { useMemo, useRef, useState } from "react";
import { useSchema } from "@/lib/schema-store";
import { generateSql, type SqlDialect } from "@/lib/sql-generator";
import { generateModels, type ModelTarget } from "@/lib/model-generator";
import { highlightSql } from "@/lib/sql-highlight";
import { highlightCode } from "@/lib/code-highlight";
import { parseSqlToSchema, type SqlImportDialect } from "@/lib/sql-import";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Check, Download, FileJson, Code2, Search, Boxes, FileUp, Loader2 } from "lucide-react";
import { QueryPanel } from "./query-panel";

export function SqlPreview() {
  const { schema, replaceSchema } = useSchema();
  const [dialect, setDialect] = useState<SqlDialect>("postgresql");
  const [modelTarget, setModelTarget] = useState<ModelTarget>("prisma");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("sql");
  const [importSql, setImportSql] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importDialect, setImportDialect] = useState<SqlImportDialect>("auto");

  const sql = useMemo(() => generateSql(schema, dialect), [schema, dialect]);
  const models = useMemo(
    () => generateModels(schema, modelTarget),
    [schema, modelTarget]
  );

  const handleCopy = async () => {
    const text = activeTab === "models" ? models : sql;
    await navigator.clipboard.writeText(text);
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

  const handleDownloadModels = () => {
    const filename =
      modelTarget === "prisma" ? "schema.prisma" : "models.ts";
    const mime =
      modelTarget === "prisma" ? "text/plain" : "text/typescript";
    const blob = new Blob([models], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSql = async () => {
    if (!importSql.trim() || importing) return;
    setImportError(null);
    setImporting(true);

    try {
      const nextSchema = await parseSqlToSchema(importSql, importDialect);
      replaceSchema(nextSchema);
      setActiveTab("sql");
    } catch (error) {
      setImportError(
        error instanceof Error ? error.message : "Failed to import SQL."
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-card">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col gap-0">
        {/* Header with tabs and controls */}
        <div className="flex items-center justify-between border-b px-3 py-1">
          <TabsList className="h-6">
            <TabsTrigger value="sql" className="text-[10px] px-2 h-5 gap-1">
              <Code2 className="size-3" />
              SQL Output
            </TabsTrigger>
            <TabsTrigger value="models" className="text-[10px] px-2 h-5 gap-1">
              <Boxes className="size-3" />
              Models
            </TabsTrigger>
            <TabsTrigger value="query" className="text-[10px] px-2 h-5 gap-1">
              <Search className="size-3" />
              Query Builder
            </TabsTrigger>
            <TabsTrigger value="import" className="text-[10px] px-2 h-5 gap-1">
              <FileUp className="size-3" />
              SQL Import
            </TabsTrigger>
          </TabsList>

          {activeTab === "sql" && (
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
          )}

          {activeTab === "models" && (
            <div className="flex items-center gap-1">
              <Tabs
                value={modelTarget}
                onValueChange={(val) => setModelTarget(val as ModelTarget)}
              >
                <TabsList className="h-6">
                  <TabsTrigger value="prisma" className="text-[10px] px-2 h-5">
                    Prisma
                  </TabsTrigger>
                  <TabsTrigger value="sequelize" className="text-[10px] px-2 h-5">
                    Sequelize
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleCopy}
                title="Copy models"
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
                onClick={handleDownloadModels}
                title="Download models"
              >
                <Download className="size-3" />
              </Button>
            </div>
          )}
        </div>

        {/* SQL Output tab */}
        <TabsContent value="sql" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <pre className="p-3 font-mono text-xs leading-relaxed">
              <code>{highlightSql(sql)}</code>
            </pre>
          </ScrollArea>
        </TabsContent>

        {/* Models tab */}
        <TabsContent value="models" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <pre className="p-3 font-mono text-xs leading-relaxed">
              <code>
                {highlightCode(
                  models,
                  modelTarget === "prisma" ? "prisma" : "typescript"
                )}
              </code>
            </pre>
          </ScrollArea>
        </TabsContent>

        {/* Query Builder tab */}
        <TabsContent value="query" className="flex-1 overflow-hidden">
          <QueryPanel />
        </TabsContent>

        {/* SQL Import tab */}
        <TabsContent value="import" className="flex-1 overflow-hidden">
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
              <div className="text-xs text-muted-foreground">
                Paste SQL DDL (CREATE TABLE/INDEX). Supports PostgreSQL, MySQL, and SQLite.
              </div>
              <Tabs
                value={importDialect}
                onValueChange={(val) => setImportDialect(val as SqlImportDialect)}
              >
                <TabsList className="h-6">
                  <TabsTrigger value="auto" className="text-[10px] px-2 h-5">
                    Auto
                  </TabsTrigger>
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
            </div>
            <div className="flex-1 p-3">
              <SqlCodeEditor
                value={importSql}
                onChange={setImportSql}
                disabled={importing}
                placeholder="Paste SQL here..."
              />
            </div>
            <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
              <div className="line-clamp-2 text-[11px] text-destructive">
                {importError ?? ""}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setImportSql("");
                    setImportError(null);
                  }}
                  disabled={importing}
                >
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={handleImportSql}
                  disabled={importing || !importSql.trim()}
                >
                  {importing ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    "Import to Canvas"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface SqlCodeEditorProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

function SqlCodeEditor({ value, onChange, disabled, placeholder }: SqlCodeEditorProps) {
  const preRef = useRef<HTMLPreElement>(null);

  const syncScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (preRef.current) {
      preRef.current.scrollTop = e.currentTarget.scrollTop;
      preRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const next = value.substring(0, start) + "  " + value.substring(end);
      onChange(next);
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      });
    }
  };

  return (
    <div className="relative h-full w-full overflow-hidden rounded-md border bg-background focus-within:ring-1 focus-within:ring-ring">
      <pre
        ref={preRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 m-0 overflow-hidden whitespace-pre p-2 font-mono text-xs leading-relaxed"
      >
        <code>
          {value ? (
            highlightSql(value)
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </code>
      </pre>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onScroll={syncScroll}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        wrap="off"
        className="relative block h-full w-full resize-none overflow-auto whitespace-pre bg-transparent p-2 font-mono text-xs leading-relaxed text-transparent caret-foreground outline-none placeholder:text-transparent disabled:cursor-not-allowed"
        style={{ WebkitTextFillColor: "transparent" }}
      />
    </div>
  );
}
