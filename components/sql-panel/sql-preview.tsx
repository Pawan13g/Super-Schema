"use client";

import { useMemo, useRef, useState } from "react";
import { useSchema } from "@/lib/schema-store";
import { lintSchema, summarizeIssues } from "@/lib/schema-lint";
import { generateSql, type SqlDialect } from "@/lib/sql-generator";
import { generateModels, type ModelTarget } from "@/lib/model-generator";
import { highlightSql } from "@/lib/sql-highlight";
import { highlightCode } from "@/lib/code-highlight";
import { parseSqlToSchema, type SqlImportDialect } from "@/lib/sql-import";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader } from "@/components/ui/loader";
import { Copy, Check, Download, FileJson, Code2, Search, Boxes, FileUp, Upload, AlertTriangle, History } from "lucide-react";
import { QueryPanel } from "./query-panel";
import { ProblemsPanel } from "./problems-panel";
import { VersionHistoryPanel } from "./version-history-panel";

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFilePicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/\.(sql|ddl|txt)$/i.test(file.name)) {
      toast.error("Pick a .sql, .ddl, or .txt file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too big (max 5 MB)");
      return;
    }
    try {
      const text = await file.text();
      setImportSql(text);
      setImportError(null);
      setActiveTab("import");
      toast.success(`Loaded ${file.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to read file");
    }
  };

  const lintIssues = useMemo(() => lintSchema(schema), [schema]);
  const lintSummary = summarizeIssues(lintIssues);
  const totalProblems = lintIssues.length;

  const sql = useMemo(() => generateSql(schema, dialect), [schema, dialect]);
  const models = useMemo(
    () => generateModels(schema, modelTarget),
    [schema, modelTarget]
  );

  const handleCopy = async () => {
    const text = activeTab === "models" ? models : sql;
    await navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
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
      toast.success(
        `Imported ${nextSchema.tables.length} table${nextSchema.tables.length === 1 ? "" : "s"}`
      );
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : "Failed to import SQL.";
      setImportError(msg);
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-card">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col gap-0">
        {/* Header with tabs and controls */}
        <div className="flex items-center justify-between gap-2 overflow-x-auto border-b px-3 py-1">
          <TabsList className="h-6 shrink-0">
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
            <TabsTrigger value="problems" className="text-[10px] px-2 h-5 gap-1">
              <AlertTriangle className="size-3" />
              Problems
              {totalProblems > 0 && (
                <span className={`ml-0.5 rounded-full px-1.5 py-px text-[9px] font-semibold leading-none ${
                  lintSummary.error > 0
                    ? "bg-red-500/15 text-red-600"
                    : "bg-amber-500/15 text-amber-600"
                }`}>
                  {totalProblems}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="text-[10px] px-2 h-5 gap-1">
              <History className="size-3" />
              History
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
          <input
            ref={fileInputRef}
            type="file"
            accept=".sql,.ddl,.txt,text/plain,application/sql"
            onChange={handleFilePicked}
            className="hidden"
          />
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                >
                  <Upload className="size-3" />
                  Upload .sql
                </Button>
                <span className="text-xs text-muted-foreground">
                  or paste DDL below
                </span>
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
                  {importing ? <Loader size="xs" /> : "Import to Canvas"}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
        {/* Problems tab */}
        <TabsContent value="problems" className="flex-1 overflow-hidden">
          <ProblemsPanel />
        </TabsContent>

        {/* Version History tab */}
        <TabsContent value="history" className="flex-1 overflow-hidden">
          <VersionHistoryPanel />
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
