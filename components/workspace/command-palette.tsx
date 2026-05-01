"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useWorkspace } from "@/lib/workspace-context";
import { useSchema } from "@/lib/schema-store";
import {
  Database,
  FileText,
  FolderOpen,
  KeyRound,
  Search,
  Settings,
  Table2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CommandKind = "schema" | "table" | "column" | "page";

interface Command {
  id: string;
  kind: CommandKind;
  title: string;
  subtitle?: string;
  hint?: string;
  run: () => void;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    schemas,
    activeSchemaId,
    switchSchema,
    projects,
    workspaces,
  } = useWorkspace();
  const { schema, setSelectedTableId } = useSchema();

  // Cmd/Ctrl+K toggles open
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      // Defer focus until after the dialog mounts
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const commands: Command[] = useMemo(() => {
    const list: Command[] = [];

    // Tables in the active schema
    schema.tables.forEach((t) => {
      const projName =
        projects.find((p) =>
          schemas.find((s) => s.id === activeSchemaId)
        )?.name ?? "";
      list.push({
        id: `table:${t.id}`,
        kind: "table",
        title: t.name,
        subtitle: `Table · ${t.columns.length} column${t.columns.length === 1 ? "" : "s"}`,
        hint: projName,
        run: () => {
          setSelectedTableId(t.id);
        },
      });
      // Columns
      t.columns.forEach((c) => {
        list.push({
          id: `col:${t.id}:${c.id}`,
          kind: "column",
          title: `${t.name}.${c.name}`,
          subtitle: `Column · ${c.type.toLowerCase()}`,
          run: () => {
            setSelectedTableId(t.id);
          },
        });
      });
    });

    // Other schemas in this project
    schemas.forEach((s) => {
      if (s.id === activeSchemaId) return;
      list.push({
        id: `schema:${s.id}`,
        kind: "schema",
        title: s.name,
        subtitle: "Schema · switch",
        run: () => switchSchema(s.id),
      });
    });

    // Static pages
    list.push(
      {
        id: "page:projects",
        kind: "page",
        title: "Projects dashboard",
        subtitle: "Page",
        run: () => router.push("/projects"),
      },
      {
        id: "page:settings",
        kind: "page",
        title: "Settings",
        subtitle: "Page",
        run: () => router.push("/settings"),
      },
      {
        id: "page:settings-ai",
        kind: "page",
        title: "AI settings (BYOK)",
        subtitle: "Page · /settings#ai",
        run: () => router.push("/settings#ai"),
      },
      {
        id: "page:docs",
        kind: "page",
        title: "Documentation",
        subtitle: "Page",
        run: () => router.push("/docs"),
      }
    );

    return list;
  }, [
    schema,
    schemas,
    activeSchemaId,
    projects,
    switchSchema,
    setSelectedTableId,
    router,
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands.slice(0, 30);
    const score = (cmd: Command) => {
      const hay = `${cmd.title} ${cmd.subtitle ?? ""}`.toLowerCase();
      if (hay.startsWith(q)) return 0;
      const idx = hay.indexOf(q);
      if (idx >= 0) return 1 + idx / 100;
      // Subsequence match (loose) — let "uem" find "user_email"
      let i = 0;
      for (const ch of hay) {
        if (ch === q[i]) i++;
        if (i >= q.length) return 5;
      }
      return Infinity;
    };
    return commands
      .map((c) => ({ c, s: score(c) }))
      .filter((x) => Number.isFinite(x.s))
      .sort((a, b) => a.s - b.s)
      .slice(0, 50)
      .map((x) => x.c);
  }, [commands, query]);

  const [highlight, setHighlight] = useState(0);
  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  const run = (cmd: Command) => {
    cmd.run();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlight((h) => Math.min(h + 1, filtered.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlight((h) => Math.max(h - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const cmd = filtered[highlight];
                if (cmd) run(cmd);
              }
            }}
            placeholder="Search tables, columns, schemas, pages…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            Esc
          </kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No matches
            </p>
          ) : (
            <ul>
              {filtered.map((cmd, i) => {
                const Icon = iconFor(cmd.kind);
                return (
                  <li key={cmd.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => run(cmd)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                        highlight === i
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/60"
                      )}
                    >
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{cmd.title}</p>
                        {cmd.subtitle ? (
                          <p className="truncate text-[11px] text-muted-foreground">
                            {cmd.subtitle}
                          </p>
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-1.5 text-[10px] text-muted-foreground">
          <span>
            <kbd className="rounded border bg-card px-1 py-0.5 font-mono">↑</kbd>{" "}
            <kbd className="rounded border bg-card px-1 py-0.5 font-mono">↓</kbd>{" "}
            navigate
          </span>
          <span>
            <kbd className="rounded border bg-card px-1 py-0.5 font-mono">Enter</kbd>{" "}
            select
          </span>
          <span>
            {workspaces.length} workspace{workspaces.length === 1 ? "" : "s"}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function iconFor(kind: CommandKind) {
  switch (kind) {
    case "schema":
      return FileText;
    case "table":
      return Table2;
    case "column":
      return Database;
    case "page":
      return Settings;
    default:
      return Sparkles;
  }
}
