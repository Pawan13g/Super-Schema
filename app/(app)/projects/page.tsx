"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useWorkspace, type ProjectMeta } from "@/lib/workspace-context";
import { AppSidebar } from "@/components/workspace/app-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  ArrowRight,
  Clock,
  FileText,
  FolderOpen,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function StatsBar({
  projectCount,
  schemaCount,
}: {
  projectCount: number;
  schemaCount: number;
}) {
  const stats = [
    { label: "Projects", value: projectCount, icon: FolderOpen, color: "text-primary" },
    { label: "Schemas", value: schemaCount, icon: FileText, color: "text-emerald-600 dark:text-emerald-400" },
  ];
  return (
    <div className="flex items-center gap-4">
      {stats.map(({ label, value, icon: Icon, color }) => (
        <div
          key={label}
          className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2.5 shadow-sm"
        >
          <Icon className={`size-4 ${color}`} />
          <div>
            <p className="text-xl font-bold leading-none">{value}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
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

  const colors = [
    "from-violet-500 to-purple-600",
    "from-blue-500 to-indigo-600",
    "from-emerald-500 to-teal-600",
    "from-orange-500 to-amber-600",
    "from-rose-500 to-pink-600",
    "from-cyan-500 to-sky-600",
  ];
  const seed = (project.id.charCodeAt(0) ?? 0) + (project.id.charCodeAt(4) ?? 0);
  const colorIdx = seed % colors.length;

  return (
    <Card className="group/card flex flex-col overflow-hidden transition-all duration-200 hover:shadow-md hover:-translate-y-0.5">
      {/* Gradient header */}
      <div className={`h-2 w-full bg-gradient-to-r ${colors[colorIdx]}`} />

      <CardContent className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <div
            className={`flex size-9 items-center justify-center rounded-lg bg-gradient-to-br ${colors[colorIdx]} shadow-sm`}
          >
            <FolderOpen className="size-4.5 text-white" />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="ml-auto rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity outline-none group-hover/card:opacity-100 data-[popup-open]:opacity-100 hover:bg-muted focus-visible:opacity-100"
                />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4}>
              <DropdownMenuItem onClick={onRename}>
                <Pencil />
                Rename
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onClick={onDelete}>
                <Trash2 />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div>
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold">{project.name}</h3>
            {isActive && (
              <Badge variant="secondary" className="shrink-0 text-[10px]">active</Badge>
            )}
          </div>
          {project.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
              {project.description}
            </p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground/50 italic">No description</p>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2 border-t px-5 py-3">
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <FileText className="size-3" />
            {schemaCount} schema{schemaCount === 1 ? "" : "s"}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {new Date(project.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        </div>
        <button
          onClick={onOpen}
          className="flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover/card:opacity-100 hover:underline underline-offset-2"
        >
          Open <ArrowRight className="size-3" />
        </button>
      </CardFooter>
    </Card>
  );
}

export default function ProjectsDashboardPage() {
  const router = useRouter();
  const {
    workspaces,
    activeWorkspaceId,
    projects,
    activeProjectId,
    schemas,
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

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

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

  return (
    <div className="flex h-full flex-1 overflow-hidden">
      <AppSidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-6 backdrop-blur-sm">
          <h2 className="text-sm font-semibold">Projects</h2>
          <div className="ml-auto">
            <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!activeWorkspaceId}>
              <Plus className="size-3.5" />
              New project
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl space-y-8 p-8">
            {/* Hero */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-medium text-primary uppercase tracking-wider mb-1">
                  {activeWorkspace?.name ?? "Workspace"}
                </p>
                <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Each project holds a set of related schemas — like different microservices or environments.
                </p>
              </div>
              <StatsBar
                projectCount={projects.length}
                schemaCount={schemas.length}
              />
            </div>

            {/* Projects grid */}
            {loading ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="overflow-hidden">
                    <div className="h-2 animate-pulse bg-muted" />
                    <CardContent className="p-5">
                      <div className="space-y-3">
                        <div className="h-9 w-9 animate-pulse rounded-lg bg-muted" />
                        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
                        <div className="h-3 w-full animate-pulse rounded bg-muted" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/50 py-20 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
                  <FolderOpen className="size-6 text-primary" />
                </div>
                <h3 className="mt-4 text-base font-semibold">No projects yet</h3>
                <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
                  Create your first project to start organizing and versioning your database schemas.
                </p>
                <Button className="mt-6" onClick={() => setCreateOpen(true)}>
                  <Plus className="size-3.5" />
                  Create your first project
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {projects.map((p) => (
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

                {/* Add project card */}
                <button
                  onClick={() => setCreateOpen(true)}
                  className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card/50 text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                >
                  <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <Plus className="size-5" />
                  </div>
                  <span className="text-sm font-medium">New project</span>
                </button>
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
              <Label htmlFor="project-name" className="text-xs">Name</Label>
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
              <Label htmlFor="project-desc" className="text-xs">Description (optional)</Label>
              <Input
                id="project-desc"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="What is this project for?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!createName.trim()}>Create project</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameTarget !== null} onOpenChange={(o) => { if (!o) { setRenameTarget(null); setRenameDraft(""); } }}>
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
            <Button variant="outline" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={handleRename} disabled={!renameDraft.trim()}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(o) => { if (!o) setConfirmDeleteId(null); }}
        title={(() => { const p = projects.find((x) => x.id === confirmDeleteId); return p ? `Delete "${p.name}"?` : "Delete project?"; })()}
        description="This permanently deletes the project and all its schemas. Cannot be undone."
        confirmLabel="Delete project"
        onConfirm={() => { if (confirmDeleteId) deleteProject(confirmDeleteId); }}
      />
    </div>
  );
}
