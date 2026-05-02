"use client";

import { useMemo, useState } from "react";
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
import {
  ruleBasedIndexCandidates,
  resolveAiSuggestions,
  type IndexCandidate,
} from "@/lib/index-advisor";
import type { IndexSuggestions } from "@/lib/langchain/ai";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Sparkles, Zap, Check, Bot, Wrench } from "lucide-react";
import { useAiStatus } from "@/lib/ai-status-context";
import { AiLockBadge } from "./ai-lock";

interface IndexAdvisorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function IndexAdvisorDialog({
  open,
  onOpenChange,
}: IndexAdvisorDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-h-[80vh] w-[calc(100%-2rem)] flex-col gap-3 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="size-4" />
            Index advisor
          </DialogTitle>
          <DialogDescription>
            Suggested indexes for join and lookup performance. Rule-based first; ask AI for more.
          </DialogDescription>
        </DialogHeader>
        {open && <IndexAdvisorBody onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function IndexAdvisorBody({ onClose }: { onClose: () => void }) {
  const { schema, addIndex } = useSchema();
  const aiStatus = useAiStatus();
  const aiReady = aiStatus.configured && aiStatus.enabled;

  const ruleCandidates = useMemo(
    () => ruleBasedIndexCandidates(schema),
    [schema]
  );

  const [aiCandidates, setAiCandidates] = useState<IndexCandidate[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiRequested, setAiRequested] = useState(false);
  const [accepted, setAccepted] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const c of ruleCandidates) s.add(candidateKey(c));
    return s;
  });

  const all = [...ruleCandidates, ...aiCandidates];
  // Dedupe across rule + ai by (tableId + columns)
  const seen = new Set<string>();
  const merged: IndexCandidate[] = [];
  for (const c of all) {
    const k = candidateKey(c);
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(c);
  }

  const handleAskAi = async () => {
    if (schema.tables.length === 0) {
      toast.error("No tables.");
      return;
    }
    setAiLoading(true);
    setAiRequested(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "advise_indexes",
          payload: { schema: JSON.stringify(schema) },
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "AI advisor failed");
        return;
      }
      const data = (await res.json()) as { result: IndexSuggestions };
      const resolved = resolveAiSuggestions(schema, data.result.suggestions);
      setAiCandidates(resolved);
      // Auto-accept new AI suggestions too
      setAccepted((prev) => {
        const next = new Set(prev);
        for (const c of resolved) next.add(candidateKey(c));
        return next;
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI advisor failed");
    } finally {
      setAiLoading(false);
    }
  };

  const toggle = (key: string) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleApply = () => {
    let count = 0;
    for (const c of merged) {
      if (!accepted.has(candidateKey(c))) continue;
      const indexName =
        c.columns.length === 1
          ? `idx_${c.tableName}_${c.columns[0]}`
          : `idx_${c.tableName}_${c.columns.join("_")}`;
      addIndex(c.tableId, {
        name: indexName,
        columns: c.columnIds,
        unique: c.unique,
      });
      count++;
    }
    toast.success(`Added ${count} index${count === 1 ? "" : "es"}`);
    onClose();
  };

  return (
    <>
        <div className="flex items-center justify-between gap-2 border-b pb-2">
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{merged.length}</span>{" "}
            candidate{merged.length === 1 ? "" : "s"} •{" "}
            <span className="font-semibold text-foreground">{accepted.size}</span>{" "}
            selected
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleAskAi}
            disabled={aiLoading || !aiReady}
            title={aiReady ? undefined : "AI not configured"}
          >
            {aiLoading ? <Loader size="xs" /> : <Sparkles className="size-3.5" />}
            {aiRequested ? "Refresh AI" : "Ask AI"}
            <AiLockBadge className="ml-1" />
          </Button>
        </div>

        <ScrollArea className="flex-1 rounded-lg border">
          {merged.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-xs text-muted-foreground">
              <Check className="size-8 text-emerald-500/50" />
              <p>No new index suggestions — looks tidy.</p>
              {!aiRequested && (
                <p className="text-[10px]">Click &quot;Ask AI&quot; for deeper analysis.</p>
              )}
            </div>
          ) : (
            <table className="w-full font-mono text-xs">
              <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm">
                <tr className="border-b">
                  <th className="w-8 px-2 py-1.5"></th>
                  <th className="px-2 py-1.5 text-left font-semibold">Table</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Columns</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Type</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Source</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Why</th>
                </tr>
              </thead>
              <tbody>
                {merged.map((c) => {
                  const k = candidateKey(c);
                  const isOn = accepted.has(k);
                  return (
                    <tr
                      key={k}
                      className={cn(
                        "border-b border-border/30 hover:bg-muted/40",
                        isOn && "bg-primary/[0.04]"
                      )}
                    >
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={isOn}
                          onChange={() => toggle(k)}
                        />
                      </td>
                      <td className="px-2 py-1.5 text-foreground">{c.tableName}</td>
                      <td className="px-2 py-1.5 text-foreground/90">
                        ({c.columns.join(", ")})
                      </td>
                      <td className="px-2 py-1.5 text-[10px]">
                        {c.unique ? (
                          <span className="rounded bg-violet-500/10 px-1 py-px text-violet-500">
                            UNIQUE
                          </span>
                        ) : (
                          <span className="text-muted-foreground">btree</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-[10px]">
                        {c.source === "ai" ? (
                          <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-px text-primary">
                            <Bot className="size-2.5" />
                            AI
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-foreground/5 px-1.5 py-px text-muted-foreground">
                            <Wrench className="size-2.5" />
                            rule
                          </span>
                        )}
                      </td>
                      <td className="max-w-[280px] truncate px-2 py-1.5 text-[10px] text-muted-foreground">
                        {c.reason}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </ScrollArea>

        <div className="flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={accepted.size === 0}>
            <Check className="size-3.5" />
            Add {accepted.size} index{accepted.size === 1 ? "" : "es"}
          </Button>
        </div>
    </>
  );
}

function candidateKey(c: IndexCandidate): string {
  return `${c.tableId}::${c.columnIds.join(",")}`;
}
