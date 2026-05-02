"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tip } from "@/components/ui/tip";
import { useWorkspace, type ProjectMeta } from "@/lib/workspace-context";
import { cn } from "@/lib/utils";
import {
  ArrowUpDown,
  Clock,
  Eye,
  FileText,
  FolderOpen,
  Grid3x3,
  Info,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

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

interface ProjectsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProjectsDialog({ open, onOpenChange }: ProjectsDialogProps) {
  const {
    projects,
    activeProjectId,
    activeWorkspaceId,
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
  const [renameDescDraft, setRenameDescDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [detailsTarget, setDetailsTarget] = useState<ProjectMeta | null>(null);

  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [sort, setSort] = useState<SortMode>("recent");
  const [filter, setFilter] = useState<Filter>("all");

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
    await createProject(name, createDesc.trim() || undefined);
    setCreateName("");
    setCreateDesc("");
    setCreateOpen(false);
    onOpenChange(false);
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const nextName = renameDraft.trim();
    const nextDesc = renameDescDraft.trim();
    if (!nextName) return;
    // PATCH name + description in one shot. workspace-context's renameProject
    // only handles the name, so hit the route directly for description.
    await fetch(`/api/projects/${renameTarget.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nextName,
        description: nextDesc || null,
      }),
    });
    if (nextName !== renameTarget.name) {
      // Trigger context refresh via the existing helper.
      await renameProject(renameTarget.id, nextName);
    }
    setRenameTarget(null);
    setRenameDraft("");
    setRenameDescDraft("");
  };

  const openProject = async (id: string) => {
    await switchProject(id);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex h-[80vh] max-h-[80vh] w-[calc(100%-2rem)] flex-col gap-3 sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="size-4" />
              Projects
            </DialogTitle>
            <DialogDescription>
              Switch active project, create new ones, or manage existing
              projects in this workspace.
            </DialogDescription>
          </DialogHeader>

          {/* Filter tabs */}
          <div className="flex items-center gap-1 border-b">
            {(
              [
                ["all", "All", projects.length],
                [
                  "active",
                  "Active",
                  projects.filter((p) => (p._count?.schemas ?? 0) > 0).length,
                ],
                [
                  "empty",
                  "Empty",
                  projects.filter((p) => (p._count?.schemas ?? 0) === 0).length,
                ],
              ] as [Filter, string, number][]
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={cn(
                  "relative flex h-8 items-center gap-1.5 px-3 text-[12px] font-medium transition-colors",
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

          {/* Toolbar */}
          <div className="flex items-center gap-2">
            <div className="relative max-w-sm flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search projects"
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
                <Tip label="Grid view">
                  <button
                    type="button"
                    onClick={() => setView("grid")}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-sm transition-colors",
                      view === "grid"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Grid3x3 className="size-3.5" />
                  </button>
                </Tip>
                <Tip label="List view">
                  <button
                    type="button"
                    onClick={() => setView("list")}
                    className={cn(
                      "flex size-7 items-center justify-center rounded-sm transition-colors",
                      view === "list"
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <List className="size-3.5" />
                  </button>
                </Tip>
              </div>

              <Button
                size="sm"
                className="h-8"
                onClick={() => setCreateOpen(true)}
                disabled={!activeWorkspaceId}
              >
                <Plus className="size-3.5" />
                New
              </Button>
            </div>
          </div>

          {/* Body */}
          <ScrollArea className="flex-1 rounded-lg border">
            {filtered.length === 0 ? (
              query || filter !== "all" ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-xs text-muted-foreground">
                  <Search className="size-8 text-muted-foreground/30" />
                  <p>No matches.</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
                    <FolderOpen className="size-5 text-primary" />
                  </div>
                  <p className="text-sm font-semibold">No projects yet</p>
                  <p className="max-w-xs text-xs text-muted-foreground">
                    Create your first project to start organizing schemas.
                  </p>
                  <Button className="mt-2" onClick={() => setCreateOpen(true)}>
                    <Plus className="size-3.5" />
                    Create your first project
                  </Button>
                </div>
              )
            ) : view === "grid" ? (
              <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    isActive={p.id === activeProjectId}
                    onOpen={() => openProject(p.id)}
                    onRename={() => {
                      setRenameTarget(p);
                      setRenameDraft(p.name);
                      setRenameDescDraft(p.description ?? "");
                    }}
                    onView={() => setDetailsTarget(p)}
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
              <div className="overflow-hidden">
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
                    onOpen={() => openProject(p.id)}
                    onRename={() => {
                      setRenameTarget(p);
                      setRenameDraft(p.name);
                      setRenameDescDraft(p.description ?? "");
                    }}
                    onView={() => setDetailsTarget(p)}
                    onDelete={() => setConfirmDeleteId(p.id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Create */}
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
              <Label htmlFor="proj-name" className="text-xs">
                Name
              </Label>
              <Input
                id="proj-name"
                autoFocus
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                placeholder="e.g. Billing, CRM, Analytics"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="proj-desc" className="text-xs">
                Description (optional)
              </Label>
              <Input
                id="proj-desc"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="What is this project for?"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!createName.trim()}>
              Create project
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename + description edit */}
      <Dialog
        open={renameTarget !== null}
        onOpenChange={(o) => {
          if (!o) {
            setRenameTarget(null);
            setRenameDraft("");
            setRenameDescDraft("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit project</DialogTitle>
            <DialogDescription>
              Update the name or description. Changes save when you click Save.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="rename-name" className="text-xs">
                Name
              </Label>
              <Input
                id="rename-name"
                autoFocus
                value={renameDraft}
                onChange={(e) => setRenameDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rename-desc" className="text-xs">
                Description (optional)
              </Label>
              <Input
                id="rename-desc"
                value={renameDescDraft}
                onChange={(e) => setRenameDescDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
                placeholder="What is this project for?"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRenameTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={!renameDraft.trim()}>
              Save
            </Button>
          </div>
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
        description="Moves this project (and its schemas) to the trash. Recover within 30 days."
        confirmLabel="Delete project"
        variant="destructive"
        onConfirm={() => {
          if (confirmDeleteId) deleteProject(confirmDeleteId);
        }}
      />

      {/* View details */}
      <Dialog
        open={detailsTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDetailsTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="size-4" />
              {detailsTarget?.name ?? "Project"}
            </DialogTitle>
            <DialogDescription>Project details and metadata.</DialogDescription>
          </DialogHeader>
          {detailsTarget && (
            <div className="grid gap-3 py-1 text-sm">
              <DetailRow label="Name">{detailsTarget.name}</DetailRow>
              <DetailRow label="Description">
                {detailsTarget.description?.trim() || (
                  <span className="italic text-muted-foreground/60">None</span>
                )}
              </DetailRow>
              <DetailRow label="Schemas">
                {detailsTarget._count?.schemas ?? 0}
              </DetailRow>
              <DetailRow label="Created">
                {formatDate(detailsTarget.createdAt)}
              </DetailRow>
              <DetailRow label="Last updated">
                {formatDate(detailsTarget.updatedAt)}
              </DetailRow>
              <DetailRow label="ID">
                <code className="font-mono text-[11px] text-muted-foreground">
                  {detailsTarget.id}
                </code>
              </DetailRow>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                if (detailsTarget) {
                  const t = detailsTarget;
                  setDetailsTarget(null);
                  setRenameTarget(t);
                  setRenameDraft(t.name);
                  setRenameDescDraft(t.description ?? "");
                }
              }}
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
            <Button
              onClick={() => {
                if (detailsTarget) {
                  void openProject(detailsTarget.id);
                  setDetailsTarget(null);
                }
              }}
              disabled={detailsTarget?.id === activeProjectId}
            >
              <FolderOpen className="size-3.5" />
              Open project
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-3 border-b border-border/50 pb-2 last:border-b-0 last:pb-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 break-words text-foreground">{children}</span>
    </div>
  );
}

function ProjectCard({
  project,
  isActive,
  onOpen,
  onRename,
  onView,
  onDelete,
}: {
  project: ProjectMeta;
  isActive: boolean;
  onOpen: () => void;
  onRename: () => void;
  onView: () => void;
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
          <ProjectActionsMenu
            isActive={isActive}
            onOpen={onOpen}
            onView={onView}
            onRename={onRename}
            onDelete={onDelete}
          />
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
  onView,
  onDelete,
}: {
  project: ProjectMeta;
  isActive: boolean;
  onOpen: () => void;
  onRename: () => void;
  onView: () => void;
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
      className="group grid cursor-pointer grid-cols-[auto_1fr_120px_120px_auto] items-center gap-3 border-b px-4 py-2.5 text-sm transition-colors last:border-b-0 hover:bg-muted/50"
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
      <ProjectActionsMenu
        isActive={isActive}
        onOpen={onOpen}
        onView={onView}
        onRename={onRename}
        onDelete={onDelete}
      />
    </div>
  );
}

function ProjectActionsMenu({
  isActive,
  onOpen,
  onView,
  onRename,
  onDelete,
}: {
  isActive: boolean;
  onOpen: () => void;
  onView: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Project actions"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-opacity hover:bg-muted hover:text-foreground data-[popup-open]:bg-muted data-[popup-open]:text-foreground data-[popup-open]:opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          >
            <MoreHorizontal className="size-4" />
          </button>
        }
      />
      <DropdownMenuContent align="end" sideOffset={4} className="min-w-[180px]">
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
          disabled={isActive}
        >
          <FolderOpen />
          {isActive ? "Already open" : "Open project"}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }}
        >
          <Eye />
          View details
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onRename();
          }}
        >
          <Pencil />
          Edit name &amp; description
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
          Delete project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
