"use client";

import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/loader";
import { useWorkspace } from "@/lib/workspace-context";
import { Logo } from "@/components/brand/logo";
import { ArrowLeft, ArrowRight, FolderOpen, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingLauncherProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type View = "menu" | "create";

// Obsidian-style first-run / quick-create modal. Big logo on top, friendly
// copy, then either pick an existing workspace or create a new one with a
// chosen name. Unlike the inline "+ New workspace" dropdown, this is a
// full-screen-feeling modal so the moment of "starting a new workspace"
// has weight.
export function OnboardingLauncher({
  open,
  onOpenChange,
}: OnboardingLauncherProps) {
  // Re-mount the inner form each time the modal opens so the workspace-name
  // field auto-resets without an extra `useEffect` (avoids the
  // setState-in-effect lint).
  if (!open) return null;
  return <LauncherInner onOpenChange={onOpenChange} />;
}

function LauncherInner({
  onOpenChange,
}: {
  onOpenChange: (open: boolean) => void;
}) {
  const { workspaces, switchWorkspace, createWorkspace, activeWorkspaceId } =
    useWorkspace();
  const [view, setView] = useState<View>("menu");
  const [name, setName] = useState("My Workspace");
  const [busy, setBusy] = useState(false);

  const otherWorkspaces = useMemo(
    () => workspaces.filter((w) => w.id !== activeWorkspaceId),
    [workspaces, activeWorkspaceId]
  );

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const ws = await createWorkspace(trimmed);
      if (ws) onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  const handleOpen = async (id: string) => {
    setBusy(true);
    try {
      await switchWorkspace(id);
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-md">
        {/* Hero */}
        <div className="flex flex-col items-center gap-2 bg-card px-8 pb-2 pt-10 text-center">
          <Logo size={56} className="size-14" />
          <h1 className="text-3xl font-bold tracking-tight">Super Schema</h1>
          <p className="text-xs text-muted-foreground">
            Design databases visually
          </p>
        </div>

        <DialogTitle className="sr-only">Open Super Schema</DialogTitle>

        <div className="px-8 pb-8 pt-4">
          {view === "menu" ? (
            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => setView("create")}
                disabled={busy}
                className="group flex items-center gap-3 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Plus className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">Create new workspace</p>
                  <p className="text-xs text-muted-foreground">
                    Pick a name. We&apos;ll seed a default project + schema so
                    you can start drawing right away.
                  </p>
                </div>
                <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>

              {otherWorkspaces.length > 0 && (
                <>
                  <p className="mt-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Open existing
                  </p>
                  <div className="grid max-h-[260px] gap-1 overflow-y-auto pr-1">
                    {otherWorkspaces.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => handleOpen(w.id)}
                        disabled={busy}
                        className={cn(
                          "group flex items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5",
                          busy && "opacity-50"
                        )}
                      >
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                          <FolderOpen className="size-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {w.name}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {(w._count?.projects ?? 0)} project
                            {(w._count?.projects ?? 0) === 1 ? "" : "s"}
                          </p>
                        </div>
                        <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="grid gap-4">
              <button
                type="button"
                onClick={() => setView("menu")}
                disabled={busy}
                className="inline-flex items-center gap-1.5 self-start text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-3" />
                Back
              </button>

              <div>
                <p className="text-sm font-semibold">Create workspace</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Group projects + schemas under one workspace.
                </p>
              </div>

              <div className="grid gap-1.5">
                <label
                  htmlFor="ws-name"
                  className="text-[11px] font-medium text-foreground"
                >
                  Workspace name
                </label>
                <Input
                  id="ws-name"
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="e.g. ACME Corp, Side Project"
                  disabled={busy}
                  className="h-10"
                />
              </div>

              <Button
                onClick={handleCreate}
                disabled={busy || !name.trim()}
                className="h-11 w-full bg-primary text-base font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {busy ? <Loader size="sm" /> : null}
                Create
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
