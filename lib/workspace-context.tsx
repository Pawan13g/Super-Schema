"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useSchema } from "./schema-store";
import type { Schema } from "./types";

export interface WorkspaceMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  _count?: { projects: number };
}

export interface ProjectMeta {
  id: string;
  name: string;
  description: string | null;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
  _count?: { schemas: number };
}

export interface SchemaMeta {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface WorkspaceStore {
  workspaces: WorkspaceMeta[];
  activeWorkspaceId: string | null;
  projects: ProjectMeta[];
  activeProjectId: string | null;
  schemas: SchemaMeta[];
  activeSchemaId: string | null;
  loading: boolean;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;

  switchWorkspace: (id: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<WorkspaceMeta | null>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;

  switchProject: (id: string) => Promise<void>;
  createProject: (name: string, description?: string) => Promise<ProjectMeta | null>;
  renameProject: (id: string, name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  switchSchema: (id: string) => Promise<void>;
  createSchemaInProject: (name: string) => Promise<SchemaMeta | null>;
  renameSchema: (id: string, name: string) => Promise<void>;
  deleteSchema: (id: string) => Promise<void>;
  duplicateSchema: (id: string) => Promise<SchemaMeta | null>;

  refreshWorkspaces: () => Promise<WorkspaceMeta[] | undefined>;
  refreshProjects: (workspaceId: string) => Promise<ProjectMeta[] | undefined>;
  refreshSchemas: (projectId: string) => Promise<SchemaMeta[] | undefined>;
  saveNow: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceStore | null>(null);
const ACTIVE_WORKSPACE_KEY = "super-schema:active-workspace";
const ACTIVE_PROJECT_KEY = "super-schema:active-project";
const ACTIVE_SCHEMA_KEY = "super-schema:active-schema";
const DEBOUNCE_MS = 1000;

function projectKey(workspaceId: string) {
  return `${ACTIVE_PROJECT_KEY}:${workspaceId}`;
}
function schemaKey(projectId: string) {
  return `${ACTIVE_SCHEMA_KEY}:${projectId}`;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { schema, replaceSchema } = useSchema();

  const [workspaces, setWorkspaces] = useState<WorkspaceMeta[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [schemas, setSchemas] = useState<SchemaMeta[]>([]);
  const [activeSchemaId, setActiveSchemaId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const lastSavedSchemaRef = useRef<string>("");
  const skipNextAutosaveRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Token bumps on every save start AND every active-schema/project/workspace
  // switch. A stale save resolution checks its token and bails instead of
  // applying state to whatever schema is now active.
  const saveTokenRef = useRef(0);
  // Always-current active schema id, readable inside async closures.
  const activeSchemaIdRef = useRef<string | null>(null);
  // Server-side schema version we last loaded. Sent as `expectedVersion` on
  // PATCH so two tabs can detect concurrent edits.
  const loadedVersionRef = useRef<number | null>(null);
  // Promise of the currently-running save (for the active schema). Subsequent
  // saves await it before starting so they read the post-save version and
  // never double-send the same expectedVersion (which would 409).
  const saveInFlightRef = useRef<Promise<unknown> | null>(null);

  const refreshWorkspaces = useCallback(async () => {
    const res = await fetch("/api/workspaces");
    if (!res.ok) return;
    const data = (await res.json()) as { workspaces: WorkspaceMeta[] };
    setWorkspaces(data.workspaces);
    return data.workspaces;
  }, []);

  const refreshProjects = useCallback(async (workspaceId: string) => {
    const res = await fetch(`/api/projects?workspaceId=${workspaceId}`);
    if (!res.ok) return;
    const data = (await res.json()) as { projects: ProjectMeta[] };
    setProjects(data.projects);
    return data.projects;
  }, []);

  const refreshSchemas = useCallback(async (projectId: string) => {
    const res = await fetch(`/api/projects/${projectId}/schemas`);
    if (!res.ok) return;
    const data = (await res.json()) as { schemas: SchemaMeta[] };
    setSchemas(data.schemas);
    return data.schemas;
  }, []);

  const loadSchemaIntoCanvas = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/schemas/${id}`);
      if (!res.ok) return false;
      const data = (await res.json()) as {
        schema: { id: string; schemaJson: Schema; version?: number };
      };
      skipNextAutosaveRef.current = true;
      lastSavedSchemaRef.current = JSON.stringify(data.schema.schemaJson);
      loadedVersionRef.current = data.schema.version ?? null;
      replaceSchema(data.schema.schemaJson);
      setActiveSchemaId(id);
      activeSchemaIdRef.current = id;
      // Any in-flight save is for the previous schema — invalidate it.
      saveTokenRef.current += 1;
      return true;
    },
    [replaceSchema]
  );

  // Bootstrap: load workspaces -> active workspace -> projects -> active project -> schemas -> active schema
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const wsList = await refreshWorkspaces();
      if (cancelled || !wsList) {
        setLoading(false);
        return;
      }

      // Pick or create workspace
      let wsId: string | null = null;
      const savedWs =
        typeof window !== "undefined"
          ? localStorage.getItem(ACTIVE_WORKSPACE_KEY)
          : null;
      if (savedWs && wsList.some((w) => w.id === savedWs)) wsId = savedWs;
      else if (wsList[0]) wsId = wsList[0].id;

      if (!wsId) {
        const res = await fetch("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "My Workspace" }),
        });
        if (res.ok) {
          const created = (await res.json()) as { workspace: WorkspaceMeta };
          await refreshWorkspaces();
          wsId = created.workspace.id;
        }
      }
      if (cancelled || !wsId) {
        setLoading(false);
        return;
      }
      setActiveWorkspaceId(wsId);
      if (typeof window !== "undefined") {
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, wsId);
      }

      // Projects
      const projList = await refreshProjects(wsId);
      if (cancelled || !projList) {
        setLoading(false);
        return;
      }
      let prjId: string | null = null;
      const savedPrj =
        typeof window !== "undefined" ? localStorage.getItem(projectKey(wsId)) : null;
      if (savedPrj && projList.some((p) => p.id === savedPrj)) prjId = savedPrj;
      else if (projList[0]) prjId = projList[0].id;

      if (!prjId) {
        // No projects in workspace — create a default
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId: wsId, name: "Default Project" }),
        });
        if (res.ok) {
          const created = (await res.json()) as { project: ProjectMeta };
          await refreshProjects(wsId);
          prjId = created.project.id;
        }
      }
      if (cancelled || !prjId) {
        setLoading(false);
        return;
      }
      setActiveProjectId(prjId);
      if (typeof window !== "undefined") {
        localStorage.setItem(projectKey(wsId), prjId);
      }

      // Schemas
      const schList = await refreshSchemas(prjId);
      if (cancelled || !schList) {
        setLoading(false);
        return;
      }
      let schId: string | null = null;
      const savedSch =
        typeof window !== "undefined" ? localStorage.getItem(schemaKey(prjId)) : null;
      if (savedSch && schList.some((s) => s.id === savedSch)) schId = savedSch;
      else if (schList[0]) schId = schList[0].id;

      if (!schId) {
        const res = await fetch(`/api/projects/${prjId}/schemas`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Main Schema" }),
        });
        if (res.ok) {
          const created = (await res.json()) as { schema: SchemaMeta };
          await refreshSchemas(prjId);
          schId = created.schema.id;
        }
      }
      if (cancelled || !schId) {
        setLoading(false);
        return;
      }

      await loadSchemaIntoCanvas(schId);
      if (typeof window !== "undefined") {
        localStorage.setItem(schemaKey(prjId), schId);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshWorkspaces, refreshProjects, refreshSchemas, loadSchemaIntoCanvas]);

  // Cancel pending saves when active schema changes
  const cancelPendingSave = () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    // Invalidate any save that's already in flight too.
    saveTokenRef.current += 1;
  };

  const switchSchema = useCallback(
    async (id: string) => {
      cancelPendingSave();
      await loadSchemaIntoCanvas(id);
      if (activeProjectId && typeof window !== "undefined") {
        localStorage.setItem(schemaKey(activeProjectId), id);
      }
    },
    [loadSchemaIntoCanvas, activeProjectId]
  );

  const switchProject = useCallback(
    async (id: string) => {
      cancelPendingSave();
      setActiveProjectId(id);
      if (activeWorkspaceId && typeof window !== "undefined") {
        localStorage.setItem(projectKey(activeWorkspaceId), id);
      }
      const list = await refreshSchemas(id);
      if (!list) return;

      const savedSch =
        typeof window !== "undefined" ? localStorage.getItem(schemaKey(id)) : null;
      const next =
        (savedSch && list.find((s) => s.id === savedSch)?.id) ?? list[0]?.id ?? null;
      if (next) {
        await loadSchemaIntoCanvas(next);
        if (typeof window !== "undefined") localStorage.setItem(schemaKey(id), next);
      } else {
        setActiveSchemaId(null);
        replaceSchema({ tables: [], relations: [] });
      }
    },
    [refreshSchemas, loadSchemaIntoCanvas, activeWorkspaceId, replaceSchema]
  );

  const switchWorkspace = useCallback(
    async (id: string) => {
      cancelPendingSave();
      setActiveWorkspaceId(id);
      if (typeof window !== "undefined") {
        localStorage.setItem(ACTIVE_WORKSPACE_KEY, id);
      }
      const list = await refreshProjects(id);
      if (!list) return;

      const savedPrj =
        typeof window !== "undefined" ? localStorage.getItem(projectKey(id)) : null;
      const nextProject =
        (savedPrj && list.find((p) => p.id === savedPrj)?.id) ?? list[0]?.id ?? null;
      if (nextProject) {
        await switchProject(nextProject);
      } else {
        setActiveProjectId(null);
        setSchemas([]);
        setActiveSchemaId(null);
        replaceSchema({ tables: [], relations: [] });
      }
    },
    [refreshProjects, switchProject, replaceSchema]
  );

  const createWorkspace = useCallback(
    async (name: string): Promise<WorkspaceMeta | null> => {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { workspace: WorkspaceMeta };
      await refreshWorkspaces();
      await switchWorkspace(data.workspace.id);
      return data.workspace;
    },
    [refreshWorkspaces, switchWorkspace]
  );

  const renameWorkspace = useCallback(
    async (id: string, name: string) => {
      const res = await fetch(`/api/workspaces/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) await refreshWorkspaces();
    },
    [refreshWorkspaces]
  );

  const deleteWorkspace = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/workspaces/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      const list = (await refreshWorkspaces()) ?? [];
      if (id === activeWorkspaceId) {
        const next = list[0]?.id;
        if (next) await switchWorkspace(next);
        else {
          setActiveWorkspaceId(null);
          setProjects([]);
          setActiveProjectId(null);
          setSchemas([]);
          setActiveSchemaId(null);
          replaceSchema({ tables: [], relations: [] });
        }
      }
    },
    [refreshWorkspaces, activeWorkspaceId, switchWorkspace, replaceSchema]
  );

