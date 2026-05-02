"use client";

import Link from "next/link";
import { useTheme } from "next-themes";
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarGroup,
  MenubarLabel,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubTrigger,
  MenubarSubContent,
  MenubarCheckboxItem,
} from "@/components/ui/menubar";
import { useSchema } from "@/lib/schema-store";
import { useWorkspace } from "@/lib/workspace-context";
import {
  Check,
  Copy,
  ExternalLink,
  FileArchive,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  GitCompare,
  Image as ImageIcon,
  LayoutDashboard,
  LayoutTemplate,
  Link2,
  Monitor,
  Moon,
  PanelBottom,
  PanelLeft,
  PanelRight,
  Plus,
  Settings,
  Share2,
  Sparkles,
  Sun,
  Table2,
  Trash2,
  BookOpen,
  Zap,
} from "lucide-react";

interface AppMenubarProps {
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  sqlPanelCollapsed: boolean;
  onToggleSqlPanel: () => void;
  aiPanelOpen: boolean;
  onToggleAiPanel: () => void;
  onNewSchema: () => void;
  onNewProject: () => void;
  onNewWorkspace: () => void;
  onRenameSchema: () => void;
  onAddRelation: () => void;
  onExportPng: () => void;
  onCompareSchemas: () => void;
  onOpenTemplates: () => void;
  onImportCsv: () => void;
  onDocGen: () => void;
  onIndexAdvisor: () => void;
  onShareSchema: () => void;
  onBulkExport: () => void;
}

