"use client";

import { useState } from "react";
import { SchemaProvider } from "@/lib/schema-store";
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
  Database,
  PanelLeftClose,
  PanelLeft,
  PanelBottomClose,
  PanelBottomOpen,
  Image as ImageIcon,
  Sparkles,
} from "lucide-react";
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
      <Database className="size-4 text-indigo-600 dark:text-indigo-400" />
      <span className="text-sm font-bold tracking-tight">Super Schema</span>

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
      </div>
    </header>
  );
}

function CanvasHeader() {
  return (
    <div className="flex shrink-0 items-center border-b px-4 py-2">
      <div>
        <h1 className="text-sm font-semibold">Untitled Database</h1>
        <p className="text-xs text-muted-foreground">
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
    </SchemaProvider>
  );
}
