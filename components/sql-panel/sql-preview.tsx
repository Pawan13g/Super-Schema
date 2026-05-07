"use client";

import { useMemo, useRef, useState } from "react";
import { useStoredState } from "@/lib/use-stored-state";
import { useSchema } from "@/lib/schema-store";
import { lintSchema, summarizeIssues } from "@/lib/schema-lint";
import { generateSql, type SqlDialect } from "@/lib/sql-generator";
import { generateModels, type ModelTarget } from "@/lib/model-generator";
import { highlightSql } from "@/lib/sql-highlight";
import { highlightCode } from "@/lib/code-highlight";
import {
  parseSqlToSchemaDetailed,
  type ImportWarning,
  type SqlImportDialect,
} from "@/lib/sql-import";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Loader } from "@/components/ui/loader";
import { Copy, Check, Download, FileJson, Code2, Search, Boxes, FileUp, Upload, AlertTriangle, History, Maximize2, Minimize2 } from "lucide-react";
import { Tip } from "@/components/ui/tip";
import { usePanelLayout } from "@/lib/panel-layout";
import { QueryPanel } from "./query-panel";
import { ProblemsPanel } from "./problems-panel";
import { SqlCodeEditor } from "./sql-code-editor";
import { VersionHistoryPanel } from "./version-history-panel";

const VALID_TABS = ["sql", "models", "query", "import", "problems", "history"] as const;
type SqlTab = (typeof VALID_TABS)[number];
const isSqlTab = (v: unknown): v is SqlTab =>
  typeof v === "string" && (VALID_TABS as readonly string[]).includes(v);
const isDialect = (v: unknown): v is SqlDialect =>
  v === "postgresql" || v === "mysql" || v === "sqlite" || v === "mssql";
const isModelTarget = (v: unknown): v is ModelTarget =>
  v === "prisma" ||
  v === "sequelize" ||
  v === "dbml" ||
  v === "graphql" ||
  v === "openapi";

