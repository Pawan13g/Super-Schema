"use client";

import { useEffect, useRef, useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Check,
  ChevronDown,
  Cloud,
  CloudOff,
  CheckCircle2,
  Database,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function WorkspaceSwitcher() {
  const {
    workspaces,
    activeWorkspaceId,
    loading,
    saveStatus,
    switchWorkspace,
    createWorkspace,
    renameWorkspace,
    deleteWorkspace,
  } = useWorkspace();

  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const active = workspaces.find((w) => w.id === activeWorkspaceId);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  const handleCreate = async () => {
    const name = createName.trim();
    if (!name) return;
    await createWorkspace(name);
    setCreateName("");
    setCreateOpen(false);
    setOpen(false);
  };

  const handleRename = async (id: string) => {
    const next = renameDraft.trim();
    if (next) await renameWorkspace(id, next);
    setRenameId(null);
    setRenameDraft("");
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setOpen((v) => !v)}
          disabled={loading}
          className="flex h-7 items-center gap-2 rounded-lg border border-transparent px-2 text-sm font-medium hover:border-border hover:bg-accent disabled:opacity-50"
        >
          <Database className="size-3.5 shrink-0 text-primary" />
          <span className="max-w-[140px] truncate">
            {loading ? "Loading…" : (active?.name ?? "Workspace")}
          </span>
          <SaveIndicator status={saveStatus} />
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        </button>

        {open && (
          <div className="absolute left-0 top-9 z-50 min-w-[240px] rounded-xl border bg-popover p-1.5 shadow-xl">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Workspaces
            </p>
            <div className="max-h-[260px] overflow-y-auto">
              {workspaces.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No workspaces.</p>
              )}
              {workspaces.map((w) => {
                const isActive = w.id === activeWorkspaceId;
                const isRenaming = renameId === w.id;
                return (
                  <div
                    key={w.id}
                    className={cn(
                      "group/ws flex items-center gap-1.5 rounded-lg px-1.5 py-1",
                      isActive ? "bg-accent" : "hover:bg-accent/60"
                    )}
                  >
                    <button
                      onClick={() => {
                        if (!isActive && !isRenaming) {
                          switchWorkspace(w.id);
                          setOpen(false);
                        }
                      }}
                      className="flex flex-1 items-center gap-2 truncate text-left text-sm"
                    >
                      {isActive ? (
                        <Check className="size-3.5 shrink-0 text-primary" />
                      ) : (
                        <div className="size-3.5 shrink-0" />
                      )}
                      {isRenaming ? (
                        <Input
                          autoFocus
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(w.id);
                            if (e.key === "Escape") { setRenameId(null); setRenameDraft(""); }
                          }}
                          onBlur={() => handleRename(w.id)}
                          className="h-6 flex-1 text-xs"
                        />
                      ) : (
                        <span className={cn("flex-1 truncate", isActive && "font-medium")}>
                          {w.name}
                        </span>
                      )}
                    </button>
                    {!isRenaming && (
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/ws:opacity-100">
                        <button
                          onClick={(e) => { e.stopPropagation(); setRenameId(w.id); setRenameDraft(w.name); }}
                          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Rename"
                        >
                          <Pencil className="size-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(w.id); setOpen(false); }}
                          className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          title="Delete"
                          disabled={workspaces.length === 1}
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="my-1.5 h-px bg-border" />
            <button
              onClick={() => { setCreateOpen(true); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-primary hover:bg-accent"
            >
              <Plus className="size-3.5" />
              New workspace
            </button>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>
              Workspaces hold projects and schemas for different teams or apps.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5 py-1">
            <Label htmlFor="ws-name" className="text-xs">Name</Label>
            <Input
              id="ws-name"
              autoFocus
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. ACME Corp, Side Project"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!createName.trim()}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteId !== null}
        onOpenChange={(o) => { if (!o) setConfirmDeleteId(null); }}
        title={(() => { const w = workspaces.find((x) => x.id === confirmDeleteId); return w ? `Delete "${w.name}"?` : "Delete workspace?"; })()}
        description="This permanently removes the workspace and all its projects and schemas."
        confirmLabel="Delete workspace"
        onConfirm={() => { if (confirmDeleteId) deleteWorkspace(confirmDeleteId); }}
      />
    </>
  );
}

function SaveIndicator({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "saving") return <span title="Saving…"><Loader2 className="size-3 animate-spin text-muted-foreground" /></span>;
  if (status === "saved") return <span title="Saved"><CheckCircle2 className="size-3 text-emerald-500" /></span>;
  if (status === "error") return <span title="Save failed"><CloudOff className="size-3 text-destructive" /></span>;
  return <span title="In sync"><Cloud className="size-3 text-muted-foreground/30" /></span>;
}
