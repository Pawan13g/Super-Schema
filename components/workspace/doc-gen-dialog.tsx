"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader } from "@/components/ui/loader";
import { useSchema } from "@/lib/schema-store";
import type { DocumentedSchema } from "@/lib/langchain/ai";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Sparkles, FileText, Check, AlertTriangle } from "lucide-react";
import { AiNotConfiguredNotice } from "./ai-lock";
import { useAiStatus } from "@/lib/ai-status-context";

interface DocGenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface DocAccept {
  tableId: string;
  acceptTable: boolean;
  acceptedColumns: Set<string>;
}

export function DocGenDialog({ open, onOpenChange }: DocGenDialogProps) {
  const { schema, updateTableComment, updateColumn } = useSchema();
  const aiStatus = useAiStatus();
  const aiReady = aiStatus.configured && aiStatus.enabled;
  const [loading, setLoading] = useState(false);
  const [docs, setDocs] = useState<DocumentedSchema | null>(null);
  const [accept, setAccept] = useState<Map<string, DocAccept>>(new Map());
  const [overwriteExisting, setOverwriteExisting] = useState(false);

  const reset = () => {
    setDocs(null);
    setAccept(new Map());
    setLoading(false);
  };

  const handleGenerate = async () => {
    if (schema.tables.length === 0) {
      toast.error("No tables to document.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "document_schema",
          payload: { schema: JSON.stringify(schema) },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Doc generation failed");
        return;
      }
      const data = (await res.json()) as { result: DocumentedSchema };
      setDocs(data.result);

      // Pre-select all suggestions that aren't empty
      const next = new Map<string, DocAccept>();
      for (const t of data.result.tables) {
        const tbl = schema.tables.find((x) => x.name === t.name);
        if (!tbl) continue;
        const acceptedCols = new Set<string>();
        for (const c of t.columns) {
          if (!c.comment.trim()) continue;
          const col = tbl.columns.find((x) => x.name === c.name);
          if (!col) continue;
          acceptedCols.add(col.id);
        }
        next.set(tbl.id, {
          tableId: tbl.id,
          acceptTable: !!t.comment.trim(),
          acceptedColumns: acceptedCols,
        });
      }
      setAccept(next);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Doc generation failed");
    } finally {
      setLoading(false);
    }
  };

  const toggleColumn = (tableId: string, colId: string) => {
    setAccept((prev) => {
      const next = new Map(prev);
      const entry = next.get(tableId) ?? {
        tableId,
        acceptTable: false,
        acceptedColumns: new Set<string>(),
      };
      const cols = new Set(entry.acceptedColumns);
      if (cols.has(colId)) cols.delete(colId);
      else cols.add(colId);
      next.set(tableId, { ...entry, acceptedColumns: cols });
      return next;
    });
  };

  const toggleTable = (tableId: string) => {
    setAccept((prev) => {
      const next = new Map(prev);
      const entry = next.get(tableId) ?? {
        tableId,
        acceptTable: false,
        acceptedColumns: new Set<string>(),
      };
      next.set(tableId, { ...entry, acceptTable: !entry.acceptTable });
      return next;
    });
  };

  const handleApply = () => {
    if (!docs) return;
    let tableCount = 0;
    let colCount = 0;
    for (const t of docs.tables) {
      const tbl = schema.tables.find((x) => x.name === t.name);
      if (!tbl) continue;
      const a = accept.get(tbl.id);
      if (!a) continue;

      if (a.acceptTable && t.comment.trim()) {
        if (overwriteExisting || !tbl.comment?.trim()) {
          updateTableComment(tbl.id, t.comment.trim());
          tableCount++;
        }
      }
      for (const c of t.columns) {
        const col = tbl.columns.find((x) => x.name === c.name);
        if (!col) continue;
        if (!a.acceptedColumns.has(col.id)) continue;
        if (!c.comment.trim()) continue;
        if (!overwriteExisting && col.comment?.trim()) continue;
        updateColumn(tbl.id, col.id, { comment: c.comment.trim() });
        colCount++;
      }
    }
    toast.success(
      `Applied ${tableCount} table + ${colCount} column comment${colCount === 1 ? "" : "s"}`
    );
    reset();
    onOpenChange(false);
  };

  const totalAccepted = Array.from(accept.values()).reduce(
    (sum, a) => sum + (a.acceptTable ? 1 : 0) + a.acceptedColumns.size,
    0
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="flex h-[80vh] max-h-[80vh] w-[calc(100%-2rem)] flex-col gap-3 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="size-4" />
            AI doc-gen
          </DialogTitle>
          <DialogDescription>
            Auto-generate table and column comments using your configured AI provider.
          </DialogDescription>
        </DialogHeader>

        {!docs ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center">
            <AiNotConfiguredNotice />
            <FileText className="size-10 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium">
                Document {schema.tables.length} table{schema.tables.length === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-muted-foreground">
                Generates short comments for tables and columns. You pick which to apply.
              </p>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={loading || schema.tables.length === 0 || !aiReady}
            >
              {loading ? <Loader size="xs" /> : <Sparkles className="size-3.5" />}
              {aiReady ? "Generate" : "AI not configured"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b pb-2">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={overwriteExisting}
                  onChange={(e) => setOverwriteExisting(e.target.checked)}
                />
                Overwrite existing comments
              </label>
              <span className="text-xs text-muted-foreground">
                {totalAccepted} item{totalAccepted === 1 ? "" : "s"} selected
              </span>
            </div>
            <ScrollArea className="flex-1">
              <div className="font-mono text-xs">
                {docs.tables.map((t) => {
                  const tbl = schema.tables.find((x) => x.name === t.name);
                  if (!tbl) return null;
                  const a = accept.get(tbl.id);
                  return (
                    <div key={tbl.id} className="border-b">
                      <div className="flex items-start gap-2 bg-muted/30 px-3 py-1.5">
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={!!a?.acceptTable}
                          onChange={() => toggleTable(tbl.id)}
                          disabled={!t.comment.trim()}
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-foreground">
                            {t.name}
                            {tbl.comment?.trim() && (
                              <span className="ml-1.5 rounded bg-foreground/5 px-1 py-px text-[9px] uppercase text-muted-foreground">
                                has existing
                              </span>
                            )}
                          </div>
                          {t.comment.trim() ? (
                            <div className="text-[11px] text-muted-foreground">
                              {t.comment.trim()}
                            </div>
                          ) : (
                            <div className="text-[10px] italic text-muted-foreground/60">
                              (model returned no comment)
                            </div>
                          )}
                        </div>
                      </div>
                      <div>
                        {t.columns.map((c) => {
                          const col = tbl.columns.find((x) => x.name === c.name);
                          if (!col) return null;
                          const checked = !!a?.acceptedColumns.has(col.id);
                          const empty = !c.comment.trim();
                          return (
                            <div
                              key={col.id}
                              className={cn(
                                "flex items-start gap-2 border-t border-border/30 px-3 py-1",
                                empty && "opacity-50"
                              )}
                            >
                              <input
                                type="checkbox"
                                className="mt-0.5"
                                checked={checked}
                                onChange={() => toggleColumn(tbl.id, col.id)}
                                disabled={empty}
                              />
                              <div className="min-w-0 flex-1">
                                <span className="text-foreground/90">
                                  {c.name}
                                </span>
                                {col.comment?.trim() && (
                                  <span className="ml-1 rounded bg-foreground/5 px-1 py-px text-[9px] uppercase text-muted-foreground">
                                    has existing
                                  </span>
                                )}
                                <div className="text-[11px] text-muted-foreground">
                                  {empty ? "(no suggestion)" : c.comment.trim()}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            {!overwriteExisting && (
              <div className="flex items-center gap-1.5 border-t bg-amber-500/[0.06] px-3 py-1.5 text-[10px] text-amber-700 dark:text-amber-400">
                <AlertTriangle className="size-3" />
                Existing comments preserved unless &quot;Overwrite existing&quot; is checked.
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {docs && (
            <Button variant="outline" onClick={reset}>
              Regenerate
            </Button>
          )}
          <Button onClick={handleApply} disabled={!docs || totalAccepted === 0}>
            <Check className="size-3.5" />
            Apply {totalAccepted}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
