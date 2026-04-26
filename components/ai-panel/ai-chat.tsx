"use client";

import { useState } from "react";
import { useSchema } from "@/lib/schema-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sparkles,
  Send,
  Loader2,
  Lightbulb,
  Wrench,
  X,
} from "lucide-react";

interface Message {
  role: "user" | "assistant" | "error";
  content: string;
}

async function callAi(action: string, payload: Record<string, string>) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "AI request failed");
  return data.result;
}

export function AiChat({ onClose }: { onClose: () => void }) {
  const { schema, importAiSchema } = useSchema();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

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
      relations: schema.relations.map((r) => {
        const srcTable = schema.tables.find((t) => t.id === r.sourceTable);
        const tgtTable = schema.tables.find((t) => t.id === r.targetTable);
        const srcCol = srcTable?.columns.find((c) => c.id === r.sourceColumn);
        const tgtCol = tgtTable?.columns.find((c) => c.id === r.targetColumn);
        return {
          sourceTable: srcTable?.name,
          sourceColumn: srcCol?.name,
          targetTable: tgtTable?.name,
          targetColumn: tgtCol?.name,
          type: r.type,
        };
      }),
    },
    null,
    2
  );

  const handleGenerate = async () => {
    if (!input.trim()) return;
    const prompt = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: prompt }]);
    setLoading(true);

    try {
      const result = await callAi("generate_schema", {
        description: prompt,
      });
      importAiSchema(result);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Generated schema with ${result.tables.length} tables and ${result.relations?.length ?? 0} relations. The canvas has been updated.`,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "error",
          content: err instanceof Error ? err.message : "Failed to generate schema",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleExplain = async () => {
    if (schema.tables.length === 0) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: "Explain my current schema" },
    ]);
    setLoading(true);

    try {
      const result = await callAi("explain_schema", { schema: schemaJson });
      setMessages((prev) => [...prev, { role: "assistant", content: result }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "error",
          content: err instanceof Error ? err.message : "Failed to explain schema",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleFix = async () => {
    if (schema.tables.length === 0) return;
    setMessages((prev) => [
      ...prev,
      { role: "user", content: "Fix and improve my schema" },
    ]);
    setLoading(true);

    try {
      const result = await callAi("fix_schema", { schema: schemaJson });
      importAiSchema(result);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Schema improved! Now has ${result.tables.length} tables and ${result.relations?.length ?? 0} relations. The canvas has been updated.`,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "error",
          content: err instanceof Error ? err.message : "Failed to fix schema",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-indigo-500" />
          <span className="text-xs font-semibold">AI Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="xs"
            onClick={handleExplain}
            disabled={loading || schema.tables.length === 0}
            title="Explain current schema"
          >
            <Lightbulb className="size-3" />
            <span className="text-[10px]">Explain</span>
          </Button>
          <Button
            variant="ghost"
            size="xs"
            onClick={handleFix}
            disabled={loading || schema.tables.length === 0}
            title="Fix and improve schema"
          >
            <Wrench className="size-3" />
            <span className="text-[10px]">Fix</span>
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={onClose}>
            <X className="size-3" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div className="space-y-3 p-3">
          {messages.length === 0 && (
            <div className="py-6 text-center">
              <Sparkles className="mx-auto size-8 text-muted-foreground/30" />
              <p className="mt-2 text-xs text-muted-foreground">
                Describe your application to generate a database schema, or use
                the buttons above to explain or fix your current schema.
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {[
                  "E-commerce platform with users, products, and orders",
                  "Blog with posts, comments, tags, and authors",
                  "Project management tool with tasks and teams",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="rounded-full border bg-muted/50 px-2.5 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "ml-8 bg-indigo-500/10 text-foreground"
                  : msg.role === "error"
                    ? "mr-8 border border-destructive/20 bg-destructive/5 text-destructive"
                    : "mr-8 bg-muted text-foreground"
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" />
              Thinking...
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t p-2">
        <div className="flex gap-1.5">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && handleGenerate()}
            placeholder="Describe your database..."
            className="h-8 text-xs"
            disabled={loading}
          />
          <Button
            size="sm"
            onClick={handleGenerate}
            disabled={loading || !input.trim()}
            className="h-8 shrink-0"
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
