"use client";

import { useMemo, useState } from "react";
import { useSchema } from "@/lib/schema-store";
import { generateSql, type SqlDialect } from "@/lib/sql-generator";
import { highlightSql } from "@/lib/sql-highlight";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Copy, Check, Download, FileJson, Code2, Search } from "lucide-react";
import { QueryPanel } from "./query-panel";

export function SqlPreview() {
  const { schema } = useSchema();
  const [dialect, setDialect] = useState<SqlDialect>("postgresql");
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState("sql");

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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex h-full flex-col gap-0">
        {/* Header with tabs and controls */}
        <div className="flex items-center justify-between border-b px-3 py-1">
          <TabsList className="h-6">
            <TabsTrigger value="sql" className="text-[10px] px-2 h-5 gap-1">
              <Code2 className="size-3" />
              SQL Output
            </TabsTrigger>
            <TabsTrigger value="query" className="text-[10px] px-2 h-5 gap-1">
              <Search className="size-3" />
              Query Builder
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
        </div>

        {/* SQL Output tab */}
        <TabsContent value="sql" className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <pre className="p-3 font-mono text-xs leading-relaxed">
              <code>{highlightSql(sql)}</code>
            </pre>
          </ScrollArea>
        </TabsContent>

        {/* Query Builder tab */}
        <TabsContent value="query" className="flex-1 overflow-hidden">
          <QueryPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
