"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderOpen,
  LayoutDashboard,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectSchemaNavProps {
  onOpenProjects?: () => void;
}

interface Anchor {
  left: number;
  top: number;
}

export function ProjectSchemaNav({ onOpenProjects }: ProjectSchemaNavProps = {}) {
  const {
    projects,
    activeProjectId,
    schemas,
    activeSchemaId,
    switchProject,
    switchSchema,
    createSchemaInProject,
    loading,
  } = useWorkspace();

  const [projectOpen, setProjectOpen] = useState(false);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const [newSchemaMode, setNewSchemaMode] = useState(false);
  const [newSchemaName, setNewSchemaName] = useState("");
  const projectBtnRef = useRef<HTMLButtonElement>(null);
  const schemaBtnRef = useRef<HTMLButtonElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const schemaMenuRef = useRef<HTMLDivElement>(null);
  const [projectAnchor, setProjectAnchor] = useState<Anchor | null>(null);
  const [schemaAnchor, setSchemaAnchor] = useState<Anchor | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const activeSchema = schemas.find((s) => s.id === activeSchemaId);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        projectBtnRef.current?.contains(t) === false &&
        projectMenuRef.current?.contains(t) === false
      ) {
        setProjectOpen(false);
      }
      if (
        schemaBtnRef.current?.contains(t) === false &&
        schemaMenuRef.current?.contains(t) === false
      ) {
        setSchemaOpen(false);
        setNewSchemaMode(false);
        setNewSchemaName("");
      }
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  // Recompute anchors on resize / scroll while a menu is open.
  useEffect(() => {
    if (!projectOpen && !schemaOpen) return;
    const update = () => {
      if (projectOpen && projectBtnRef.current) {
        const r = projectBtnRef.current.getBoundingClientRect();
        setProjectAnchor({ left: r.left, top: r.bottom + 4 });
      }
      if (schemaOpen && schemaBtnRef.current) {
        const r = schemaBtnRef.current.getBoundingClientRect();
        setSchemaAnchor({ left: r.left, top: r.bottom + 4 });
      }
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [projectOpen, schemaOpen]);

  const openProjectMenu = () => {
    if (projectBtnRef.current) {
      const r = projectBtnRef.current.getBoundingClientRect();
      setProjectAnchor({ left: r.left, top: r.bottom + 4 });
    }
    setProjectOpen((v) => !v);
    setSchemaOpen(false);
  };

  const openSchemaMenu = () => {
    if (schemaBtnRef.current) {
      const r = schemaBtnRef.current.getBoundingClientRect();
      setSchemaAnchor({ left: r.left, top: r.bottom + 4 });
    }
    setSchemaOpen((v) => !v);
    setProjectOpen(false);
  };

  const handleCreateSchema = async () => {
    const name = newSchemaName.trim();
    if (!name) return;
    await createSchemaInProject(name);
    setNewSchemaName("");
    setNewSchemaMode(false);
    setSchemaOpen(false);
  };

  return (
    <div className="flex items-center gap-0">
      <ChevronRight className="size-3.5 text-muted-foreground/50" />

      <button
        ref={projectBtnRef}
        type="button"
        onClick={openProjectMenu}
        className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-sm hover:bg-accent"
      >
        <FolderOpen className="size-3.5 shrink-0 text-blue-500" />
        <span className="max-w-[130px] truncate font-medium">
          {loading && !activeProject ? (
            <span className="inline-block h-3 w-16 animate-pulse rounded bg-muted" />
          ) : (
            activeProject?.name ?? "Project"
          )}
        </span>
        <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
      </button>

      <ChevronRight className="size-3.5 text-muted-foreground/50" />

      <button
        ref={schemaBtnRef}
        type="button"
        onClick={openSchemaMenu}
        disabled={!activeProjectId}
        className="flex h-7 items-center gap-1.5 rounded-lg px-2 text-sm hover:bg-accent disabled:opacity-50"
      >
        <FileText className="size-3.5 shrink-0 text-emerald-500" />
        <span className="max-w-[130px] truncate font-medium">
          {loading && !activeSchema ? (
            <span className="inline-block h-3 w-16 animate-pulse rounded bg-muted" />
          ) : (
            activeSchema?.name ?? "Schema"
          )}
        </span>
        <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
      </button>

      {mounted && projectOpen && projectAnchor &&
        createPortal(
          <div
            ref={projectMenuRef}
            style={{ position: "fixed", left: projectAnchor.left, top: projectAnchor.top }}
            className="z-[100] min-w-[220px] rounded-xl border bg-popover p-1.5 shadow-xl"
          >
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Switch project
            </p>
            <div className="max-h-[240px] overflow-y-auto">
              {projects.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No projects.</p>
              )}
              {projects.map((p) => {
                const isActive = p.id === activeProjectId;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      if (!isActive) switchProject(p.id);
                      setProjectOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                      isActive ? "bg-accent font-medium" : "hover:bg-accent/60"
                    )}
                  >
                    {isActive ? (
                      <Check className="size-3.5 shrink-0 text-primary" />
                    ) : (
                      <FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{p.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="my-1.5 h-px bg-border" />
            <button
              type="button"
              onClick={() => {
                setProjectOpen(false);
                onOpenProjects?.();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <LayoutDashboard className="size-3.5" />
              Manage projects
            </button>
          </div>,
          document.body
        )}

      {mounted && schemaOpen && schemaAnchor &&
        createPortal(
          <div
            ref={schemaMenuRef}
            style={{ position: "fixed", left: schemaAnchor.left, top: schemaAnchor.top }}
            className="z-[100] min-w-[220px] rounded-xl border bg-popover p-1.5 shadow-xl"
          >
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Switch schema
            </p>
            <div className="max-h-[240px] overflow-y-auto">
              {schemas.length === 0 && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">No schemas.</p>
              )}
              {schemas.map((s) => {
                const isActive = s.id === activeSchemaId;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      if (!isActive) switchSchema(s.id);
                      setSchemaOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm",
                      isActive ? "bg-accent font-medium" : "hover:bg-accent/60"
                    )}
                  >
                    {isActive ? (
                      <Check className="size-3.5 shrink-0 text-primary" />
                    ) : (
                      <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                    )}
                    <span className="truncate">{s.name}</span>
                  </button>
                );
              })}
            </div>
            <div className="my-1.5 h-px bg-border" />
            {newSchemaMode ? (
              <div className="flex gap-1.5 px-1">
                <Input
                  autoFocus
                  value={newSchemaName}
                  onChange={(e) => setNewSchemaName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateSchema();
                    if (e.key === "Escape") {
                      setNewSchemaMode(false);
                      setNewSchemaName("");
                    }
                  }}
                  placeholder="Schema name"
                  className="h-7 flex-1 text-xs"
                />
                <Button
                  size="sm"
                  className="h-7 px-2.5"
                  onClick={handleCreateSchema}
                  disabled={!newSchemaName.trim()}
                >
                  Add
                </Button>
              </div>
            ) : (
              <button
                onClick={() => setNewSchemaMode(true)}
                disabled={!activeProjectId}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-primary hover:bg-accent"
              >
                <Plus className="size-3.5" />
                New schema
              </button>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
