"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useWorkspace, type ProjectMeta } from "@/lib/workspace-context";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { UserMenu } from "@/components/workspace/user-menu";
import {
  Check,
  ChevronDown,
  Database,
  FolderOpen,
  LayoutDashboard,
  MoreHorizontal,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const {
    workspaces,
    activeWorkspaceId,
    projects,
    activeProjectId,
    loading,
    switchWorkspace,
    createWorkspace,
    createProject,
    switchProject,
    renameProject,
    deleteProject,
  } = useWorkspace();

  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [renameTarget, setRenameTarget] = useState<ProjectMeta | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<ProjectMeta | null>(null);

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  const navLinks = [
    {
      href: "/projects",
      label: "Projects",
      icon: LayoutDashboard,
      active: pathname === "/projects",
    },
    {
      href: "/",
      label: "Canvas",
      icon: Database,
      active: pathname === "/",
    },
  ];

  const handleCreateWorkspace = async () => {
    const n = newWorkspaceName.trim();
    if (!n) return;
    await createWorkspace(n);
    setNewWorkspaceName("");
    setNewWorkspaceOpen(false);
  };

  const handleCreateProject = async () => {
    const n = newProjectName.trim();
    if (!n) return;
    const p = await createProject(n);
    setNewProjectName("");
    setNewProjectOpen(false);
    if (p) router.push(`/projects/${p.id}`);
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    const n = renameDraft.trim();
    if (n) await renameProject(renameTarget.id, n);
    setRenameTarget(null);
    setRenameDraft("");
  };

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col overflow-hidden border-r bg-sidebar">
      {/* Workspace switcher — pinned at top */}
      <div className="shrink-0 border-b p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                disabled={loading}
                className="flex w-full items-center gap-2.5 rounded-lg p-2 text-left outline-none transition-colors hover:bg-accent focus-visible:bg-accent disabled:opacity-50 data-[popup-open]:bg-accent"
              />
            }
          >
            <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10">
              <Database className="size-3.5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold leading-none">
                {loading ? "Loading…" : (activeWorkspace?.name ?? "Workspace")}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {workspaces.length} workspace{workspaces.length === 1 ? "" : "s"}
              </p>
            </div>
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[var(--anchor-width)] min-w-[220px]"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
              {workspaces.map((w) => (
                <DropdownMenuItem
                  key={w.id}
                  onClick={() => switchWorkspace(w.id)}
                  disabled={w.id === activeWorkspaceId}
                >
                  {w.id === activeWorkspaceId ? (
                    <Check />
                  ) : (
                    <span className="size-3.5" />
                  )}
                  <span className="truncate">{w.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setNewWorkspaceOpen(true)}>
              <Plus />
              New workspace
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Nav — independently scrollable */}
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {navLinks.map(({ href, label, icon: Icon, active }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}

        {/* Projects section */}
        <div className="mt-4 mb-1 flex items-center justify-between px-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Projects
          </span>
          <button
            type="button"
            onClick={() => setNewProjectOpen(true)}
            className="rounded p-0.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title="New project"
          >
            <Plus className="size-3" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-1 px-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-7 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <p className="px-3 text-xs text-muted-foreground">No projects yet.</p>
        ) : (
          <div className="space-y-0.5">
            {projects.map((p) => {
              const isActive = p.id === activeProjectId;
              return (
                <div key={p.id} className="group/proj relative flex items-center">
                  <Link
                    href={`/projects/${p.id}`}
                    onClick={() => switchProject(p.id)}
                    className={cn(
                      "flex flex-1 items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-accent font-medium text-accent-foreground"
                        : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                    )}
                  >
                    <FolderOpen
                      className={cn(
                        "size-3.5 shrink-0",
                        isActive ? "text-primary" : ""
                      )}
                    />
                    <span className="truncate">{p.name}</span>
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <button
                          type="button"
                          className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground opacity-0 outline-none transition-opacity group-hover/proj:opacity-100 data-[popup-open]:opacity-100 hover:bg-muted hover:text-foreground"
                          title="Project options"
                        />
                      }
                    >
                      <MoreHorizontal className="size-3" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" sideOffset={4}>
                      <DropdownMenuItem
                        onClick={() => {
                          setRenameTarget(p);
                          setRenameDraft(p.name);
                        }}
                      >
                        <Pencil />
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        destructive
                        onClick={() => setDeleteTarget(p)}
                      >
                        <Trash2 />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </nav>

      {/* User area — pinned at bottom */}
      <div className="shrink-0 border-t p-2">
        <UserMenu variant="full" />
      </div>

      {/* Dialogs */}
      <Dialog open={newWorkspaceOpen} onOpenChange={setNewWorkspaceOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>
              Workspaces hold projects and schemas for different teams or apps.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5 py-1">
            <Label htmlFor="sidebar-new-ws" className="text-xs">
              Name
            </Label>
            <Input
              id="sidebar-new-ws"
              autoFocus
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateWorkspace()}
              placeholder="e.g. ACME Corp"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewWorkspaceOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateWorkspace}
              disabled={!newWorkspaceName.trim()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Projects group related schemas together.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5 py-1">
            <Label htmlFor="sidebar-new-proj" className="text-xs">
              Name
            </Label>
            <Input
              id="sidebar-new-proj"
              autoFocus
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
              placeholder="e.g. Billing, CRM"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProjectOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={!newProjectName.trim() || !activeWorkspaceId}
            >
              Create
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
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        title={
          deleteTarget ? `Delete "${deleteTarget.name}"?` : "Delete project?"
        }
        description="This permanently deletes the project and all its schemas. Cannot be undone."
        confirmLabel="Delete project"
        onConfirm={() => {
          if (deleteTarget) deleteProject(deleteTarget.id);
        }}
      />
    </aside>
  );
}