export function AppMenubar({
  sidebarCollapsed,
  onToggleSidebar,
  sqlPanelCollapsed,
  onToggleSqlPanel,
  aiPanelOpen,
  onToggleAiPanel,
  onNewSchema,
  onNewProject,
  onNewWorkspace,
  onRenameSchema,
  onAddRelation,
  onExportPng,
  onCompareSchemas,
  onOpenTemplates,
  onImportCsv,
  onDocGen,
  onIndexAdvisor,
  onShareSchema,
  onBulkExport,
}: AppMenubarProps) {
  const { theme, setTheme } = useTheme();
  const {
    schema,
    selectedTableId,
    addTable,
    removeTable,
  } = useSchema();
  const {
    workspaces,
    activeWorkspaceId,
    switchWorkspace,
    projects,
    activeProjectId,
    switchProject,
    schemas,
    activeSchemaId,
    switchSchema,
    duplicateSchema,
    deleteSchema,
  } = useWorkspace();

  const activeSchema = schemas.find((s) => s.id === activeSchemaId);

  const handleAddTable = () => {
    addTable(`table_${schema.tables.length + 1}`);
  };

  const handleDeleteSelected = () => {
    if (selectedTableId) removeTable(selectedTableId);
  };

  const handleDuplicateSchema = () => {
    if (activeSchemaId) duplicateSchema(activeSchemaId);
  };

  const handleDeleteSchema = () => {
    if (
      activeSchemaId &&
      window.confirm(
        `Delete schema "${activeSchema?.name ?? ""}"? This cannot be undone.`
      )
    ) {
      deleteSchema(activeSchemaId);
    }
  };

  return (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>File</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={onNewSchema}>
            <FileText />
            New schema
            <MenubarShortcut>⌘N</MenubarShortcut>
          </MenubarItem>
          <MenubarItem onClick={onNewProject}>
            <FolderOpen />
            New project
          </MenubarItem>
          <MenubarItem onClick={onNewWorkspace}>
            <LayoutDashboard />
            New workspace
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={onOpenTemplates}>
            <LayoutTemplate />
            Templates library…
          </MenubarItem>
          <MenubarItem onClick={onImportCsv}>
            <FileSpreadsheet />
            Import CSV as table…
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem render={<Link href="/projects" />}>
            <LayoutDashboard />
            Projects dashboard
          </MenubarItem>
          <MenubarItem render={<Link href="/settings" />}>
            <Settings />
            Settings
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={onExportPng}>
            <ImageIcon />
            Export canvas as PNG
          </MenubarItem>
          <MenubarItem onClick={onBulkExport}>
            <FileArchive />
            Bulk export (.zip)
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>Edit</MenubarTrigger>
        <MenubarContent>
          <MenubarItem onClick={handleAddTable}>
            <Table2 />
            Add table
            <MenubarShortcut>⌘T</MenubarShortcut>
          </MenubarItem>
          <MenubarItem
            onClick={onAddRelation}
            disabled={schema.tables.length < 2}
          >
            <Link2 />
            Add relation…
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem
            destructive
            onClick={handleDeleteSelected}
            disabled={!selectedTableId}
          >
            <Trash2 />
            Delete selected table
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>View</MenubarTrigger>
        <MenubarContent>
          <MenubarCheckboxItem
            checked={!sidebarCollapsed}
            onCheckedChange={onToggleSidebar}
          >
            <PanelLeft />
            Sidebar
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={!sqlPanelCollapsed}
            onCheckedChange={onToggleSqlPanel}
          >
            <PanelBottom />
            SQL panel
          </MenubarCheckboxItem>
          <MenubarCheckboxItem
            checked={aiPanelOpen}
            onCheckedChange={onToggleAiPanel}
          >
            <PanelRight />
            AI assistant
          </MenubarCheckboxItem>
          <MenubarSeparator />
          <MenubarSub>
            <MenubarSubTrigger>
              {theme === "dark" ? (
                <Moon />
              ) : theme === "light" ? (
                <Sun />
              ) : (
                <Monitor />
              )}
              Theme
            </MenubarSubTrigger>
            <MenubarSubContent>
              <MenubarItem onClick={() => setTheme("light")}>
                <Sun />
                Light
                {theme === "light" ? <Check className="ml-auto size-3.5" /> : null}
              </MenubarItem>
              <MenubarItem onClick={() => setTheme("dark")}>
                <Moon />
                Dark
                {theme === "dark" ? <Check className="ml-auto size-3.5" /> : null}
              </MenubarItem>
              <MenubarItem onClick={() => setTheme("system")}>
                <Monitor />
                System
                {theme === "system" ? <Check className="ml-auto size-3.5" /> : null}
              </MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>Schema</MenubarTrigger>
        <MenubarContent>
          {activeSchema ? (
            <>
              <MenubarGroup>
                <MenubarLabel>{activeSchema.name}</MenubarLabel>
                <MenubarItem onClick={onRenameSchema}>
                  Rename schema…
                </MenubarItem>
                <MenubarItem onClick={handleDuplicateSchema}>
                  <Copy />
                  Duplicate schema
                </MenubarItem>
                <MenubarItem destructive onClick={handleDeleteSchema}>
                  <Trash2 />
                  Delete schema
                </MenubarItem>
              </MenubarGroup>
              <MenubarSeparator />
            </>
          ) : null}
          <MenubarItem onClick={onNewSchema}>
            <Plus />
            New schema
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={onDocGen}>
            <Sparkles />
            AI doc-gen…
          </MenubarItem>
          <MenubarItem onClick={onIndexAdvisor}>
            <Zap />
            Index advisor…
          </MenubarItem>
          <MenubarItem onClick={onShareSchema}>
            <Share2 />
            Share read-only…
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem onClick={onCompareSchemas}>
            <GitCompare />
            Compare schemas…
          </MenubarItem>
          {schemas.length > 0 ? (
            <>
              <MenubarSeparator />
              <MenubarSub>
                <MenubarSubTrigger>
                  <FileText />
                  Switch schema
                </MenubarSubTrigger>
                <MenubarSubContent>
                  {schemas.map((s) => (
                    <MenubarItem
                      key={s.id}
                      onClick={() => switchSchema(s.id)}
                      disabled={s.id === activeSchemaId}
                    >
                      {s.id === activeSchemaId ? <Check /> : <FileText />}
                      <span className="truncate">{s.name}</span>
                    </MenubarItem>
                  ))}
                </MenubarSubContent>
              </MenubarSub>
            </>
          ) : null}
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>Workspace</MenubarTrigger>
        <MenubarContent>
          <MenubarSub>
            <MenubarSubTrigger>
              <LayoutDashboard />
              Workspaces
            </MenubarSubTrigger>
            <MenubarSubContent>
              {workspaces.length === 0 ? (
                <MenubarItem disabled>No workspaces</MenubarItem>
              ) : (
                workspaces.map((w) => (
                  <MenubarItem
                    key={w.id}
                    onClick={() => switchWorkspace(w.id)}
                    disabled={w.id === activeWorkspaceId}
                  >
                    {w.id === activeWorkspaceId ? (
                      <Check />
                    ) : (
                      <LayoutDashboard />
                    )}
                    <span className="truncate">{w.name}</span>
                  </MenubarItem>
                ))
              )}
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSub>
            <MenubarSubTrigger>
              <FolderOpen />
              Projects
            </MenubarSubTrigger>
            <MenubarSubContent>
              {projects.length === 0 ? (
                <MenubarItem disabled>No projects</MenubarItem>
              ) : (
                projects.map((p) => (
                  <MenubarItem
                    key={p.id}
                    onClick={() => switchProject(p.id)}
                    disabled={p.id === activeProjectId}
                  >
                    {p.id === activeProjectId ? <Check /> : <FolderOpen />}
                    <span className="truncate">{p.name}</span>
                  </MenubarItem>
                ))
              )}
              <MenubarSeparator />
              <MenubarItem
                render={<Link href="/projects" />}
              >
                <ExternalLink />
                Open dashboard
              </MenubarItem>
            </MenubarSubContent>
          </MenubarSub>
          <MenubarSeparator />
          <MenubarItem onClick={onNewWorkspace}>
            <Plus />
            New workspace
          </MenubarItem>
          <MenubarItem onClick={onNewProject}>
            <Plus />
            New project
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>

      <MenubarMenu>
        <MenubarTrigger>Help</MenubarTrigger>
        <MenubarContent>
          <MenubarItem render={<Link href="/docs" />}>
            <BookOpen />
            Documentation
          </MenubarItem>
          <MenubarItem render={<Link href="/settings" />}>
            <Settings />
            Settings
          </MenubarItem>
          <MenubarSeparator />
          <MenubarItem render={<Link href="/terms" />}>
            Terms &amp; Conditions
          </MenubarItem>
          <MenubarItem render={<Link href="/privacy" />}>
            Privacy Policy
          </MenubarItem>
        </MenubarContent>
      </MenubarMenu>
    </Menubar>
  );
}