export function SqlPreview() {
  const { schema, replaceSchema } = useSchema();
  const { isMaximized, toggle: toggleMax } = usePanelLayout();
  const sqlMax = isMaximized("sql");
  const [dialect, setDialect] = useStoredState<SqlDialect>(
    "super-schema:sql-dialect",
    "postgresql",
    { validate: isDialect }
  );
  const [modelTarget, setModelTarget] = useStoredState<ModelTarget>(
    "super-schema:sql-model-target",
    "prisma",
    { validate: isModelTarget }
  );
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useStoredState<SqlTab>(
    "super-schema:sql-active-tab",
    "sql",
    { validate: isSqlTab }
  );
  const [importSql, setImportSql] = useState("");
  const [importError, setImportError] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<ImportWarning[]>([]);
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
    () => generateModels(schema, modelTarget, dialect),
    [schema, modelTarget, dialect]
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
      modelTarget === "prisma"
        ? "schema.prisma"
        : modelTarget === "sequelize"
          ? "models.ts"
          : modelTarget === "dbml"
            ? "schema.dbml"
            : modelTarget === "graphql"
              ? "schema.graphql"
              : "openapi.json";
    const mime =
      modelTarget === "prisma"
        ? "text/plain"
        : modelTarget === "sequelize"
          ? "text/typescript"
          : modelTarget === "openapi"
            ? "application/json"
            : "text/plain";
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
    setImportWarnings([]);
    setImporting(true);

    try {
      const result = await parseSqlToSchemaDetailed(importSql, importDialect);
      replaceSchema(result.schema);
      setImportWarnings(result.warnings);
      // Stay on the import tab when there were per-statement failures so
      // the user can see what was skipped. Otherwise switch to SQL output.
      setActiveTab(result.warnings.length > 0 ? "import" : "sql");
      const tableCount = result.schema.tables.length;
      const skipped = result.warnings.length;
      const base = `Imported ${tableCount} table${tableCount === 1 ? "" : "s"}`;
      if (skipped > 0) {
        toast.warning(
          `${base} — ${skipped} statement${skipped === 1 ? "" : "s"} skipped (see Import tab for details)`
        );
      } else {
        toast.success(base);
      }
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
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          if (isSqlTab(v)) setActiveTab(v);
        }}
        className="flex h-full flex-col gap-0"
      >
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
                  <TabsTrigger value="mssql" className="text-[10px] px-2 h-5">
                    SQL Server
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
                  <TabsTrigger value="dbml" className="text-[10px] px-2 h-5">
                    DBML
                  </TabsTrigger>
                  <TabsTrigger value="graphql" className="text-[10px] px-2 h-5">
                    GraphQL
                  </TabsTrigger>
                  <TabsTrigger value="openapi" className="text-[10px] px-2 h-5">
                    OpenAPI
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
          <Tip label={sqlMax ? "Restore layout" : "Maximize SQL panel"}>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => toggleMax("sql")}
              className="ml-auto shrink-0"
            >
              {sqlMax ? (
                <Minimize2 className="size-3" />
              ) : (
                <Maximize2 className="size-3" />
              )}
            </Button>
          </Tip>
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
                  modelTarget === "prisma"
                    ? "prisma"
                    : modelTarget === "sequelize"
                      ? "typescript"
                      : modelTarget === "openapi"
                        ? "json"
                        : "plaintext"
                )}
              </code>
            </pre>
          </ScrollArea>
        </TabsContent>

        {/* Query Builder tab */}
        <TabsContent value="query" className="flex-1 overflow-hidden">
          <QueryPanel />
        </TabsContent>

        {/* SQL Import tab — strict three-row flex layout so the editor in
            the middle scrolls but the header (upload + dialect picker) and
            footer (Clear / Import buttons + warnings) stay anchored. */}
        <TabsContent
          value="import"
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".sql,.ddl,.txt,text/plain,application/sql"
            onChange={handleFilePicked}
            className="hidden"
          />
          {/* Header: wraps on small screens so the dialect tabs drop below
              the upload button instead of overflowing horizontally. */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
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
              <span className="hidden text-xs text-muted-foreground sm:inline">
                or paste DDL below
              </span>
            </div>
            <Tabs
              value={importDialect}
              onValueChange={(val) => setImportDialect(val as SqlImportDialect)}
              className="ml-auto"
            >
              <TabsList className="h-6 flex-wrap">
                <TabsTrigger value="auto" className="text-[10px] px-2 h-5">
                  Auto
                </TabsTrigger>
                <TabsTrigger value="postgresql" className="text-[10px] px-2 h-5">
                  PG
                </TabsTrigger>
                <TabsTrigger value="mysql" className="text-[10px] px-2 h-5">
                  MySQL
                </TabsTrigger>
                <TabsTrigger value="sqlite" className="text-[10px] px-2 h-5">
                  SQLite
                </TabsTrigger>
                <TabsTrigger value="mssql" className="text-[10px] px-2 h-5">
                  MSSQL
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Editor: `min-h-0` so flex-1 actually allows it to shrink within
              the column; otherwise CodeMirror's content can push the
              footer out of view as the user types more lines. */}
          <div className="flex min-h-0 flex-1 p-3">
            <SqlCodeEditor
              value={importSql}
              onChange={setImportSql}
              disabled={importing}
              placeholder="Paste SQL here..."
              dialect={importDialect}
            />
          </div>

          {importWarnings.length > 0 && (
            <div className="max-h-40 shrink-0 overflow-y-auto border-t bg-amber-500/[0.04] px-3 py-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                {importWarnings.length} statement
                {importWarnings.length === 1 ? "" : "s"} skipped
              </p>
              <ul className="space-y-1">
                {importWarnings.map((w, i) => (
                  <li
                    key={i}
                    className="rounded-md border border-amber-500/30 bg-background px-2 py-1.5 text-[11px]"
                  >
                    <p className="font-medium text-amber-700 dark:text-amber-400">
                      {w.message}
                    </p>
                    <pre className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
                      {w.excerpt}
                    </pre>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Footer: shrink-0 + sticky-feeling layout. Wraps on narrow
              viewports so error text and buttons don't overlap. */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
            <div className="line-clamp-2 min-w-0 flex-1 text-[11px] text-destructive">
              {importError ?? ""}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setImportSql("");
                  setImportError(null);
                  setImportWarnings([]);
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
        </TabsContent>
        {/* Problems tab */}
        <TabsContent
          value="problems"
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <ProblemsPanel />
        </TabsContent>

        {/* Version History tab */}
        <TabsContent
          value="history"
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <VersionHistoryPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

