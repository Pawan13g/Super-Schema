"use client";

import { useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { SchemaProvider } from "@/lib/schema-store";
import { WorkspaceProvider } from "@/lib/workspace-context";
import { WorkspaceSwitcher } from "@/components/workspace/workspace-switcher";
import { SchemaCanvas } from "@/components/canvas/schema-canvas";
import { SchemaSidebar } from "@/components/sidebar/schema-sidebar";
import { SqlPreview } from "@/components/sql-panel/sql-preview";
import { AiChat } from "@/components/ai-panel/ai-chat";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  PanelLeftClose,
  PanelLeft,
  PanelBottomClose,
  PanelBottomOpen,
  Image as ImageIcon,
  Sparkles,
  LogOut,
  User as UserIcon,
} from "lucide-react";

function BrandLogo() {
  return (
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
  );
}
import { usePanelRef } from "react-resizable-panels";
import { exportCanvasPng } from "@/lib/export-utils";

function AppNavbar({
  sidebarCollapsed,
  onToggleSidebar,
  sqlPanelCollapsed,
  onToggleSqlPanel,
  aiPanelOpen,
  onToggleAiPanel,
}: {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  sqlPanelCollapsed: boolean;
  onToggleSqlPanel: () => void;
  aiPanelOpen: boolean;
  onToggleAiPanel: () => void;
}) {
  return (
    <header className="flex h-10 shrink-0 items-center gap-1 border-b bg-card px-3">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onToggleSidebar}
        title="Toggle sidebar"
      >
        {sidebarCollapsed ? (
          <PanelLeft className="size-4" />
        ) : (
          <PanelLeftClose className="size-4" />
        )}
      </Button>
      <BrandLogo />
      <span className="text-sm font-bold tracking-tight">Super Schema</span>

      <div className="mx-3 h-5 w-px bg-border" />
      <WorkspaceSwitcher />

      <nav className="ml-4 flex items-center gap-0.5">
        {["File", "Edit", "View", "Help"].map((item) => (
          <Button
            key={item}
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
          >
            {item}
          </Button>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-0.5">
        <Button
          variant={aiPanelOpen ? "secondary" : "ghost"}
          size="sm"
          onClick={onToggleAiPanel}
          title="AI Assistant"
          className="h-7 gap-1"
        >
          <Sparkles className="size-3.5" />
          <span className="text-xs">AI</span>
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => exportCanvasPng()}
          title="Export canvas as PNG"
        >
          <ImageIcon className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onToggleSqlPanel}
          title="Toggle SQL panel"
        >
          {sqlPanelCollapsed ? (
            <PanelBottomOpen className="size-4" />
          ) : (
            <PanelBottomClose className="size-4" />
          )}
        </Button>
        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}

function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  if (!session?.user) return null;

  const initials = (session.user.name ?? session.user.email ?? "?")
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex size-7 items-center justify-center rounded-full bg-violet-500/15 text-[10px] font-semibold text-violet-700 hover:bg-violet-500/25 dark:text-violet-300"
        title={session.user.email ?? "Account"}
      >
        {initials}
      </button>
      {open && (
        <>
          <button
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
            aria-label="close"
          />
          <div className="absolute right-0 top-9 z-20 min-w-[200px] rounded-md border bg-popover p-1 shadow-lg">
            <div className="px-2 py-1.5">
              <p className="truncate text-xs font-medium">
                {session.user.name ?? "Anonymous"}
              </p>
              <p className="truncate text-[10px] text-muted-foreground">
                {session.user.email}
              </p>
            </div>
            <div className="my-1 h-px bg-border" />
            <button
              disabled
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-muted-foreground"
            >
              <UserIcon className="size-3" />
              Account settings
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/sign-in" })}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-xs text-destructive hover:bg-destructive/10"
            >
              <LogOut className="size-3" />
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CanvasHeader() {
  return (
    <div className="flex shrink-0 items-center justify-between border-b bg-card/50 px-4 py-2.5">
      <div>
        <h1 className="text-sm font-semibold tracking-tight">
          Untitled Database
        </h1>
        <p className="text-[11px] text-muted-foreground">
          Schema design workspace
        </p>
      </div>
    </div>
  );
}

export default function Home() {
  const sidebarRef = usePanelRef();
  const sqlPanelRef = usePanelRef();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sqlPanelCollapsed, setSqlPanelCollapsed] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);

  const toggleSidebar = () => {
    const panel = sidebarRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
  };

  const toggleSqlPanel = () => {
    const panel = sqlPanelRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) {
      panel.expand();
    } else {
      panel.collapse();
    }
  };

  return (
    <SchemaProvider>
      <WorkspaceProvider>
      <div className="flex h-full w-full flex-1 flex-col">
        <AppNavbar
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={toggleSidebar}
          sqlPanelCollapsed={sqlPanelCollapsed}
          onToggleSqlPanel={toggleSqlPanel}
          aiPanelOpen={aiPanelOpen}
          onToggleAiPanel={() => setAiPanelOpen((v) => !v)}
        />
        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          <ResizablePanel
            panelRef={sidebarRef}
            defaultSize="25%"
            minSize="20%"
            maxSize="50%"
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
                      <CanvasHeader />
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
                  <ResizablePanel defaultSize="25%" minSize="20%" maxSize="50%">
                    <AiChat onClose={() => setAiPanelOpen(false)} />
                  </ResizablePanel>
                </>
              )}
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      </WorkspaceProvider>
    </SchemaProvider>
  );
}
