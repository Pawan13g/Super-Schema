"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useSchema } from "@/lib/schema-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader } from "@/components/ui/loader";
import { highlightSql } from "@/lib/sql-highlight";
import {
  Send,
  Zap,
  MessageCircleQuestion,
  Copy,
  Check,
  Trash2,
  Play,
  Table2,
} from "lucide-react";

interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTimeMs: number;
}

async function callAi(action: string, payload: Record<string, string>) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (data.code === "NO_KEY") {
      toast.error(data.error, {
        action: { label: "Open settings", onClick: () => (location.href = "/settings") },
      });
    }
    throw new Error(data.error ?? "AI request failed");
  }
  return data.result;
}

export function QueryPanel() {
  const { schema } = useSchema();
  const [question, setQuestion] = useState("");
  const [generatedSql, setGeneratedSql] = useState("");
  const [explanation, setExplanation] = useState("");
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const schemaJson = JSON.stringify(
    {
      tables: schema.tables.map((t) => ({
        name: t.name,
        columns: t.columns.map((c) => ({
          name: c.name,
          type: c.type,
          constraints: c.constraints,
        })),
      })),
    },
    null,
    2
  );

  const handleGenerate = async () => {
    if (!question.trim() || schema.tables.length === 0) return;
    setLoading("generate");
    setError("");
    setExplanation("");
    setQueryResult(null);
    try {
      const result = await callAi("generate_query", {
        schema: schemaJson,
        question: question.trim(),
      });
      setGeneratedSql(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate query";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  };

  const handleOptimize = async () => {
    if (!generatedSql.trim()) return;
    setLoading("optimize");
    setError("");
    try {
      const result = await callAi("optimize_query", {
        schema: schemaJson,
        query: generatedSql,
      });
      setGeneratedSql(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to optimize query";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  };

  const handleExplain = async () => {
    if (!generatedSql.trim()) return;
    setLoading("explain");
    setError("");
    try {
      const result = await callAi("explain_query", {
        schema: schemaJson,
        query: generatedSql,
      });
      setExplanation(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to explain query";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  };

  const handleRunQuery = async () => {
    if (!generatedSql.trim()) return;
    setLoading("run");
    setError("");
    setQueryResult(null);
    try {
      const res = await fetch("/api/mock-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ schema, query: generatedSql, rowsPerTable: 15 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Query execution failed");
      setQueryResult(data.result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to run query";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(null);
    }
  };

  const handleCopy = async () => {
    if (!generatedSql) return;
    await navigator.clipboard.writeText(generatedSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasSchema = schema.tables.length > 0;

  return (
    <div className="flex h-full flex-col">
      {/* NL input */}
      <div className="border-b p-2">
        <div className="flex gap-1.5">
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && !loading && handleGenerate()
            }
            placeholder={
              hasSchema
                ? "Ask a question about your data..."
                : "Add tables first to generate queries"
            }
            className="h-8 text-xs"
            disabled={!!loading || !hasSchema}
          />
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={!!loading || !question.trim() || !hasSchema}
            className="h-8 shrink-0"
          >
            {loading === "generate" ? (
              <Loader size="sm" />
            ) : (
              <Send className="size-3.5" />
            )}
          </Button>
        </div>
        {!hasSchema && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            Generate or create a schema first to use the query builder.
          </p>
        )}
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {/* Error */}
          {error && (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          {/* Generated SQL */}
          {generatedSql && (
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Generated Query
                </span>
                <div className="flex gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleRunQuery}
                    disabled={!!loading}
                    title="Run query on mock data"
                  >
                    {loading === "run" ? (
                      <Loader size="xs" />
                    ) : (
                      <Play className="size-3 text-emerald-500" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleCopy}
                    title="Copy"
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
                    onClick={handleOptimize}
                    disabled={!!loading}
                    title="Optimize query"
                  >
                    {loading === "optimize" ? (
                      <Loader size="xs" />
                    ) : (
                      <Zap className="size-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleExplain}
                    disabled={!!loading}
                    title="Explain query"
                  >
                    {loading === "explain" ? (
                      <Loader size="xs" />
                    ) : (
                      <MessageCircleQuestion className="size-3" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => {
                      setGeneratedSql("");
                      setExplanation("");
                      setQueryResult(null);
                    }}
                    title="Clear"
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>
              <pre className="rounded-md border bg-muted/30 p-2.5 font-mono text-xs leading-relaxed">
                <code>{highlightSql(generatedSql)}</code>
              </pre>
            </div>
          )}

          {/* Query Results */}
          {queryResult && (
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <Table2 className="size-3 text-muted-foreground" />
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                  Results
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {queryResult.rowCount} row{queryResult.rowCount !== 1 ? "s" : ""} in{" "}
                  {queryResult.executionTimeMs}ms
                </span>
              </div>
              {queryResult.columns.length > 0 ? (
                <div className="overflow-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        {queryResult.columns.map((col) => (
                          <th
                            key={col}
                            className="px-2.5 py-1.5 text-left font-semibold text-muted-foreground whitespace-nowrap"
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {queryResult.rows.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b last:border-b-0 hover:bg-muted/30"
                        >
                          {queryResult.columns.map((col) => (
                            <td
                              key={col}
                              className="px-2.5 py-1 font-mono whitespace-nowrap max-w-[200px] truncate"
                              title={String(row[col] ?? "")}
                            >
                              {row[col] === null ? (
                                <span className="text-muted-foreground/50 italic">
                                  NULL
                                </span>
                              ) : (
                                String(row[col])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Query executed successfully, no rows returned.
                </p>
              )}
            </div>
          )}

          {/* Explanation */}
          {explanation && (
            <div>
              <span className="mb-1.5 block text-[10px] font-semibold uppercase text-muted-foreground">
                Explanation
              </span>
              <div className="rounded-md border bg-muted/30 p-2.5 text-xs leading-relaxed whitespace-pre-wrap">
                {explanation}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!generatedSql && !error && hasSchema && (
            <div className="py-4 text-center">
              <p className="text-xs text-muted-foreground">
                Ask a question in natural language to generate a SQL query, then
                run it against mock data.
              </p>
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {[
                  "Get all users with their orders",
                  "Count records per category",
                  "Find the top 10 most recent items",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setQuestion(s)}
                    className="rounded-full border bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
