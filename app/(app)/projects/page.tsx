"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useWorkspace, type ProjectMeta } from "@/lib/workspace-context";
import { AppSidebar } from "@/components/workspace/app-sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowUpDown,
  ChevronRight,
  Clock,
  FileText,
  FolderOpen,
  Grid3x3,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type ViewMode = "grid" | "list";
type SortMode = "recent" | "name" | "schemas";
type Filter = "all" | "active" | "empty";

function formatDate(d: string): string {
  const dt = new Date(d);
  const now = new Date();
  const sameYear = dt.getFullYear() === now.getFullYear();
  return dt.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

function ProjectCard({
  project,
  isActive,
  onOpen,
  onRename,
  onDelete,
}: {
  project: ProjectMeta;
  isActive: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const schemaCount = project._count?.schemas ?? 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group relative flex cursor-pointer flex-col gap-3 rounded-xl border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/8 text-primary">
          <FolderOpen className="size-4" />
        </div>
        <div className="flex items-center gap-1">
          {isActive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              <span className="size-1 rounded-full bg-emerald-500" />
              active
            </span>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity outline-none group-hover:opacity-100 data-[popup-open]:opacity-100 hover:bg-muted focus-visible:opacity-100"
                />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4}>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation();
                  onRename();
                }}
              >
                <Pencil />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete();
                }}
              >
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-foreground">
          {project.name}
        </h3>
        {project.description ? (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {project.description}
          </p>
        ) : (
          <p className="mt-1 text-xs italic text-muted-foreground/50">
            No description
          </p>
        )}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <FileText className="size-3" />
          {schemaCount} schema{schemaCount === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="size-3" />
          {formatDate(project.updatedAt)}
        </span>
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  isActive,
  onOpen,
  onRename,
  onDelete,
}: {
  project: ProjectMeta;
  isActive: boolean;
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const schemaCount = project._count?.schemas ?? 0;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group grid cursor-pointer grid-cols-[auto_1fr_120px_120px_auto] items-center gap-3 border-b px-4 py-2.5 text-sm transition-colors hover:bg-muted/50"
    >
      <div className="flex size-7 items-center justify-center rounded-md bg-primary/8 text-primary">
        <FolderOpen className="size-3.5" />
      </div>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-foreground">
            {project.name}
          </span>
          {isActive && (
            <span className="rounded-full bg-emerald-500/10 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
              active
            </span>
          )}
        </div>
        {project.description && (
          <p className="truncate text-[11px] text-muted-foreground">
            {project.description}
          </p>
        )}
      </div>
      <span className="text-xs text-muted-foreground">
        {schemaCount} schema{schemaCount === 1 ? "" : "s"}
      </span>
      <span className="text-xs text-muted-foreground">
        {formatDate(project.updatedAt)}
      </span>
      <div className="flex items-center gap-1">
        <ChevronRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="rounded-md p-1 text-muted-foreground opacity-0 outline-none group-hover:opacity-100 data-[popup-open]:opacity-100 hover:bg-muted"
              />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={4}>
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onRename();
              }}
            >
              <Pencil />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default function ProjectsDashboardPage() {
  const router = useRouter();
  const {
    workspaces,
    activeWorkspaceId,
    projects,
    activeProjectId,
    loading,
    createProject,
    renameProject,
    deleteProject,
    switchProject,
  } = useWorkspace();

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [renameTarget, setRenameTarget] = useState<ProjectMeta | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [sort, setSort] = useState<SortMode>("recent");
  const [filter, setFilter] = useState<Filter>("all");

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const filtered = useMemo(() => {
    let list = projects;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q)
      );
    }
    if (filter === "active") {
      list = list.filter((p) => (p._count?.schemas ?? 0) > 0);
    } else if (filter === "empty") {
      list = list.filter((p) => (p._count?.schemas ?? 0) === 0);
    }
    const sorted = [...list];
    if (sort === "name") {
      sorted.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === "schemas") {
      sorted.sort(
        (a, b) => (b._count?.schemas ?? 0) - (a._count?.schemas ?? 0)
      );
    } else {
      sorted.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }
    return sorted;
  }, [projects, query, filter, sort]);

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name) return;
    const created = await createProject(name, createDesc.trim() || undefined);
    setCreateName("");
    setCreateDesc("");
    setCreateOpen(false);
    if (created) router.push(`/projects/${created.id}`);
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const next = renameDraft.trim();
    if (next) await renameProject(renameTarget.id, next);
    setRenameTarget(null);
    setRenameDraft("");
  };

  const totalSchemas = projects.reduce(
    (sum, p) => sum + (p._count?.schemas ?? 0),
    0
  );

  return (
    // h-screen locks the shell to the viewport so the sidebar always reaches
    // the bottom edge — h-full was sometimes resolving to less than full
    // viewport when body's min-h-full was the only height anchor, leaving a
    // visible "void" below the sidebar.
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <AppSidebar />

      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        {/* Top header — breadcrumb + action. Stays pinned because it sits
            outside the scrolling <main>. */}
        <header className="z-30 flex h-12 shrink-0 items-center gap-3 border-b bg-background px-5">
          <nav className="flex items-center gap-1.5 text-[13px]">
            <Link
              href="/projects"
              className="font-medium text-foreground hover:text-primary"
            >
              {activeWorkspace?.name ?? "Workspace"}
            </Link>
            <ChevronRight className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Projects</span>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              disabled={!activeWorkspaceId}
              className="h-8"
            >
              <Plus className="size-3.5" />
              New project
            </Button>
          </div>
        </header>

        {/* Tabs sub-bar — pinned via flex layout. */}
        <div className="z-20 flex shrink-0 items-center gap-1 border-b bg-background px-3">
          {(
            [
              ["all", "All", projects.length],
              ["active", "Active", projects.filter((p) => (p._count?.schemas ?? 0) > 0).length],
              ["empty", "Empty", projects.filter((p) => (p._count?.schemas ?? 0) === 0).length],
            ] as [Filter, string, number][]
          ).map(([key, label, count]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              className={cn(
                "relative flex h-9 items-center gap-1.5 px-3 text-[13px] font-medium transition-colors",
                filter === key
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                {count}
              </span>
              {filter === key && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-foreground" />
              )}
            </button>
          ))}
        </div>

        {/* Toolbar — search + sort + view. Pinned via flex layout. */}
        <div className="z-10 flex shrink-0 items-center gap-2 border-b bg-background px-5 py-2.5">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search projects…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 rounded-md bg-muted/40 pl-8 text-xs"
            />
          </div>
          <div className="ml-auto flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" className="h-8 gap-1.5">
                    <ArrowUpDown className="size-3" />
                    Sort:{" "}
                    {sort === "recent"
                      ? "Recent"
                      : sort === "name"
                        ? "Name"
                        : "Schemas"}
                  </Button>
                }
              />
              <DropdownMenuContent align="end" sideOffset={4}>
                <DropdownMenuItem onClick={() => setSort("recent")}>
                  Recent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort("name")}>
                  Name (A–Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort("schemas")}>
                  Schema count
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="flex items-center rounded-md border bg-background p-0.5">
              <button
                type="button"
                onClick={() => setView("grid")}
                title="Grid view"
                className={cn(
                  "flex size-7 items-center justify-center rounded-sm transition-colors",
                  view === "grid"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Grid3x3 className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                title="List view"
                className={cn(
                  "flex size-7 items-center justify-center rounded-sm transition-colors",
                  view === "list"
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-5 py-6">
            {/* Stats strip */}
            <div className="mb-6 grid grid-cols-3 gap-3">
              <StatTile label="Projects" value={projects.length} />
              <StatTile label="Schemas" value={totalSchemas} />
              <StatTile
                label="Active workspace"
                value={activeWorkspace?.name ?? "—"}
                isText
              />
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div
                    key={i}
                    className="h-[140px] animate-pulse rounded-xl border bg-card"
                  />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              query || filter !== "all" ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card py-16 text-center">
                  <Search className="size-8 text-muted-foreground/30" />
                  <h3 className="mt-3 text-sm font-semibold">No matches</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Try a different search or filter.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card py-16 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                    <FolderOpen className="size-5 text-primary" />
                  </div>
                  <h3 className="mt-3 text-sm font-semibold">No projects yet</h3>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                    Create your first project to start organizing schemas.
                  </p>
                  <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                    <Plus className="size-3.5" />
                    Create your first project
                  </Button>
                </div>
              )
            ) : view === "grid" ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    isActive={p.id === activeProjectId}
                    onOpen={() => {
                      switchProject(p.id);
                      router.push(`/projects/${p.id}`);
                    }}
                    onRename={() => {
                      setRenameTarget(p);
                      setRenameDraft(p.name);
                    }}
                    onDelete={() => setConfirmDeleteId(p.id)}
                  />
                ))}
                <button
                  onClick={() => setCreateOpen(true)}
                  className="flex min-h-[140px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                >
                  <Plus className="size-5" />
                  <span className="text-xs font-medium">New project</span>
                </button>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border bg-card">
                <div className="grid grid-cols-[auto_1fr_120px_120px_auto] gap-3 border-b bg-muted/30 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span />
                  <span>Name</span>
                  <span>Schemas</span>
                  <span>Updated</span>
                  <span />
                </div>
                {filtered.map((p) => (
                  <ProjectRow
                    key={p.id}
                    project={p}
                    isActive={p.id === activeProjectId}
                    onOpen={() => {
                      switchProject(p.id);
                      router.push(`/projects/${p.id}`);
                    }}
                    onRename={() => {
                      setRenameTarget(p);
                      setRenameDraft(p.name);
                    }}
                    onDelete={() => setConfirmDeleteId(p.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Dialogs */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Group multiple schemas under one project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="project-name" className="text-xs">
                Name
              </Label>
              <Input
                id="project-name"
                autoFocus
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="e.g. Billing, CRM, Analytics"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="project-desc" className="text-xs">
                Description (optional)
              </Label>
              <Input
                id="project-desc"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="What is this project for?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!createName.trim()}>
              Create project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setRenameTarget(null);
            setRenameDraft("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameDraft}
            onChange={(e) => setRenameDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={!renameDraft.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmDeleteId(null);
        }}
        title={(() => {
          const p = projects.find((x) => x.id === confirmDeleteId);
          return p ? `Delete "${p.name}"?` : "Delete project?";
        })()}
        description="This permanently deletes the project and all its schemas. Cannot be undone."
        confirmLabel="Delete project"
        onConfirm={() => {
          if (confirmDeleteId) deleteProject(confirmDeleteId);
        }}
      />
    </div>
  );
}

function StatTile({
  label,
  value,
  isText,
}: {
  label: string;
  value: number | string;
  isText?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 font-semibold tracking-tight text-foreground",
          isText ? "truncate text-base" : "text-2xl"
        )}
      >
        {value}
      </p>
    </div>
  );
}
