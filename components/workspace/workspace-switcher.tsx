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
  ChevronDown,
  Plus,
  Check,
  Pencil,
  Trash2,
  Folder,
  Loader2,
  Cloud,
  CloudOff,
  CheckCircle2,
} from "lucide-react";

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
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setOpen((v) => !v)}
          className="h-7 max-w-[180px] gap-1.5 px-2 text-xs"
          disabled={loading}
        >
          <Folder className="size-3.5 shrink-0 text-violet-500" />
          <span className="truncate font-medium">
            {loading ? "Loading…" : (active?.name ?? "No workspace")}
          </span>
          <SaveIndicator status={saveStatus} />
          <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
        </Button>

        {open && (
          <div className="absolute left-0 top-8 z-50 min-w-[260px] rounded-md border bg-popover p-1 shadow-lg">
            <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Workspaces
            </div>
            <div className="max-h-[280px] overflow-auto">
              {workspaces.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  No workspaces yet.
                </p>
              )}
              {workspaces.map((w) => {
                const isActive = w.id === activeWorkspaceId;
                const isRenaming = renameId === w.id;
                return (
                  <div
                    key={w.id}
                    className={`group/ws flex items-center gap-1 rounded px-1.5 py-1 ${
                      isActive ? "bg-muted/60" : "hover:bg-muted/40"
                    }`}
                  >
                    <button
                      onClick={() => {
                        if (!isActive && !isRenaming) {
                          switchWorkspace(w.id);
                          setOpen(false);
                        }
                      }}
                      className="flex flex-1 items-center gap-2 truncate text-left text-xs"
                    >
                      {isActive ? (
                        <Check className="size-3 shrink-0 text-violet-500" />
                      ) : (
                        <Folder className="size-3 shrink-0 text-muted-foreground" />
                      )}
                      {isRenaming ? (
                        <Input
                          autoFocus
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename(w.id);
                            if (e.key === "Escape") {
                              setRenameId(null);
                              setRenameDraft("");
                            }
                          }}
                          onBlur={() => handleRename(w.id)}
                          className="h-6 flex-1 text-xs"
                        />
                      ) : (
                        <span
                          className={`flex-1 truncate ${isActive ? "font-medium" : ""}`}
                        >
                          {w.name}
                        </span>
                      )}
                    </button>
                    {!isRenaming && (
                      <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/ws:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenameId(w.id);
                            setRenameDraft(w.name);
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          title="Rename"
                        >
                          <Pencil className="size-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(w.id);
                            setOpen(false);
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
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
            <div className="my-1 h-px bg-border" />
            <button
              onClick={() => {
                setCreateOpen(true);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-violet-600 hover:bg-violet-500/10 dark:text-violet-400"
            >
              <Plus className="size-3" />
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
              Each workspace stores its own schema, tables, and relations.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-1">
            <Label htmlFor="ws-name" className="text-xs">
              Name
            </Label>
            <Input
              id="ws-name"
              autoFocus
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="e.g. Marketplace, CRM, Analytics"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!createName.trim()}>
              Create
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
          const w = workspaces.find((x) => x.id === confirmDeleteId);
          return w ? `Delete workspace "${w.name}"?` : "Delete workspace?";
        })()}
        description="This permanently removes the workspace and all its tables, columns, and relations. Cannot be undone."
        confirmLabel="Delete workspace"
        onConfirm={() => {
          if (confirmDeleteId) deleteWorkspace(confirmDeleteId);
        }}
      />
    </>
  );
}

function SaveIndicator({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "saving") {
    return (
      <span title="Saving">
        <Loader2 className="size-3 animate-spin text-muted-foreground" />
      </span>
    );
  }
  if (status === "saved") {
    return (
      <span title="Saved">
        <CheckCircle2 className="size-3 text-emerald-500" />
      </span>
    );
  }
  if (status === "error") {
    return (
      <span title="Save failed">
        <CloudOff className="size-3 text-destructive" />
      </span>
    );
  }
  return (
    <span title="In sync">
      <Cloud className="size-3 text-muted-foreground/40" />
    </span>
  );
}
