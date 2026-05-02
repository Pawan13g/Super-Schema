"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader } from "@/components/ui/loader";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tip } from "@/components/ui/tip";
import { useWorkspace } from "@/lib/workspace-context";
import { toast } from "sonner";
import {
  Clock,
  FileText,
  FolderOpen,
  RotateCcw,
  Trash2,
  Trash,
} from "lucide-react";

interface TrashProject {
  id: string;
  name: string;
  description: string | null;
  deletedAt: string;
  workspaceId: string;
  workspace: { id: string; name: string };
}

interface TrashSchema {
  id: string;
  name: string;
  deletedAt: string;
  version: number;
  projectId: string;
  project: { id: string; name: string; deletedAt: string | null; workspaceId: string };
}

interface TrashDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TrashDialog({ open, onOpenChange }: TrashDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-h-[80vh] w-[calc(100%-2rem)] flex-col gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash className="size-4" />
            Trash bin
          </DialogTitle>
          <DialogDescription>
            Deleted projects and schemas. Recovered any time within 30 days.
            After that the rows are pruned permanently.
          </DialogDescription>
        </DialogHeader>
        {open && <TrashBody />}
      </DialogContent>
    </Dialog>
  );
}

function TrashBody() {
  const { activeWorkspaceId, refreshProjects, refreshWorkspaces } =
    useWorkspace();
  const [tab, setTab] = useState<"projects" | "schemas">("projects");
  const [projects, setProjects] = useState<TrashProject[]>([]);
  const [schemas, setSchemas] = useState<TrashSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<
    | { kind: "project"; id: string; name: string }
    | { kind: "schema"; id: string; name: string }
    | null
  >(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/trash");
      if (!res.ok) {
        toast.error("Failed to load trash");
        return;
      }
      const data = (await res.json()) as {
        projects: TrashProject[];
        schemas: TrashSchema[];
      };
      setProjects(data.projects);
      setSchemas(data.schemas);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    void refresh();
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const restoreProject = async (id: string) => {
    const res = await fetch(`/api/trash/projects/${id}`, { method: "POST" });
    if (!res.ok) {
      toast.error("Restore failed");
      return;
    }
    toast.success("Project restored");
    if (activeWorkspaceId) await refreshProjects(activeWorkspaceId);
    await refreshWorkspaces();
    await refresh();
  };

  const restoreSchema = async (id: string) => {
    const res = await fetch(`/api/trash/schemas/${id}`, { method: "POST" });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast.error(err.error ?? "Restore failed");
      return;
    }
    toast.success("Schema restored");
    await refresh();
  };

  const purgeProject = async (id: string) => {
    const res = await fetch(`/api/trash/projects/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Permanent delete failed");
      return;
    }
    toast.success("Permanently deleted");
    await refresh();
  };

  const purgeSchema = async (id: string) => {
    const res = await fetch(`/api/trash/schemas/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Permanent delete failed");
      return;
    }
    toast.success("Permanently deleted");
    await refresh();
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <Tabs value={tab} onValueChange={(v) => setTab((v ?? "projects") as "projects" | "schemas")}>
        <TabsList className="h-7">
          <TabsTrigger value="projects" className="gap-1 px-2.5 text-[11px]">
            <FolderOpen className="size-3" />
            Projects
            <span className="ml-1 rounded bg-foreground/10 px-1 py-px text-[9px] font-bold">
              {projects.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="schemas" className="gap-1 px-2.5 text-[11px]">
            <FileText className="size-3" />
            Schemas
            <span className="ml-1 rounded bg-foreground/10 px-1 py-px text-[9px] font-bold">
              {schemas.length}
            </span>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <ScrollArea className="mt-2 flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader />
          </div>
        ) : tab === "projects" ? (
          projects.length === 0 ? (
            <EmptyState label="No deleted projects." />
          ) : (
            <ul className="divide-y">
              {projects.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{p.name}</p>
                    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{p.workspace.name}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-2.5" />
                        {timeUntilPurge(p.deletedAt)}
                      </span>
                    </p>
                  </div>
                  <Tip label="Restore">
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => restoreProject(p.id)}
                    >
                      <RotateCcw className="size-3" />
                      Restore
                    </Button>
                  </Tip>
                  <Tip label="Delete permanently">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() =>
                        setConfirmDelete({
                          kind: "project",
                          id: p.id,
                          name: p.name,
                        })
                      }
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  </Tip>
                </li>
              ))}
            </ul>
          )
        ) : schemas.length === 0 ? (
          <EmptyState label="No deleted schemas." />
        ) : (
          <ul className="divide-y">
            {schemas.map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2.5">
                <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.name}</p>
                  <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                    <span className="truncate">{s.project.name}</span>
                    {s.project.deletedAt && (
                      <span className="rounded bg-amber-500/10 px-1 py-px text-[9px] font-bold text-amber-600">
                        parent in trash
                      </span>
                    )}
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="size-2.5" />
                      {timeUntilPurge(s.deletedAt)}
                    </span>
                  </p>
                </div>
                <Tip
                  label={
                    s.project.deletedAt
                      ? "Restore the parent project first"
                      : "Restore"
                  }
                >
                  <Button
                    variant="outline"
                    size="xs"
                    onClick={() => restoreSchema(s.id)}
                    disabled={!!s.project.deletedAt}
                  >
                    <RotateCcw className="size-3" />
                    Restore
                  </Button>
                </Tip>
                <Tip label="Delete permanently">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() =>
                      setConfirmDelete({
                        kind: "schema",
                        id: s.id,
                        name: s.name,
                      })
                    }
                  >
                    <Trash2 className="size-3.5 text-muted-foreground" />
                  </Button>
                </Tip>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmDelete(null);
        }}
        title={
          confirmDelete
            ? `Delete "${confirmDelete.name}" permanently?`
            : "Delete permanently?"
        }
        description="This cannot be undone. All associated data is removed immediately."
        confirmLabel="Delete forever"
        variant="destructive"
        onConfirm={() => {
          if (!confirmDelete) return;
          if (confirmDelete.kind === "project") void purgeProject(confirmDelete.id);
          else void purgeSchema(confirmDelete.id);
        }}
      />
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
      <Trash className="size-8 text-muted-foreground/30" />
      <p>{label}</p>
    </div>
  );
}

function timeUntilPurge(deletedAt: string): string {
  const purgeAt = new Date(deletedAt).getTime() + 30 * 24 * 60 * 60 * 1000;
  const remaining = purgeAt - Date.now();
  if (remaining <= 0) return "purging soon";
  const days = Math.floor(remaining / (24 * 60 * 60 * 1000));
  if (days >= 1) return `purges in ${days}d`;
  const hours = Math.floor(remaining / (60 * 60 * 1000));
  return `purges in ${hours}h`;
}