  const createProject = useCallback(
    async (name: string, description?: string): Promise<ProjectMeta | null> => {
      if (!activeWorkspaceId) return null;
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: activeWorkspaceId,
          name,
          description,
        }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { project: ProjectMeta };
      await refreshProjects(activeWorkspaceId);
      await switchProject(data.project.id);
      return data.project;
    },
    [activeWorkspaceId, refreshProjects, switchProject]
  );

  const renameProject = useCallback(
    async (id: string, name: string) => {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok && activeWorkspaceId) await refreshProjects(activeWorkspaceId);
    },
    [refreshProjects, activeWorkspaceId]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      if (!activeWorkspaceId) return;
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      const list = (await refreshProjects(activeWorkspaceId)) ?? [];
      if (id === activeProjectId) {
        const next = list[0]?.id;
        if (next) await switchProject(next);
        else {
          setActiveProjectId(null);
          setSchemas([]);
          setActiveSchemaId(null);
          replaceSchema({ tables: [], relations: [] });
        }
      }
    },
    [
      refreshProjects,
      activeWorkspaceId,
      activeProjectId,
      switchProject,
      replaceSchema,
    ]
  );

  const createSchemaInProject = useCallback(
    async (name: string): Promise<SchemaMeta | null> => {
      if (!activeProjectId) return null;
      const res = await fetch(`/api/projects/${activeProjectId}/schemas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { schema: SchemaMeta };
      await refreshSchemas(activeProjectId);
      await switchSchema(data.schema.id);
      return data.schema;
    },
    [activeProjectId, refreshSchemas, switchSchema]
  );

  const renameSchema = useCallback(
    async (id: string, name: string) => {
      const res = await fetch(`/api/schemas/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok && activeProjectId) await refreshSchemas(activeProjectId);
    },
    [refreshSchemas, activeProjectId]
  );

  const deleteSchema = useCallback(
    async (id: string) => {
      if (!activeProjectId) return;
      const res = await fetch(`/api/schemas/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      const list = (await refreshSchemas(activeProjectId)) ?? [];
      if (id === activeSchemaId) {
        const next = list[0]?.id;
        if (next) await switchSchema(next);
        else {
          setActiveSchemaId(null);
          replaceSchema({ tables: [], relations: [] });
        }
      }
    },
    [
      refreshSchemas,
      activeProjectId,
      activeSchemaId,
      switchSchema,
      replaceSchema,
    ]
  );

  const duplicateSchema = useCallback(
    async (id: string): Promise<SchemaMeta | null> => {
      const res = await fetch(`/api/schemas/${id}/duplicate`, { method: "POST" });
      if (!res.ok) return null;
      const data = (await res.json()) as { schema: SchemaMeta };
      if (activeProjectId) await refreshSchemas(activeProjectId);
      return data.schema;
    },
    [refreshSchemas, activeProjectId]
  );

  // Keep the ref in sync with state so async save closures can read the
  // *current* active schema id without staleness.
  useEffect(() => {
    activeSchemaIdRef.current = activeSchemaId;
  }, [activeSchemaId]);

  // Tracks last-saved time so the UI can show "saved 3s ago".
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

  // Strictly serialized PATCH path. Each call enqueues itself onto the chain
  // BEFORE awaiting prior in-flight, so two near-simultaneous calls don't
  // both await the same root promise and then race past each other (which
  // would 409 the second). The ref is updated synchronously to the new tail.
  // On 409 we adopt the server's currentVersion and silently retry once,
  // since most 409s in single-tab use are version-bookkeeping drift, not a
  // genuine cross-tab conflict.
  const performSave = useCallback(
    (
      targetSchemaId: string,
      payloadSchema: Schema,
      opts: { interactive?: boolean } = {}
    ): Promise<boolean> => {
      const prior = saveInFlightRef.current ?? Promise.resolve();

      const sendOnce = async (
        attempt: number
      ): Promise<{ ok: boolean; conflict: boolean }> => {
        const expectedVersion = loadedVersionRef.current;
        const res = await fetch(`/api/schemas/${targetSchemaId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            schemaJson: payloadSchema,
            ...(expectedVersion !== null ? { expectedVersion } : {}),
          }),
        });

        if (activeSchemaIdRef.current !== targetSchemaId) {
          return { ok: false, conflict: false };
        }

        if (res.status === 409) {
          // Server tells us its current version — adopt it and retry once.
          try {
            const data = (await res.json()) as {
              currentVersion?: number | null;
            };
            if (typeof data.currentVersion === "number") {
              loadedVersionRef.current = data.currentVersion;
            }
          } catch {
            /* fall through */
          }
          if (attempt === 0) {
            return await sendOnce(1);
          }
          return { ok: false, conflict: true };
        }

        if (!res.ok) {
          return { ok: false, conflict: false };
        }

        // Success — read the new version off the response.
        try {
          const data = (await res.json()) as {
            schema?: { version?: number };
          };
          if (typeof data.schema?.version === "number") {
            loadedVersionRef.current = data.schema.version;
          } else if (loadedVersionRef.current !== null) {
            loadedVersionRef.current += 1;
          }
        } catch {
          if (loadedVersionRef.current !== null) {
            loadedVersionRef.current += 1;
          }
        }
        return { ok: true, conflict: false };
      };

      const run: Promise<boolean> = (async () => {
        try {
          await prior;
        } catch {
          /* prior save errored — proceed */
        }

        if (activeSchemaIdRef.current !== targetSchemaId) return false;

        const serialized = JSON.stringify(payloadSchema);
        if (serialized === lastSavedSchemaRef.current) {
          if (opts.interactive) toast.success("Already saved");
          return true;
        }

        const myToken = ++saveTokenRef.current;
        setSaveStatus("saving");

        try {
          const result = await sendOnce(0);

          if (activeSchemaIdRef.current !== targetSchemaId) return false;

          if (result.conflict) {
            // Genuine conflict (retry already failed). Reload server state.
            setSaveStatus("error");
            if (opts.interactive) {
              toast.error(
                "This schema was edited in another tab. Reloading the latest version…"
              );
            }
            await loadSchemaIntoCanvas(targetSchemaId);
            return false;
          }

          if (result.ok) {
            lastSavedSchemaRef.current = serialized;
            setSaveStatus("saved");
            setLastSavedAt(Date.now());
            if (opts.interactive) toast.success("Saved");
            setTimeout(() => {
              if (myToken === saveTokenRef.current) setSaveStatus("idle");
            }, 2500);
            return true;
          }

          setSaveStatus("error");
          if (opts.interactive) toast.error("Save failed");
          return false;
        } catch (err) {
          setSaveStatus("error");
          if (opts.interactive) {
            toast.error(err instanceof Error ? err.message : "Save failed");
          }
          return false;
        }
      })();

      saveInFlightRef.current = run.finally(() => {
        if (saveInFlightRef.current === run) saveInFlightRef.current = null;
      });
      return run;
    },
    [loadSchemaIntoCanvas]
  );

  // Debounced auto-save on schema change → save to active schema
  useEffect(() => {
    if (!activeSchemaId) return;

    const serialized = JSON.stringify(schema);
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      lastSavedSchemaRef.current = serialized;
      return;
    }
    // Dedupe: skip writes when the canvas is byte-identical to last save.
    if (serialized === lastSavedSchemaRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    const targetSchemaId = activeSchemaId;
    saveTimerRef.current = setTimeout(() => {
      if (activeSchemaIdRef.current !== targetSchemaId) return;
      void performSave(targetSchemaId, schema);
    }, DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [schema, activeSchemaId, performSave]);

  // Force-flush any pending debounced save and PATCH the current schema
  // immediately. Used by the Ctrl/Cmd+S keyboard shortcut.
  const saveNow = useCallback(async () => {
    const targetSchemaId = activeSchemaIdRef.current;
    if (!targetSchemaId) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    await performSave(targetSchemaId, schema, { interactive: true });
  }, [schema, performSave]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspaceId,
        projects,
        activeProjectId,
        schemas,
        activeSchemaId,
        loading,
        saveStatus,
        lastSavedAt,
        switchWorkspace,
        createWorkspace,
        renameWorkspace,
        deleteWorkspace,
        switchProject,
        createProject,
        renameProject,
        deleteProject,
        switchSchema,
        createSchemaInProject,
        renameSchema,
        deleteSchema,
        duplicateSchema,
        refreshWorkspaces,
        refreshProjects,
        refreshSchemas,
        saveNow,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be inside WorkspaceProvider");
  return ctx;
}
