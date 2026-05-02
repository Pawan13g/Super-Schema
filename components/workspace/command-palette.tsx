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
import { toast } from "sonner";
import {
  Database,
  FileText,
  FolderPlus,
  Plus,
  Search,
  Settings,
  Sparkles,
  Table2,
  Trash2,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type CommandKind = "action" | "schema" | "table" | "column" | "page";

interface Command {
  id: string;
  kind: CommandKind;
  title: string;
  subtitle?: string;
  hint?: string;
  icon?: LucideIcon;
  // Lower = higher priority. Actions sort first when no search.
  priority?: number;
  run: () => void | Promise<void>;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const lastToggleAtRef = useRef(0);
  const openRef = useRef(false);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  const {
    schemas,
    activeSchemaId,
    activeProjectId,
    activeWorkspaceId,
    projects,
    workspaces,
    switchSchema,
    switchProject,
    createWorkspace,
    createProject,
    createSchemaInProject,
  } = useWorkspace();
  const { schema, setSelectedTableId, addTable } = useSchema();

  interface CrossSchema {
    id: string;
    name: string;
    projectId: string;
    projectName: string;
    workspaceId: string;
    workspaceName: string;
  }
  const [allSchemas, setAllSchemas] = useState<CrossSchema[]>([]);

  // Cmd/Ctrl+K toggles open. Capture phase + stopPropagation + 250ms debounce
  // guards against double-fire (StrictMode dev, OS-level repeat, browser
  // shortcuts) that previously could surface two stacked dialogs.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.key.toLowerCase() !== "k") return;
      e.preventDefault();
      e.stopPropagation();
      const now = Date.now();
      if (now - lastToggleAtRef.current < 250) return;
      lastToggleAtRef.current = now;
      setOpen(!openRef.current);
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      requestAnimationFrame(() => inputRef.current?.focus());
      void (async () => {
        try {
          const res = await fetch("/api/schemas");
          if (!res.ok) return;
          const data = (await res.json()) as { schemas: CrossSchema[] };
          setAllSchemas(data.schemas);
        } catch {
          /* ignore */
        }
      })();
    }
  }, [open]);

  const promptName = (label: string, fallback?: string) => {
    const next = window.prompt(label, fallback ?? "")?.trim();
    return next || null;
  };

  const commands: Command[] = useMemo(() => {
    const list: Command[] = [];

    // High-priority actions — surface first when no query is typed.
    list.push(
      {
        id: "action:new-table",
        kind: "action",
        title: "Create new table",
        subtitle: "Action · adds a table to the current schema",
        icon: Plus,
        priority: 1,
        run: () => {
          addTable(`table_${schema.tables.length + 1}`);
          toast.success("Table added");
        },
      },
      {
        id: "action:new-schema",
        kind: "action",
        title: "Create new schema",
        subtitle: activeProjectId
          ? `Action · in project "${projects.find((p) => p.id === activeProjectId)?.name ?? ""}"`
          : "Action · pick a project first",
        icon: FileText,
        priority: 2,
        run: async () => {
          if (!activeProjectId) {
            toast.error("Pick a project first");
            return;
          }
          const name = promptName("New schema name");
          if (!name) return;
          const created = await createSchemaInProject(name);
          if (!created)
            toast.error("Schema name already taken in this project");
          else toast.success(`Created schema "${name}"`);
        },
      },
      {
        id: "action:new-project",
        kind: "action",
        title: "Create new project",
        subtitle: activeWorkspaceId
          ? `Action · in workspace "${workspaces.find((w) => w.id === activeWorkspaceId)?.name ?? ""}"`
          : "Action · pick a workspace first",
        icon: FolderPlus,
        priority: 3,
        run: async () => {
          if (!activeWorkspaceId) {
            toast.error("Pick a workspace first");
            return;
          }
          const name = promptName("New project name");
          if (!name) return;
          const created = await createProject(name);
          if (!created)
            toast.error("Project name already taken in this workspace");
          else toast.success(`Created project "${name}"`);
        },
      },
      {
        id: "action:new-workspace",
        kind: "action",
        title: "Create new workspace",
        subtitle: "Action · creates a fresh workspace",
        icon: Database,
        priority: 4,
        run: async () => {
          const name = promptName("New workspace name");
          if (!name) return;
          await createWorkspace(name);
          toast.success(`Created workspace "${name}"`);
        },
      }
    );

    // Tables in the active schema
    schema.tables.forEach((t) => {
      const projName =
        projects.find(() =>
          schemas.find((s) => s.id === activeSchemaId)
        )?.name ?? "";
      list.push({
        id: `table:${t.id}`,
        kind: "table",
        title: t.name,
        subtitle: `Table · ${t.columns.length} column${t.columns.length === 1 ? "" : "s"}`,
        hint: projName,
        priority: 20,
        run: () => {
          setSelectedTableId(t.id);
        },
      });
      t.columns.forEach((c) => {
        list.push({
          id: `col:${t.id}:${c.id}`,
          kind: "column",
          title: `${t.name}.${c.name}`,
          subtitle: `Column · ${c.type.toLowerCase()}`,
          priority: 30,
          run: () => {
            setSelectedTableId(t.id);
          },
        });
      });
    });

    // Cross-project schema jump
    allSchemas.forEach((s) => {
      if (s.id === activeSchemaId) return;
      list.push({
        id: `schema:${s.id}`,
        kind: "schema",
        title: s.name,
        subtitle: `Schema · ${s.projectName}`,
        hint: s.workspaceName,
        priority: 25,
        run: async () => {
          if (s.projectId !== activeProjectId) {
            await switchProject(s.projectId);
          }
          await switchSchema(s.id);
        },
      });
    });

    // Static pages
    list.push(
      {
        id: "page:settings",
        kind: "page",
        title: "Settings",
        subtitle: "Page",
        icon: Settings,
        priority: 40,
        run: () => router.push("/settings"),
      },
      {
        id: "page:settings-ai",
        kind: "page",
        title: "AI settings (BYOK)",
        subtitle: "Page · /settings#ai",
        icon: Sparkles,
        priority: 41,
        run: () => router.push("/settings#ai"),
      },
      {
        id: "page:docs",
        kind: "page",
        title: "Documentation",
        subtitle: "Page",
        icon: FileText,
        priority: 42,
        run: () => router.push("/docs"),
      },
      {
        id: "page:trash",
        kind: "page",
        title: "Open trash",
        subtitle: "Action · view recently deleted",
        icon: Trash2,
        priority: 43,
        run: () => {
          window.dispatchEvent(new CustomEvent("super-schema:open-trash"));
        },
      }
    );

    return list;
  }, [
    schema,
    schemas,
    activeSchemaId,
    activeProjectId,
    activeWorkspaceId,
    projects,
    workspaces,
    allSchemas,
    switchSchema,
    switchProject,
    setSelectedTableId,
    addTable,
    createWorkspace,
    createProject,
    createSchemaInProject,
    router,
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return [...commands]
        .sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
        .slice(0, 30);
    }
    const score = (cmd: Command) => {
      const hay = `${cmd.title} ${cmd.subtitle ?? ""}`.toLowerCase();
      if (hay.startsWith(q)) return 0;
      const idx = hay.indexOf(q);
      if (idx >= 0) return 1 + idx / 100;
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
      .sort((a, b) => {
        if (a.s !== b.s) return a.s - b.s;
        return (a.c.priority ?? 100) - (b.c.priority ?? 100);
      })
      .slice(0, 50)
      .map((x) => x.c);
  }, [commands, query]);

  const [highlight, setHighlight] = useState(0);
  useEffect(() => {
    setHighlight(0);
  }, [query, open]);

  // Scroll the highlighted row into view when arrow keys move it past the
  // viewport edge.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [highlight, open]);

  const run = async (cmd: Command) => {
    setOpen(false);
    await cmd.run();
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
              } else if (e.key === "Home") {
                e.preventDefault();
                setHighlight(0);
              } else if (e.key === "End") {
                e.preventDefault();
                setHighlight(Math.max(0, filtered.length - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const cmd = filtered[highlight];
                if (cmd) void run(cmd);
              }
            }}
            placeholder="Type a command or search tables, schemas, pages"
            className="flex-1 bg-transparent pr-10 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-1.5">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              No matches
            </p>
          ) : (
            <ul ref={listRef}>
              {filtered.map((cmd, i) => {
                const Icon = cmd.icon ?? iconFor(cmd.kind);
                return (
                  <li key={cmd.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setHighlight(i)}
                      onClick={() => void run(cmd)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors",
                        highlight === i
                          ? "bg-accent text-accent-foreground"
                          : "hover:bg-accent/60"
                      )}
                    >
                      <Icon
                        className={cn(
                          "size-4 shrink-0",
                          cmd.kind === "action"
                            ? "text-violet-500"
                            : "text-muted-foreground"
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{cmd.title}</p>
                        {cmd.subtitle ? (
                          <p className="truncate text-[11px] text-muted-foreground">
                            {cmd.subtitle}
                          </p>
                        ) : null}
                      </div>
                      {cmd.kind === "action" && (
                        <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-violet-600">
                          action
                        </span>
                      )}
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
    case "action":
      return Zap;
    default:
      return Sparkles;
  }
}
