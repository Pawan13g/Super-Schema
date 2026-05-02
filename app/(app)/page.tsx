"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/lib/workspace-context";
import { useIsMobile, useIsTablet } from "@/lib/use-media-query";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { ProjectSchemaNav } from "@/components/workspace/project-schema-nav";
import { AppMenubar } from "@/components/workspace/app-menubar";
import { UserMenu } from "@/components/workspace/user-menu";
import { SchemaCanvas } from "@/components/canvas/schema-canvas";
import { SchemaSidebar } from "@/components/sidebar/schema-sidebar";
import { SqlPreview } from "@/components/sql-panel/sql-preview";
import { AiChat } from "@/components/ai-panel/ai-chat";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddRelationDialog } from "@/components/canvas/add-relation-dialog";
import {
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
  Database,
  FolderOpen,
  FileText,
  Sparkles,
} from "lucide-react";
import { usePanelRef } from "react-resizable-panels";
import { exportCanvasPng } from "@/lib/export-utils";

function BrandLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex size-6 items-center justify-center rounded-md bg-primary/15">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          className="size-5"
          aria-hidden="true"
        >
          <rect x="2" y="10" width="2.5" height="11" rx="1" fill="#a78bfa" />
          <rect x="6" y="6" width="2.5" height="15" rx="1" fill="#8b5cf6" />
          <rect x="10" y="3" width="2.5" height="18" rx="1" fill="#7c3aed" />
          <rect x="14" y="7" width="2.5" height="14" rx="1" fill="#8b5cf6" />
          <rect x="18" y="11" width="2.5" height="10" rx="1" fill="#a78bfa" />
        </svg>
      </div>
      <span className="hidden text-sm font-bold tracking-tight sm:block">
        Super Schema
      </span>
    </div>
  );
}

