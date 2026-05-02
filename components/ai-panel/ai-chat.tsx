"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { toast } from "sonner";
import { useSchema } from "@/lib/schema-store";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import {
  ArrowUp,
  Check,
  Clock,
  Copy,
  Lightbulb,
  Maximize2,
  Minimize2,
  Pencil,
  Plus,
  RefreshCw,
  Settings,
  Sparkles,
  Undo2,
  Wrench,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePanelLayout } from "@/lib/panel-layout";

type MessageRole = "user" | "assistant" | "error" | "system";

interface Message {
  id: string;
  role: MessageRole;
  content: string;
  // Tag tells us what action produced this user prompt so re-runs match.
  action?: "generate" | "explain" | "fix";
  meta?: {
    latencyMs?: number;
    provider?: string | null;
    model?: string | null;
  };
}

function formatMs(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function uid() {
  // typeof crypto guard for SSR; cast through unknown so the conditional
  // narrowing inside the function doesn't reduce the binding to `never`
  // after the first branch.
  const c =
    typeof crypto !== "undefined"
      ? (crypto as Crypto & { randomUUID?: () => string })
      : null;
  if (c?.randomUUID) return c.randomUUID();
  // Fallback that still uses cryptographic entropy when available — keeps
  // collisions astronomically unlikely even when the user spams.
  if (c?.getRandomValues) {
    const buf = new Uint8Array(16);
    c.getRandomValues(buf);
    return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  // Last-resort: timestamp + random — collision risk only if Math.random is
  // seeded identically across two simultaneous tabs. Rare.
  return `${Date.now().toString(36)}-${Math.floor(Math.random() * 1e12).toString(36)}`;
}

interface AiCallResult<T> {
  result: T;
  meta?: {
    latencyMs?: number;
    provider?: string | null;
    model?: string | null;
  };
}

async function callAi<T = unknown>(
  action: string,
  payload: Record<string, string>
): Promise<AiCallResult<T>> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  const data = await res.json();
  if (!res.ok) {
    if (data.code === "NO_KEY") {
      toast.error(data.error, {
        action: {
          label: "Open settings",
          onClick: () => (location.href = "/settings"),
        },
      });
    } else {
      toast.error(data.error ?? "AI request failed");
    }
    throw new Error(data.error ?? "AI request failed");
  }
  return { result: data.result as T, meta: data.meta };
}

export function AiChat({ onClose }: { onClose: () => void }) {
  const { schema, importAiSchema } = useSchema();
  const { isMaximized, toggle: toggleMax } = usePanelLayout();
  const aiMax = isMaximized("ai");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Snapshots of the message list captured before destructive operations
  // (edit + re-run, regenerate, new chat). Lets the user undo a truncation
  // and recover the branch they overwrote.
  const branchStackRef = useRef<Message[][]>([]);
  const [, bumpUndo] = useReducer((c: number) => c + 1, 0);
  const canUndoChat = branchStackRef.current.length > 0;

  const pushBranch = (snapshot: Message[]) => {
    branchStackRef.current.push(snapshot);
    if (branchStackRef.current.length > 20) branchStackRef.current.shift();
    bumpUndo();
  };

  const undoChat = () => {
    const last = branchStackRef.current.pop();
    if (!last) return;
    setMessages(last);
    bumpUndo();
  };

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (!s) return;
        setAiReady(!!(s.aiEnabled && s.aiProvider && s.hasApiKey));
      })
      .catch(() => setAiReady(null));
  }, []);

  useEffect(() => {
    // Scroll to bottom when messages change
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  const schemaJson = useMemo(
    () =>
      JSON.stringify(
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
      ),
    [schema]
  );

  // -- Core: run a user action against AI -----------------------------------

  const runAction = async (
    action: "generate" | "explain" | "fix",
    promptText: string,
    options: { replaceAt?: string } = {}
  ) => {
    let nextMessages: Message[];
    const userMsg: Message = {
      id: options.replaceAt ?? uid(),
      role: "user",
      content: promptText,
      action,
    };

    if (options.replaceAt) {
      const idx = messages.findIndex((m) => m.id === options.replaceAt);
      if (idx === -1) {
        nextMessages = [...messages, userMsg];
      } else {
        // Drop the user msg + everything after (AI replies, errors).
        // Capture the pre-truncation array so the user can undo.
        if (messages.length > 0) pushBranch(messages);
        nextMessages = [...messages.slice(0, idx), userMsg];
      }
    } else {
      nextMessages = [...messages, userMsg];
    }

    setMessages(nextMessages);
    setLoading(true);

    const appendError = (msg: string) =>
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "error", content: msg },
      ]);

    try {
      if (action === "generate") {
        const { result, meta } = await callAi<{
          tables: { name: string }[];
          relations?: unknown[];
        }>("generate_schema", { description: promptText });
        importAiSchema(result as never);
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content: `Generated schema with ${result.tables.length} table${result.tables.length === 1 ? "" : "s"} and ${result.relations?.length ?? 0} relation${(result.relations?.length ?? 0) === 1 ? "" : "s"}. Canvas updated.`,
            meta,
          },
        ]);
      } else if (action === "explain") {
        const { result, meta } = await callAi<string>("explain_schema", {
          schema: schemaJson,
        });
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "assistant", content: result, meta },
        ]);
      } else if (action === "fix") {
        const { result, meta } = await callAi<{
          tables: { name: string }[];
          relations?: unknown[];
        }>("fix_schema", { schema: schemaJson });
        importAiSchema(result as never);
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: "assistant",
            content: `Schema improved — now ${result.tables.length} table${result.tables.length === 1 ? "" : "s"} and ${result.relations?.length ?? 0} relation${(result.relations?.length ?? 0) === 1 ? "" : "s"}. Canvas updated.`,
            meta,
          },
        ]);
      }
    } catch (err) {
      appendError(
        err instanceof Error ? err.message : "Request failed"
      );
    } finally {
      setLoading(false);
    }
  };

  // -- UI handlers ----------------------------------------------------------

  const submitPrompt = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    runAction("generate", text);
  };

  const beginEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditDraft(msg.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft("");
  };

  const saveEdit = (msg: Message) => {
    const next = editDraft.trim();
    if (!next) return;
    setEditingId(null);
    setEditDraft("");
    runAction(msg.action ?? "generate", next, { replaceAt: msg.id });
  };

  const regenerate = (assistantMsg: Message) => {
    // Walk backward from THIS assistant message (resolved by id, not stale
    // index) to the most recent user prompt and re-run it. Captures the
    // current message tree as an undoable branch.
    const idx = messages.findIndex((m) => m.id === assistantMsg.id);
    if (idx === -1) {
      toast.error("Message no longer in history");
      return;
    }
    for (let i = idx - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "user") {
        runAction(m.action ?? "generate", m.content, { replaceAt: m.id });
        return;
      }
    }
    toast.error("No prompt found to regenerate from");
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied");
    } catch {
      toast.error("Copy failed");
    }
  };

  const newChat = () => {
    if (loading) return;
    if (messages.length > 0) pushBranch(messages);
    setMessages([]);
    setInput("");
    setEditingId(null);
  };

  const hasTables = schema.tables.length > 0;

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center gap-2 overflow-hidden border-b px-2 py-2 sm:px-3">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <span className="truncate text-sm font-semibold">AI</span>
        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={undoChat}
            disabled={!canUndoChat || loading}
            title="Undo last edit / regenerate / new chat"
            aria-label="Undo chat change"
          >
            <Undo2 className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={newChat}
            disabled={loading || messages.length === 0}
            title="New chat"
            aria-label="New chat"
          >
            <Plus className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => toggleMax("ai")}
            title={aiMax ? "Restore layout" : "Maximize AI panel"}
            aria-label={aiMax ? "Restore layout" : "Maximize AI panel"}
          >
            {aiMax ? (
              <Minimize2 className="size-3.5" />
            ) : (
              <Maximize2 className="size-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={onClose}
            title="Close"
            aria-label="Close"
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-3 py-4 sm:gap-5 sm:px-4 sm:py-5">
          {aiReady === false && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3.5 py-3">
              <p className="text-xs font-medium text-foreground">AI not configured</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                Choose a provider and enter your API key to start chatting.
              </p>
              <a
                href="/settings"
                className="mt-2 inline-flex items-center gap-1 rounded-md bg-foreground px-2 py-1 text-[11px] font-medium text-background hover:opacity-90"
              >
                <Settings className="size-3" />
                Open settings
              </a>
            </div>
          )}

          {messages.length === 0 && (
            <EmptyState
              hasTables={hasTables}
              onPick={(s) => setInput(s)}
              onExplain={() => runAction("explain", "Explain my current schema")}
              onFix={() => runAction("fix", "Fix and improve my schema")}
            />
          )}

          {messages.map((msg) => {
            if (msg.role === "user") {
              const isEditing = editingId === msg.id;
              return (
                <div key={msg.id} className="group/msg flex justify-end">
                  <div className="flex w-full max-w-[88%] flex-col items-end gap-1 sm:max-w-[80%]">
                    {isEditing ? (
                      <div className="w-full rounded-2xl bg-muted px-3.5 py-2.5">
                        <textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          rows={Math.min(8, Math.max(2, editDraft.split("\n").length))}
                          autoFocus
                          className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none"
                        />
                        <div className="mt-2 flex justify-end gap-1.5">
                          <Button variant="ghost" size="xs" onClick={cancelEdit}>
                            Cancel
                          </Button>
                          <Button
                            size="xs"
                            onClick={() => saveEdit(msg)}
                            disabled={!editDraft.trim() || loading}
                          >
                            Save & re-run
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="rounded-2xl bg-muted px-3.5 py-2 text-sm leading-relaxed">
                          <span className="whitespace-pre-wrap">{msg.content}</span>
                        </div>
                        <div className="flex gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100">
                          <IconBtn
                            label="Edit"
                            onClick={() => beginEdit(msg)}
                            disabled={loading}
                          >
                            <Pencil className="size-3" />
                          </IconBtn>
                          <IconBtn
                            label="Copy"
                            onClick={() => copyToClipboard(msg.content)}
                          >
                            <Copy className="size-3" />
                          </IconBtn>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            }

            if (msg.role === "error") {
              return (
                <div key={msg.id} className="flex gap-2">
                  <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-destructive/15 text-destructive">
                    <X className="size-3.5" />
                  </div>
                  <div className="flex-1 rounded-2xl border border-destructive/20 bg-destructive/5 px-3.5 py-2 text-sm text-destructive">
                    {msg.content}
                  </div>
                </div>
              );
            }

            // assistant
            return (
              <div key={msg.id} className="group/msg flex gap-2.5">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15">
                  <Sparkles className="size-3.5 text-primary" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <div className="prose prose-sm max-w-none whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground dark:prose-invert">
                    {msg.content}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    {msg.meta?.latencyMs !== undefined && (
                      <span
                        title={`${msg.meta.provider ?? ""}${msg.meta.model ? ` · ${msg.meta.model}` : ""}`}
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-1.5 py-0.5 font-medium"
                      >
                        <Clock className="size-2.5" />
                        {formatMs(msg.meta.latencyMs)}
                      </span>
                    )}
                    <div className="flex gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100">
                      <IconBtn
                        label="Copy"
                        onClick={() => copyToClipboard(msg.content)}
                      >
                        <Copy className="size-3" />
                      </IconBtn>
                      <IconBtn
                        label="Regenerate"
                        onClick={() => regenerate(msg)}
                        disabled={loading}
                      >
                        <RefreshCw className="size-3" />
                      </IconBtn>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-2.5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15">
                <Sparkles className="size-3.5 text-primary" />
              </div>
              <Loader size="sm" label="Thinking" />
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t bg-background/80 px-2 pb-2 pt-2 backdrop-blur sm:px-3 sm:pb-3">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex items-end gap-1.5 rounded-2xl border bg-card p-1.5 shadow-sm focus-within:border-foreground/30 sm:gap-2 sm:p-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitPrompt();
                }
              }}
              placeholder="Describe a database, ask a question, or paste a description"
              rows={Math.min(6, Math.max(1, input.split("\n").length))}
              disabled={loading}
              className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            <button
              type="button"
              onClick={submitPrompt}
              disabled={loading || !input.trim()}
              aria-label="Send"
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full transition-all",
                loading || !input.trim()
                  ? "bg-muted text-muted-foreground"
                  : "bg-foreground text-background hover:opacity-90"
              )}
            >
              {loading ? (
                <Loader size="xs" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
            AI can make mistakes. Verify generated schemas before using them.
          </p>
        </div>
      </div>
    </div>
  );
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function EmptyState({
  hasTables,
  onPick,
  onExplain,
  onFix,
}: {
  hasTables: boolean;
  onPick: (s: string) => void;
  onExplain: () => void;
  onFix: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-2xl bg-primary/10">
        <Sparkles className="size-5 text-primary" />
      </div>
      <div>
        <p className="text-base font-semibold">How can I help?</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Describe an app and I&apos;ll design the schema.
        </p>
      </div>

      <div className="grid w-full max-w-md grid-cols-1 gap-1.5 sm:grid-cols-2">
        {[
          "E-commerce platform with users, products, and orders",
          "Blog with posts, comments, tags, and authors",
          "Project management tool with tasks and teams",
          "Social network with users, posts, likes, and follows",
        ].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-xl border bg-card px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-foreground/20 hover:text-foreground"
          >
            {s}
          </button>
        ))}
      </div>

      {hasTables && (
        <div className="flex gap-1.5">
          <Button variant="outline" size="sm" onClick={onExplain}>
            <Lightbulb className="size-3.5" />
            Explain my schema
          </Button>
          <Button variant="outline" size="sm" onClick={onFix}>
            <Wrench className="size-3.5" />
            Fix my schema
          </Button>
        </div>
      )}
    </div>
  );
}

// Indicates when an AI message has been "applied" to the canvas (future hook).
export function CheckIndicator() {
  return <Check className="size-3 text-emerald-500" />;
}
