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
import { useSchema } from "./schema-store";
import type { Schema } from "./types";

export interface WorkspaceMeta {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

type SaveStatus = "idle" | "saving" | "saved" | "error";

interface WorkspaceStore {
  workspaces: WorkspaceMeta[];
  activeWorkspaceId: string | null;
  loading: boolean;
  saveStatus: SaveStatus;
  switchWorkspace: (id: string) => Promise<void>;
  createWorkspace: (name: string) => Promise<WorkspaceMeta | null>;
  renameWorkspace: (id: string, name: string) => Promise<void>;
  deleteWorkspace: (id: string) => Promise<void>;
  refresh: () => Promise<WorkspaceMeta[] | undefined>;
}

const WorkspaceContext = createContext<WorkspaceStore | null>(null);
const ACTIVE_KEY = "super-schema:active-workspace";
const DEBOUNCE_MS = 1000;

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { schema, replaceSchema } = useSchema();

  const [workspaces, setWorkspaces] = useState<WorkspaceMeta[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  const lastSavedSchemaRef = useRef<string>("");
  const skipNextAutosaveRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/workspaces");
    if (!res.ok) return;
    const data = (await res.json()) as { workspaces: WorkspaceMeta[] };
    setWorkspaces(data.workspaces);
    return data.workspaces;
  }, []);

  const loadWorkspace = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/workspaces/${id}`);
      if (!res.ok) return;
      const data = (await res.json()) as {
        workspace: { id: string; schemaJson: Schema };
      };
      skipNextAutosaveRef.current = true;
      lastSavedSchemaRef.current = JSON.stringify(data.workspace.schemaJson);
      replaceSchema(data.workspace.schemaJson);
      setActiveWorkspaceId(id);
      if (typeof window !== "undefined") {
        localStorage.setItem(ACTIVE_KEY, id);
      }
    },
    [replaceSchema]
  );

  // Pick initial active workspace: localStorage → first → create default
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await refresh();
      if (cancelled || !list) return;

      let nextId: string | null = null;
      const saved =
        typeof window !== "undefined" ? localStorage.getItem(ACTIVE_KEY) : null;
      if (saved && list.some((w) => w.id === saved)) nextId = saved;
      else if (list[0]) nextId = list[0].id;

      if (!nextId) {
        const res = await fetch("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "My Workspace" }),
        });
        if (res.ok) {
          const created = (await res.json()) as { workspace: WorkspaceMeta };
          await refresh();
          nextId = created.workspace.id;
        }
      }

      if (nextId) await loadWorkspace(nextId);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, loadWorkspace]);

  const switchWorkspace = useCallback(
    async (id: string) => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      await loadWorkspace(id);
    },
    [loadWorkspace]
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
      await refresh();
      await loadWorkspace(data.workspace.id);
      return data.workspace;
    },
    [refresh, loadWorkspace]
  );

  const renameWorkspace = useCallback(
    async (id: string, name: string) => {
      const res = await fetch(`/api/workspaces/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) await refresh();
    },
    [refresh]
  );

  const deleteWorkspace = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/workspaces/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      const list = (await refresh()) ?? [];
      if (id === activeWorkspaceId) {
        const next = list[0]?.id;
        if (next) await loadWorkspace(next);
        else setActiveWorkspaceId(null);
      }
    },
    [refresh, activeWorkspaceId, loadWorkspace]
  );

  // Debounced auto-save on schema change
  useEffect(() => {
    if (!activeWorkspaceId) return;

    const serialized = JSON.stringify(schema);
    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      lastSavedSchemaRef.current = serialized;
      return;
    }
    if (serialized === lastSavedSchemaRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaveStatus("saving");
      try {
        const res = await fetch(`/api/workspaces/${activeWorkspaceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schemaJson: schema }),
        });
        if (res.ok) {
          lastSavedSchemaRef.current = serialized;
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 1500);
        } else {
          setSaveStatus("error");
        }
      } catch {
        setSaveStatus("error");
      }
    }, DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [schema, activeWorkspaceId]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        activeWorkspaceId,
        loading,
        saveStatus,
        switchWorkspace,
        createWorkspace,
        renameWorkspace,
        deleteWorkspace,
        refresh,
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