function CanvasHeader({
  onToggleSidebar,
  sidebarCollapsed,
}: {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}) {
  const {
    workspaces,
    activeWorkspaceId,
    projects,
    activeProjectId,
    schemas,
    activeSchemaId,
  } = useWorkspace();
  const workspace = workspaces.find((w) => w.id === activeWorkspaceId);
  const project = projects.find((p) => p.id === activeProjectId);
  const schema = schemas.find((s) => s.id === activeSchemaId);

  return (
    <div className="flex shrink-0 items-center gap-2 overflow-hidden border-b bg-card/60 px-2 py-2 backdrop-blur-sm sm:px-3">
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleSidebar}
        title="Toggle sidebar"
        className="size-7 shrink-0"
      >
        {sidebarCollapsed ? (
          <PanelLeft className="size-4" />
        ) : (
          <PanelLeftClose className="size-4" />
        )}
      </Button>

      <div className="hidden sm:contents">
        <WorkspaceSwitcher />
        <ProjectSchemaNav />
      </div>

      <div className="ml-auto flex min-w-0 items-center gap-1 text-xs text-muted-foreground md:hidden">
        <FileText className="size-3 shrink-0 text-emerald-500" />
        <span className="max-w-[140px] truncate font-medium text-foreground">
          {schema?.name ?? "Schema"}
        </span>
      </div>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const sidebarRef = usePanelRef();
  const sqlPanelRef = usePanelRef();
  const aiPanelRef = usePanelRef();
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sqlPanelCollapsed, setSqlPanelCollapsed] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(true);

  // Re-balance panels when the breakpoint flips (rotate phone, resize window).
  // ResizablePanel locks its initial size at mount, so we call resize/expand
  // imperatively whenever the breakpoint changes.
  useEffect(() => {
    const sidebar = sidebarRef.current;
    const sql = sqlPanelRef.current;
    if (isMobile) {
      sidebar?.collapse();
      sql?.collapse();
      setAiPanelOpen(false);
    } else if (isTablet) {
      sidebar?.collapse();
      sql?.expand?.();
      sql?.resize?.(35);
      setAiPanelOpen(false);
    } else {
      // Desktop — restore the default 3-pane layout.
      sidebar?.expand?.();
      sidebar?.resize?.(20);
      sql?.expand?.();
      sql?.resize?.(35);
      setAiPanelOpen(true);
    }
  }, [isMobile, isTablet, sidebarRef, sqlPanelRef]);

  const {
    activeProjectId,
    activeWorkspaceId,
    activeSchemaId,
    schemas,
    createSchemaInProject,
    createProject,
    createWorkspace,
    renameSchema,
  } = useWorkspace();

  const [newSchemaOpen, setNewSchemaOpen] = useState(false);
  const [newSchemaName, setNewSchemaName] = useState("");
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDesc, setNewProjectDesc] = useState("");
  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState("");
  const [renameSchemaOpen, setRenameSchemaOpen] = useState(false);
  const [renameSchemaDraft, setRenameSchemaDraft] = useState("");
  const [addRelationOpen, setAddRelationOpen] = useState(false);

  const activeSchema = schemas.find((s) => s.id === activeSchemaId);

  const toggleSidebar = () => {
    const panel = sidebarRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  };

  const toggleSqlPanel = () => {
    const panel = sqlPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand();
    else panel.collapse();
  };

  const handleCreateSchema = async () => {
    const name = newSchemaName.trim();
    if (!name || !activeProjectId) return;
    await createSchemaInProject(name);
    setNewSchemaName("");
    setNewSchemaOpen(false);
  };

  const handleCreateProject = async () => {
    const name = newProjectName.trim();
    if (!name || !activeWorkspaceId) return;
    const created = await createProject(name, newProjectDesc.trim() || undefined);
    setNewProjectName("");
    setNewProjectDesc("");
    setNewProjectOpen(false);
    if (created) router.push(`/projects/${created.id}`);
  };

  const handleCreateWorkspace = async () => {
    const name = newWorkspaceName.trim();
    if (!name) return;
    await createWorkspace(name);
    setNewWorkspaceName("");
    setNewWorkspaceOpen(false);
  };

  const handleRenameSchema = async () => {
    const next = renameSchemaDraft.trim();
    if (!next || !activeSchemaId) return;
    await renameSchema(activeSchemaId, next);
    setRenameSchemaDraft("");
    setRenameSchemaOpen(false);
  };

  return (
    <div className="flex h-full w-full flex-1 flex-col overflow-hidden">
      <header className="flex h-10 shrink-0 items-center gap-2 overflow-x-auto overflow-y-hidden border-b bg-background/95 px-2 backdrop-blur-sm sm:gap-3 sm:px-3">
        <Link href="/" className="shrink-0">
          <BrandLogo />
        </Link>
        <div className="hidden h-4 w-px shrink-0 bg-border sm:block" />
        <AppMenubar
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
          sqlPanelCollapsed={sqlPanelCollapsed}
          onToggleSqlPanel={toggleSqlPanel}
          aiPanelOpen={aiPanelOpen}
          onToggleAiPanel={() => setAiPanelOpen((v) => !v)}
          onNewSchema={() => {
            setNewSchemaName(`Schema ${schemas.length + 1}`);
            setNewSchemaOpen(true);
          }}
          onNewProject={() => {
            setNewProjectName("");
            setNewProjectDesc("");
            setNewProjectOpen(true);
          }}
          onNewWorkspace={() => {
            setNewWorkspaceName("");
            setNewWorkspaceOpen(true);
          }}
          onRenameSchema={() => {
            setRenameSchemaDraft(activeSchema?.name ?? "");
            setRenameSchemaOpen(true);
          }}
          onAddRelation={() => setAddRelationOpen(true)}
          onExportPng={() => exportCanvasPng()}
        />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setAiPanelOpen((v) => !v)}
            aria-pressed={aiPanelOpen}
            title={aiPanelOpen ? "Close AI assistant" : "Open AI assistant"}
            className={`group inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-all ${
              aiPanelOpen
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            }`}
          >
            <Sparkles
              className={`size-3.5 ${aiPanelOpen ? "text-primary" : "text-primary/80 group-hover:text-primary"}`}
            />
            <span className="hidden sm:inline">AI</span>
          </button>
          <UserMenu variant="compact" />
        </div>
      </header>

      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        <ResizablePanel
          panelRef={sidebarRef}
          defaultSize={isMobile ? 70 : isTablet ? 28 : 20}
          minSize={isMobile ? "50%" : "15%"}
          maxSize={isMobile ? "90%" : isTablet ? "45%" : "30%"}
          collapsible
          collapsedSize={0}
          onResize={(size) => setSidebarCollapsed(size.asPercentage === 0)}
        >
          <SchemaSidebar />
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={70} minSize={30}>
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel defaultSize={aiPanelOpen ? 70 : 100} minSize={40}>
              <ResizablePanelGroup orientation="vertical">
                <ResizablePanel defaultSize={65} minSize={30}>
                  <div className="flex h-full flex-col">
                    <CanvasHeader
                      onToggleSidebar={toggleSidebar}
                      sidebarCollapsed={sidebarCollapsed}
                    />
                    <div className="flex-1">
                      <SchemaCanvas />
                    </div>
                  </div>
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel
                  panelRef={sqlPanelRef}
                  defaultSize={35}
                  minSize={15}
                  collapsible
                  collapsedSize={0}
                  onResize={(size) =>
                    setSqlPanelCollapsed(size.asPercentage === 0)
                  }
                >
                  <SqlPreview />
                </ResizablePanel>
              </ResizablePanelGroup>
            </ResizablePanel>
            {aiPanelOpen && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel
                  panelRef={aiPanelRef}
                  defaultSize={isMobile ? 80 : isTablet ? 35 : 25}
                  minSize={isMobile ? "60%" : "20%"}
                  maxSize={isMobile ? "95%" : isTablet ? "55%" : "40%"}
                >
                  <AiChat onClose={() => setAiPanelOpen(false)} />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>

      <Dialog open={newSchemaOpen} onOpenChange={setNewSchemaOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New schema</DialogTitle>
            <DialogDescription>
              A schema is a canvas of tables and relations.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5 py-1">
            <Label htmlFor="new-schema-name" className="text-xs">
              Name
            </Label>
            <Input
              id="new-schema-name"
              autoFocus
              value={newSchemaName}
              onChange={(e) => setNewSchemaName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateSchema()}
              placeholder="e.g. v1, draft, production"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewSchemaOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateSchema}
              disabled={!newSchemaName.trim() || !activeProjectId}
            >
              Create schema
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Group multiple schemas under one project.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-1">
            <div className="grid gap-1.5">
              <Label htmlFor="new-project-name" className="text-xs">
                Name
              </Label>
              <Input
                id="new-project-name"
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCreateProject()}
                placeholder="e.g. Billing, CRM, Analytics"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-project-desc" className="text-xs">
                Description (optional)
              </Label>
              <Input
                id="new-project-desc"
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                placeholder="What is this project for?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProjectOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={!newProjectName.trim() || !activeWorkspaceId}
            >
              Create project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={newWorkspaceOpen} onOpenChange={setNewWorkspaceOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>New workspace</DialogTitle>
            <DialogDescription>
              Workspaces hold projects and schemas for different teams or apps.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5 py-1">
            <Label htmlFor="new-ws-name" className="text-xs">
              Name
            </Label>
            <Input
              id="new-ws-name"
              autoFocus
              value={newWorkspaceName}
              onChange={(e) => setNewWorkspaceName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateWorkspace()}
              placeholder="e.g. ACME Corp, Side Project"
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
              Create workspace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={renameSchemaOpen} onOpenChange={setRenameSchemaOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename schema</DialogTitle>
          </DialogHeader>
          <Input
            autoFocus
            value={renameSchemaDraft}
            onChange={(e) => setRenameSchemaDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRenameSchema()}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameSchemaOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleRenameSchema}
              disabled={!renameSchemaDraft.trim()}
            >
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AddRelationDialog
        open={addRelationOpen}
        onOpenChange={setAddRelationOpen}
      />
    </div>
  );
}
