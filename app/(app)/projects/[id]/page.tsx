"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useWorkspace, type SchemaMeta } from "@/lib/workspace-context";
import { AppSidebar } from "@/components/workspace/app-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  ArrowRight,
  ChevronRight,
  Clock,
  Copy,
  ExternalLink,
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

function SchemaCard({
  schema,
  isActive,
  onOpen,
  onDuplicate,
  onRename,
  onDelete,
}: {
  schema: SchemaMeta;
  isActive: boolean;
  onOpen: () => void;
  onDuplicate: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  return (
    <Card
      className={`group/schema flex flex-col transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 ${
        isActive ? "ring-2 ring-primary/40" : ""
      }`}
    >
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between">
          <div
            className={`flex size-10 items-center justify-center rounded-xl ${
              isActive
                ? "bg-primary/15 ring-2 ring-primary/20"
                : "bg-emerald-500/10"
            }`}
          >
            <FileText
              className={`size-5 ${isActive ? "text-primary" : "text-emerald-600 dark:text-emerald-400"}`}
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity outline-none group-hover/schema:opacity-100 data-[popup-open]:opacity-100 hover:bg-muted focus-visible:opacity-100"
                />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={4}>
              <DropdownMenuItem onClick={onOpen}>
                <ExternalLink />
                Open in canvas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy />
                Duplicate
              </DropdownMenuItem>
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
            <h3 className="truncate font-semibold">{schema.name}</h3>
            {isActive && (
              <Badge className="shrink-0 bg-primary/15 text-primary border-primary/20 text-[10px] font-medium hover:bg-primary/15">
                active
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Version {schema.version}
          </p>
        </div>
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2 border-t px-5 py-3">
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="size-3" />
          <span>
            {new Date(schema.updatedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <button
          onClick={onOpen}
          className="flex items-center gap-1 text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover/schema:opacity-100 hover:underline underline-offset-2"
        >
          Open <ArrowRight className="size-3" />
        </button>
      </CardFooter>
    </Card>
  );
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const router = useRouter();

  const {
    workspaces,
    activeWorkspaceId,
    projects,
    activeProjectId,
    schemas,
    activeSchemaId,
    loading,
    switchProject,
    switchSchema,
    createSchemaInProject,
    renameSchema,
    deleteSchema,
    duplicateSchema,
  } = useWorkspace();

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [renameTarget, setRenameTarget] = useState<SchemaMeta | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (projectId && projectId !== activeProjectId && projects.some((p) => p.id === projectId)) {
      switchProject(projectId);
    }
  }, [projectId, activeProjectId, projects, switchProject]);

  const project = projects.find((p) => p.id === projectId);
  const workspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name) return;
    await createSchemaInProject(name);
    setCreateName("");
    setCreateOpen(false);
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const next = renameDraft.trim();
    if (next) await renameSchema(renameTarget.id, next);
    setRenameTarget(null);
    setRenameDraft("");
  };

  const openInCanvas = async (id: string) => {
    if (id !== activeSchemaId) await switchSchema(id);
    router.push("/");
  };

  return (
    <div className="flex h-full flex-1 overflow-hidden">
      <AppSidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 px-6 backdrop-blur-sm">
          <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Link href="/projects" className="hover:text-foreground">
              Projects
            </Link>
            <ChevronRight className="size-3.5" />
            <span className="font-medium text-foreground">
              {project?.name ?? "Project"}
            </span>
          </nav>
          <div className="ml-auto">
            <Button size="sm" onClick={() => setCreateOpen(true)} disabled={!project}>
              <Plus className="size-3.5" />
              New schema
            </Button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl space-y-8 p-8">
            {/* Hero */}
            <div className="flex items-start gap-4">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 ring-1 ring-primary/20">
                <FolderOpen className="size-6 text-primary" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {workspace?.name}
                </p>
                <h1 className="text-2xl font-bold tracking-tight">
                  {project?.name ?? "Project"}
                </h1>
                {project?.description && (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {project.description}
                  </p>
                )}
              </div>
            </div>

            {/* Schemas */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-semibold">
                  Schemas{" "}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    ({schemas.length})
                  </span>
                </h2>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2].map((i) => (
                    <Card key={i}>
                      <CardContent className="p-5">
                        <div className="space-y-3">
                          <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
                          <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
                          <div className="h-3 w-1/4 animate-pulse rounded bg-muted" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : !project ? (
                <p className="text-sm text-muted-foreground">Project not found.</p>
              ) : schemas.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/50 py-16 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10">
                    <FileText className="size-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h3 className="mt-4 font-semibold">No schemas yet</h3>
                  <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
                    Create your first schema to start designing tables and relationships.
                  </p>
                  <Button className="mt-5" onClick={() => setCreateOpen(true)}>
                    <Plus className="size-3.5" />
                    Create schema
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {schemas.map((s) => (
                    <SchemaCard
                      key={s.id}
                      schema={s}
                      isActive={s.id === activeSchemaId}
                      onOpen={() => openInCanvas(s.id)}
                      onDuplicate={() => duplicateSchema(s.id)}
                      onRename={() => { setRenameTarget(s); setRenameDraft(s.name); }}
                      onDelete={() => setConfirmDeleteId(s.id)}
                    />
                  ))}

                  {/* Add schema card */}
                  <button
                    onClick={() => setCreateOpen(true)}
                    className="flex min-h-[180px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card/50 text-muted-foreground transition-colors hover:border-emerald-400/40 hover:bg-emerald-500/5 hover:text-emerald-600 dark:hover:text-emerald-400"
                  >
                    <div className="flex size-10 items-center justify-center rounded-full bg-muted">
                      <Plus className="size-5" />
                    </div>
                    <span className="text-sm font-medium">New schema</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Dialogs */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New schema</DialogTitle>
            <DialogDescription>A schema is a canvas of tables and relations.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5 py-1">
            <Label htmlFor="schema-name" className="text-xs">Name</Label>
            <Input
              id="schema-name"
              autoFocus
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. v1, draft, production"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!createName.trim()}>Create schema</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(o) => { if (!o) { setRenameTarget(null); setRenameDraft(""); } }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Rename schema</DialogTitle></DialogHeader>
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
        title={(() => { const s = schemas.find((x) => x.id === confirmDeleteId); return s ? `Delete "${s.name}"?` : "Delete schema?"; })()}
        description="This permanently removes the schema and all its tables. Cannot be undone."
        confirmLabel="Delete schema"
        onConfirm={() => { if (confirmDeleteId) deleteSchema(confirmDeleteId); }}
      />
    </div>
  );
}
