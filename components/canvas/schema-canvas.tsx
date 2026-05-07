"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/components/theme-provider";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  ControlButton,
  MiniMap,
  applyNodeChanges,
  ConnectionMode,
  type Node,
  type Edge,
  type OnNodesChange,
  type Connection,
  type OnNodeDrag,
  type ReactFlowInstance,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useSchema } from "@/lib/schema-store";
import { useWorkspace } from "@/lib/workspace-context";
import { useIsMobile } from "@/lib/use-media-query";
import { isMod, isTypingTarget } from "@/lib/shortcuts";
import { computeAutoLayout } from "@/lib/auto-layout";
import type { Table, ColumnType } from "@/lib/types";

// Column type compatibility for FK creation. Two columns can join if they
// fall in the same equivalence class (numeric / text / date / json / etc.).
// Strict identity is too brittle (`INT` vs `BIGINT` is a fine FK) and
// "anything goes" is a footgun. Returns true when the relationship is
// semantically reasonable; the canvas blocks the drag otherwise.
const TYPE_FAMILIES: Partial<Record<ColumnType, "numeric" | "text" | "date" | "uuid" | "blob" | "json" | "boolean">> = {
  INT: "numeric",
  BIGINT: "numeric",
  SMALLINT: "numeric",
  SERIAL: "numeric",
  FLOAT: "numeric",
  DOUBLE: "numeric",
  DECIMAL: "numeric",
  BOOLEAN: "boolean",
  VARCHAR: "text",
  TEXT: "text",
  CHAR: "text",
  DATE: "date",
  TIMESTAMP: "date",
  DATETIME: "date",
  TIME: "date",
  JSON: "json",
  UUID: "uuid",
  BLOB: "blob",
};
function areTypesCompatible(a: ColumnType, b: ColumnType): boolean {
  if (a === b) return true;
  const fa = TYPE_FAMILIES[a];
  const fb = TYPE_FAMILIES[b];
  if (!fa || !fb) return true; // unknown — don't block.
  return fa === fb;
}
import { TableNode } from "./table-node";
import {
  ContextMenu,
  type ContextMenuItem,
} from "@/components/ui/context-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AddRelationDialog } from "./add-relation-dialog";
import { RelationTypeDialog } from "./relation-type-dialog";
import { Tip } from "@/components/ui/tip";
import { TableConfigDialog } from "@/components/workspace/table-config-dialog";
import { Loader } from "@/components/ui/loader";
import {
  Pencil,
  Plus,
  Trash2,
  Copy,
  Link2,
  ArrowRightLeft,
  Eye,
  LayoutGrid,
  Lock,
  LockOpen,
  Maximize2,
  Minus,
  Settings,
  Undo2,
  Redo2,
} from "lucide-react";
import type { Relation } from "@/lib/types";

const nodeTypes = { tableNode: TableNode };

type MenuState =
  | { kind: "node"; x: number; y: number; nodeId: string }
  | { kind: "edge"; x: number; y: number; edgeId: string }
  | { kind: "pane"; x: number; y: number }
  | null;

type ConfirmState =
  | { kind: "delete-table"; tableId: string }
  | { kind: "delete-relation"; relationId: string }
  | { kind: "delete-many"; tableIds: string[] }
  | null;

export function SchemaCanvas() {
  const {
    schema,
    selectedTableId,
    setSelectedTableId,
    updateTablePosition,
    setTablePositions,
    updateTableName,
    updateColumn,
    addRelation,
    updateRelation,
    addTable,
    addColumn,
    removeTable,
    removeTables,
    removeRelation,
    createJunctionTable,
    duplicateTable,
    insertTable,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useSchema();
  const {
    saveNow,
    loading: workspaceLoading,
    activeSchemaId,
  } = useWorkspace();

  // Per-schema viewport (zoom + pan) persisted in localStorage so switching
  // tabs and coming back lands the user where they were. Keyed by schema id.
  const VIEWPORT_KEY = (id: string) => `super-schema:viewport:${id}`;
  const lastSavedSchemaRef = useRef<string | null>(null);
  const restoredForSchemaRef = useRef<string | null>(null);
  const viewportSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  // Writes the current React Flow viewport to localStorage. RF fires
  // `onMoveEnd` *per intent* (each pinch / pan gesture, each scroll burst)
  // — on a fast trackpad that's dozens of writes a second. Coalesce them
  // through a 250 ms debounce so we hit storage at most ~4× / second
  // during continuous panning.
  const saveViewport = useCallback(() => {
    if (typeof window === "undefined") return;
    if (viewportSaveTimerRef.current) {
      clearTimeout(viewportSaveTimerRef.current);
    }
    viewportSaveTimerRef.current = setTimeout(() => {
      viewportSaveTimerRef.current = null;
      const inst = reactFlowInstanceRef.current;
      const id = activeSchemaId;
      if (!inst || !id) return;
      try {
        const v = inst.getViewport();
        window.localStorage.setItem(VIEWPORT_KEY(id), JSON.stringify(v));
      } catch {
        /* quota / disabled — ignore */
      }
    }, 250);
  }, [activeSchemaId]);

  // On unmount, clear the debounce so we don't fire against a torn-down
  // tree. The "save before schema flips" effect below handles the case
  // where we genuinely *do* want a synchronous save (it bypasses the
  // debounce by reading getViewport directly).
  useEffect(
    () => () => {
      if (viewportSaveTimerRef.current) {
        clearTimeout(viewportSaveTimerRef.current);
        viewportSaveTimerRef.current = null;
      }
    },
    []
  );

  const restoreViewport = useCallback((id: string) => {
    const inst = reactFlowInstanceRef.current;
    if (!inst || typeof window === "undefined") return false;
    try {
      const raw = window.localStorage.getItem(VIEWPORT_KEY(id));
      if (!raw) return false;
      const v = JSON.parse(raw) as { x: number; y: number; zoom: number };
      if (
        typeof v?.x !== "number" ||
        typeof v?.y !== "number" ||
        typeof v?.zoom !== "number"
      ) {
        return false;
      }
      inst.setViewport(v, { duration: 0 });
      return true;
    } catch {
      return false;
    }
  }, []);

  // Save current viewport before the active schema flips so we don't lose it
  // when the next schema loads and overwrites the canvas. Then restore the
  // new schema's saved viewport (if any) once nodes have re-synced.
  useEffect(() => {
    if (
      lastSavedSchemaRef.current &&
      lastSavedSchemaRef.current !== activeSchemaId
    ) {
      const prevId = lastSavedSchemaRef.current;
      const inst = reactFlowInstanceRef.current;
      if (inst && typeof window !== "undefined") {
        try {
          const v = inst.getViewport();
          window.localStorage.setItem(VIEWPORT_KEY(prevId), JSON.stringify(v));
        } catch {
          /* ignore */
        }
      }
    }
    lastSavedSchemaRef.current = activeSchemaId ?? null;
    // Try to restore the new schema's viewport. The fitView in onInit /
    // sync may have already run; setViewport with duration:0 overrides it.
    if (activeSchemaId) {
      const id = activeSchemaId;
      // Two rAFs: one for React commit, one for RF measurement.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          restoreViewport(id);
        });
      });
    }
  }, [activeSchemaId, restoreViewport]);

  const { resolvedTheme } = useTheme();
  const isMobile = useIsMobile();
  // Avoid hydration mismatch: only compute theme-aware mode after client mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const colorMode = mounted && resolvedTheme === "dark" ? "dark" : "light";

  const [nodes, setNodes] = useState<Node[]>([]);
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // Defer schema → RF sync while a drag is in flight so we don't recreate
  // node objects mid-drag and lose the drag delta.
  const draggingRef = useRef(false);
  const pendingSyncRef = useRef(false);
  // Always-current selectedTableId — keyboard handler reads via ref to
  // avoid stale closures.
  const selectedTableIdRef = useRef(selectedTableId);
  useEffect(() => {
    selectedTableIdRef.current = selectedTableId;
  }, [selectedTableId]);
  // In-memory clipboard for Ctrl/Cmd+C → Ctrl/Cmd+V table copy/paste.
  const clipboardRef = useRef<Table | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);
  const [relationDialogOpen, setRelationDialogOpen] = useState(false);
  const [relationDialogSource, setRelationDialogSource] = useState<
    string | undefined
  >(undefined);
  const [pendingConnection, setPendingConnection] = useState<{
    sourceTableId: string;
    sourceColumnId: string;
    targetTableId: string;
    targetColumnId: string;
  } | null>(null);
  const [configTableId, setConfigTableId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const selectedEdgeIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedEdgeIdRef.current = selectedEdgeId;
  }, [selectedEdgeId]);
  const [interactive, setInteractive] = useState(true);
  // IDs of nodes currently in the React Flow multi-selection. Drives the
  // bulk-action toolbar (Delete / Duplicate / Auto-arrange selected).
  const [multiSelectedIds, setMultiSelectedIds] = useState<string[]>([]);
  const multiSelectedIdsRef = useRef<string[]>([]);
  useEffect(() => {
    multiSelectedIdsRef.current = multiSelectedIds;
  }, [multiSelectedIds]);

  // Listen for cross-panel focus requests (Problems tab → highlight + center
  // a table on the canvas). Fits the view on the target node so the user
  // doesn't have to hunt for it manually.
  useEffect(() => {
    const onFocus = (e: Event) => {
      const detail = (e as CustomEvent<{ tableId?: string }>).detail;
      const tableId = detail?.tableId;
      if (!tableId) return;
      setSelectedTableId(tableId);
      const inst = reactFlowInstanceRef.current;
      if (!inst) return;
      const node = inst.getNode(tableId);
      if (!node) return;
      inst.fitView({
        nodes: [{ id: tableId }],
        padding: 0.4,
        duration: 400,
        maxZoom: 1.5,
      });
    };
    window.addEventListener("super-schema:focus-table", onFocus);
    return () =>
      window.removeEventListener("super-schema:focus-table", onFocus);
  }, [setSelectedTableId]);

  const requestDeleteTable = useCallback((id: string) => {
    setConfirm({ kind: "delete-table", tableId: id });
  }, []);

  const autoArrange = useCallback(() => {
    const tables = schema.tables;
    if (tables.length === 0) return;

    const positions = computeAutoLayout(schema, {
      measure: (id, cols) => {
        const node = reactFlowInstanceRef.current?.getNode(id);
        return {
          width: node?.measured?.width ?? 240,
          height: node?.measured?.height ?? 60 + Math.max(1, cols) * 30,
        };
      },
    });

    // Push positions to BOTH the schema (so auto-save persists them) AND
    // React Flow's node state directly. syncNodesFromSchema deliberately
    // preserves RF-owned positions across schema updates (so user drags
    // aren't clobbered mid-drag). That same preservation makes auto-arrange
    // writes silently ignored — RF keeps the old position. Force-apply here.
    setTablePositions(positions);
    setNodes((prev) =>
      prev.map((n) =>
        positions[n.id]
          ? { ...n, position: positions[n.id], positionAbsolute: positions[n.id] }
          : n
      )
    );

    // Wait for React to commit new positions + React Flow to measure, then
    // zoom-to-fit. Double rAF ensures the layout paint has completed.
    // After fitView lands we persist the new viewport so it survives a
    // schema-tab switch — otherwise the next time the user comes back to
    // this schema, the saved viewport (pre-arrange) would override the
    // freshly-arranged layout.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const inst = reactFlowInstanceRef.current;
        if (!inst) return;
        inst.fitView({
          padding: 0.2,
          duration: 500,
          includeHiddenNodes: false,
        });
        // fitView animates over `duration`. Persist the final viewport
        // after the animation settles.
        setTimeout(() => saveViewport(), 550);
      });
    });
  }, [schema, setTablePositions, saveViewport]);

  // Sync schema → React Flow nodes. RF owns measured dimensions / drag
  // positions; schema owns identity + persisted position. Skip sync while a
  // drag is in flight; flush on drag-stop.
  //
  // Reads `selectedTableId` via `selectedTableIdRef.current` rather than the
  // captured-by-closure value. The ref is updated synchronously on every
  // selection change, so a sync triggered by a *non-selection* schema
  // mutation (e.g. column edit) sees the current selection instead of a
  // stale one. This avoids the "wrong node visually highlighted after a
  // schema array change" bug that the closure-only path exhibits when the
  // effect's dep array doesn't include `selectedTableId`.
  const syncNodesFromSchema = useCallback(() => {
    setNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]));
      const currentSelected = selectedTableIdRef.current;
      return schema.tables.map((table) => {
        const existing = prevById.get(table.id);
        const data = {
          table,
          selected: table.id === currentSelected,
          onSelect: (id: string) => {
            setSelectedTableId(id);
            // On mobile, single tap on a table opens the full-screen edit
            // sheet — there's no sidebar visible to edit from.
            if (isMobile) setConfigTableId(id);
          },
          onRequestDelete: requestDeleteTable,
          onRename: updateTableName,
          onConfigure: (id: string) => setConfigTableId(id),
          isMobile,
        };
        if (existing) {
          // Preserve RF-owned fields: position, measured, dragging, etc.
          return { ...existing, data };
        }
        return {
          id: table.id,
          type: "tableNode",
          position: table.position,
          data,
        };
      });
    });
  }, [
    schema.tables,
    setSelectedTableId,
    requestDeleteTable,
    updateTableName,
    isMobile,
  ]);

  useEffect(() => {
    if (draggingRef.current) {
      pendingSyncRef.current = true;
      return;
    }
    syncNodesFromSchema();
  }, [syncNodesFromSchema]);

  // Re-sync nodes whenever the selected table id flips so the `selected`
  // flag on each node's data updates without waiting for the next schema
  // mutation. The sync function reads `selectedTableIdRef` so this effect
  // just kicks the sync; we deliberately keep `selectedTableId` out of
  // `syncNodesFromSchema`'s deps to avoid recreating the callback on every
  // selection change.
  useEffect(() => {
    if (draggingRef.current) return;
    syncNodesFromSchema();
  }, [selectedTableId, syncNodesFromSchema]);

  // Canvas keyboard shortcuts. All bail out of typing surfaces (input,
  // textarea, contenteditable) so they never hijack form input.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      const mod = isMod(e);
      const k = e.key.toLowerCase();

      // Undo / redo
      if (mod && k === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (mod && ((k === "z" && e.shiftKey) || k === "y")) {
        e.preventDefault();
        redo();
        return;
      }

      // Save (force-flush)
      if (mod && k === "s") {
        e.preventDefault();
        void saveNow();
        return;
      }

      // Copy / Paste / Duplicate (operates on the selected table)
      if (mod && k === "c" && selectedTableIdRef.current) {
        e.preventDefault();
        const t = schema.tables.find(
          (x) => x.id === selectedTableIdRef.current
        );
        if (t) {
          clipboardRef.current = t;
          toast.success(`Copied table "${t.name}"`);
        }
        return;
      }
      if (mod && k === "v") {
        e.preventDefault();
        const t = clipboardRef.current;
        if (!t) {
          toast.error("Clipboard empty");
          return;
        }
        insertTable(t);
        toast.success(`Pasted "${t.name}"`);
        return;
      }
      if (mod && k === "d" && selectedTableIdRef.current) {
        e.preventDefault();
        const id = duplicateTable(selectedTableIdRef.current, { select: true });
        if (id) toast.success("Duplicated table");
        return;
      }

      // New schema / new table
      if (mod && k === "n") {
        e.preventDefault();
        addTable(`table_${schema.tables.length + 1}`);
        return;
      }
      if (mod && k === "t") {
        e.preventDefault();
        addTable(`table_${schema.tables.length + 1}`);
        return;
      }

      // Select all (multi-select on canvas)
      if (mod && k === "a") {
        const inst = reactFlowInstanceRef.current;
        if (!inst) return;
        e.preventDefault();
        inst.setNodes((ns) => ns.map((n) => ({ ...n, selected: true })));
        return;
      }

      // Delete selected — edge first, then bulk-tables, then single-table
      if ((k === "delete" || k === "backspace") && !mod) {
        const edgeId = selectedEdgeIdRef.current;
        if (edgeId) {
          e.preventDefault();
          setConfirm({ kind: "delete-relation", relationId: edgeId });
          return;
        }
        const multi = multiSelectedIdsRef.current;
        if (multi.length > 1) {
          e.preventDefault();
          setConfirm({ kind: "delete-many", tableIds: multi });
          return;
        }
        const id = selectedTableIdRef.current ?? multi[0];
        if (!id) return;
        e.preventDefault();
        setConfirm({ kind: "delete-table", tableId: id });
        return;
      }

      // Auto-arrange (Shift+L)
      if (e.shiftKey && k === "l" && !mod) {
        e.preventDefault();
        autoArrange();
        return;
      }

      // Fit-to-view (F)
      if (k === "f" && !mod && !e.shiftKey) {
        const inst = reactFlowInstanceRef.current;
        if (!inst) return;
        e.preventDefault();
        inst.fitView({ padding: 0.2, duration: 300 });
        return;
      }

      // Zoom in / out (= / -)
      if ((k === "=" || k === "+") && !mod) {
        const inst = reactFlowInstanceRef.current;
        if (!inst) return;
        e.preventDefault();
        inst.zoomIn({ duration: 200 });
        return;
      }
      if (k === "-" && !mod) {
        const inst = reactFlowInstanceRef.current;
        if (!inst) return;
        e.preventDefault();
        inst.zoomOut({ duration: 200 });
        return;
      }

      // Rename selected table (R)
      if (k === "r" && !mod && selectedTableIdRef.current) {
        e.preventDefault();
        const t = schema.tables.find(
          (x) => x.id === selectedTableIdRef.current
        );
        if (!t) return;
        const next = window.prompt("New table name", t.name)?.trim();
        if (next && next !== t.name) updateTableName(t.id, next);
        return;
      }

      // Add column to selected table (Shift+C)
      if (e.shiftKey && k === "c" && !mod && selectedTableIdRef.current) {
        e.preventDefault();
        addColumn(selectedTableIdRef.current);
        return;
      }

      // Open relation dialog from selected table (Shift+R)
      if (e.shiftKey && k === "r" && !mod) {
        e.preventDefault();
        if (schema.tables.length < 2) {
          toast.error("Add at least 2 tables first");
          return;
        }
        setRelationDialogSource(selectedTableIdRef.current ?? undefined);
        setRelationDialogOpen(true);
        return;
      }

      // Escape — clear selection / close menus
      if (k === "escape") {
        setSelectedTableId(null);
        setSelectedEdgeId(null);
        setMenu(null);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    undo,
    redo,
    saveNow,
    addTable,
    addColumn,
    duplicateTable,
    insertTable,
    schema.tables,
    setSelectedTableId,
    autoArrange,
    updateTableName,
  ]);

  const edges: Edge[] = schema.relations.map((rel) => {
    const sourceTable = schema.tables.find((t) => t.id === rel.sourceTable);
    const sourceColor = sourceTable?.color ?? "var(--color-muted-foreground)";
    const isEdgeSelected = selectedEdgeId === rel.id;
    // Highlight any edge attached to the currently selected table.
    const touchesSelected =
      selectedTableId !== null &&
      (rel.sourceTable === selectedTableId || rel.targetTable === selectedTableId);
    const highlight = isEdgeSelected || touchesSelected;
    return {
      id: rel.id,
      source: rel.sourceTable,
      target: rel.targetTable,
      sourceHandle: `${rel.sourceColumn}-source-right`,
      targetHandle: `${rel.targetColumn}-target-left`,
      type: "smoothstep",
      animated: true,
      selected: isEdgeSelected,
      label:
        rel.type === "one-to-many"
          ? "1:N"
          : rel.type === "one-to-one"
            ? "1:1"
            : "N:M",
      labelStyle: {
        fontSize: 10,
        fontWeight: 700,
        fill: "var(--color-foreground)",
      },
      labelBgStyle: {
        fill: "var(--color-background)",
        stroke: highlight ? sourceColor : "var(--color-border)",
        strokeWidth: isEdgeSelected ? 2 : highlight ? 1.5 : 1,
      },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 6,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: sourceColor,
      },
      style: {
        stroke: sourceColor,
        strokeWidth: isEdgeSelected ? 3.5 : highlight ? 3 : 1.75,
        opacity:
          selectedEdgeId !== null
            ? isEdgeSelected
              ? 1
              : 0.3
            : selectedTableId === null || touchesSelected
              ? 1
              : 0.35,
        filter: isEdgeSelected
          ? `drop-shadow(0 0 10px ${sourceColor})`
          : highlight
            ? `drop-shadow(0 0 6px ${sourceColor}66)`
            : undefined,
      },
      selectable: true,
    };
  });

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onNodeDragStart: OnNodeDrag = useCallback(() => {
    draggingRef.current = true;
  }, []);

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      updateTablePosition(node.id, node.position);
      draggingRef.current = false;
      // Flush any deferred schema sync that arrived during the drag.
      if (pendingSyncRef.current) {
        pendingSyncRef.current = false;
        // Defer one tick so React commits position update first.
        queueMicrotask(() => syncNodesFromSchema());
      }
    },
    [updateTablePosition, syncNodesFromSchema]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return;

      // Strip any directional suffix (-target / -source / position).
      // Handle ids look like "<colId>-source-right", "<colId>-target-left",
      // or the legacy "<colId>-source" / "<colId>-target".
      const stripSuffix = (h: string | null | undefined) =>
        (h ?? "")
          .replace(/-(source|target)(-(left|right|top|bottom))?$/, "")
          .trim();

      const sourceCol = stripSuffix(connection.sourceHandle);
      const targetCol = stripSuffix(connection.targetHandle);
      if (!sourceCol || !targetCol) return;

      // Guard against a column being deleted between drag-start and drop.
      // Without this we'd create a relation pointing at a phantom column.
      const sourceTable = schema.tables.find((t) => t.id === connection.source);
      const targetTable = schema.tables.find((t) => t.id === connection.target);
      if (!sourceTable || !targetTable) return;
      const sCol = sourceTable.columns.find((c) => c.id === sourceCol);
      const tCol = targetTable.columns.find((c) => c.id === targetCol);
      if (!sCol || !tCol) return;
      // Block + toast on type mismatch so the user sees why the drag
      // didn't take. `isValidConnection` already prevents the visual drop,
      // but onConnect is also reachable via programmatic / context-menu
      // flows so we double-check here.
      if (!areTypesCompatible(sCol.type, tCol.type)) {
        toast.error(
          `Can't connect ${sCol.type} → ${tCol.type}. FK columns must share a type family (numeric / text / date / …).`
        );
        return;
      }

      setPendingConnection({
        sourceTableId: connection.source,
        sourceColumnId: sourceCol,
        targetTableId: connection.target,
        targetColumnId: targetCol,
      });
    },
    [schema.tables]
  );

  const handleRelationTypePicked = useCallback(
    (type: Relation["type"]) => {
      if (!pendingConnection) return;
      const { sourceTableId, sourceColumnId, targetTableId, targetColumnId } =
        pendingConnection;

      if (type === "many-to-many") {
        createJunctionTable(
          sourceTableId,
          sourceColumnId,
          targetTableId,
          targetColumnId
        );
      } else {
        // Mark source column as FK
        const sourceTable = schema.tables.find((t) => t.id === sourceTableId);
        const targetTable = schema.tables.find((t) => t.id === targetTableId);
        const srcCol = sourceTable?.columns.find(
          (c) => c.id === sourceColumnId
        );
        const tgtCol = targetTable?.columns.find(
          (c) => c.id === targetColumnId
        );
        if (sourceTable && targetTable && srcCol && tgtCol) {
          if (!srcCol.constraints.includes("REFERENCES")) {
            const next = srcCol.constraints.filter(
              (c) => c !== "AUTO_INCREMENT"
            );
            updateColumn(sourceTable.id, srcCol.id, {
              constraints: [...next, "REFERENCES"],
              references: { table: targetTable.name, column: tgtCol.name },
            });
          }
        }
        addRelation({
          sourceTable: sourceTableId,
          sourceColumn: sourceColumnId,
          targetTable: targetTableId,
          targetColumn: targetColumnId,
          type,
        });
      }
      setPendingConnection(null);
    },
    [pendingConnection, schema.tables, addRelation, updateColumn, createJunctionTable]
  );

  // Prevent invalid connections: same-node loops (already blocked) AND
  // type-incompatible columns (a `text` FK pointing at an `int` PK is
  // almost always a mistake — every dialect rejects the FK at runtime
  // anyway). React Flow calls this on every hover during a drag so the
  // body has to stay cheap; we resolve the source/target tables + columns
  // by id and compare via a small compatibility map.
  const isValidConnection = useCallback(
    (conn: Connection | Edge) => {
      if (!conn.source || !conn.target) return false;
      if (conn.source === conn.target) return false;
      const stripSuffix = (h: string | null | undefined) =>
        (h ?? "")
          .replace(/-(source|target)(-(left|right|top|bottom))?$/, "")
          .trim();
      const sCol = stripSuffix(conn.sourceHandle);
      const tCol = stripSuffix(conn.targetHandle);
      if (!sCol || !tCol) return true; // RF passes node-level conn during preview — allow.
      const srcTable = schema.tables.find((t) => t.id === conn.source);
      const tgtTable = schema.tables.find((t) => t.id === conn.target);
      const srcCol = srcTable?.columns.find((c) => c.id === sCol);
      const tgtCol = tgtTable?.columns.find((c) => c.id === tCol);
      if (!srcCol || !tgtCol) return false;
      return areTypesCompatible(srcCol.type, tgtCol.type);
    },
    [schema.tables]
  );

  const onPaneClick = useCallback(() => {
    setSelectedTableId(null);
    setSelectedEdgeId(null);
    setMenu(null);
  }, [setSelectedTableId]);

  const onEdgeClick = useCallback(
    (e: React.MouseEvent, edge: Edge) => {
      e.stopPropagation();
      setSelectedEdgeId(edge.id);
      setSelectedTableId(null);
    },
    [setSelectedTableId]
  );

  const onNodeClick = useCallback(() => {
    setSelectedEdgeId(null);
  }, []);

  // Context menu wiring
  const onNodeContextMenu = useCallback(
    (e: React.MouseEvent, node: Node) => {
      e.preventDefault();
      setMenu({ kind: "node", x: e.clientX, y: e.clientY, nodeId: node.id });
    },
    []
  );

  const onEdgeContextMenu = useCallback(
    (e: React.MouseEvent, edge: Edge) => {
      e.preventDefault();
      setMenu({ kind: "edge", x: e.clientX, y: e.clientY, edgeId: edge.id });
    },
    []
  );

  const onPaneContextMenu = useCallback(
    (e: React.MouseEvent | MouseEvent) => {
      e.preventDefault();
      setMenu({ kind: "pane", x: e.clientX, y: e.clientY });
    },
    []
  );

  // Build context-menu items based on conditions
  const buildMenuItems = (): ContextMenuItem[] => {
    if (!menu) return [];

    if (menu.kind === "node") {
      const table = schema.tables.find((t) => t.id === menu.nodeId);
      if (!table) return [];
      return [
        {
          label: "Configure table",
          icon: <Settings className="size-3" />,
          onClick: () => setConfigTableId(table.id),
        },
        {
          label: "Rename table",
          icon: <Pencil className="size-3" />,
          onClick: () => {
            // Trigger rename via window prompt fallback (simple UX)
            const next = window.prompt("New table name", table.name)?.trim();
            if (next && next !== table.name) updateTableName(table.id, next);
          },
        },
        {
          label: "Add field",
          icon: <Plus className="size-3" />,
          onClick: () => addColumn(table.id),
        },
        {
          label: "Add relation from here",
          icon: <Link2 className="size-3" />,
          onClick: () => {
            setRelationDialogSource(table.id);
            setRelationDialogOpen(true);
          },
          disabled: schema.tables.length < 2,
        },
        {
          label: "Duplicate table",
          icon: <Copy className="size-3" />,
          onClick: () => addTable(`${table.name}_copy`),
        },
        {
          label: "View details",
          icon: <Eye className="size-3" />,
          onClick: () => setSelectedTableId(table.id),
        },
        { label: "", separator: true, onClick: () => {} },
        {
          label: "Delete table",
          icon: <Trash2 className="size-3" />,
          onClick: () => setConfirm({ kind: "delete-table", tableId: table.id }),
          destructive: true,
        },
      ];
    }

    if (menu.kind === "edge") {
      const rel = schema.relations.find((r) => r.id === menu.edgeId);
      if (!rel) return [];
      const cycleType = (next: Relation["type"]) => {
        updateRelation(rel.id, { type: next });
      };
      return [
        {
          label: "Set 1:1 (one-to-one)",
          icon: <Link2 className="size-3" />,
          onClick: () => cycleType("one-to-one"),
          disabled: rel.type === "one-to-one",
        },
        {
          label: "Set 1:N (one-to-many)",
          icon: <Link2 className="size-3" />,
          onClick: () => cycleType("one-to-many"),
          disabled: rel.type === "one-to-many",
        },
        {
          label: "Set N:M (many-to-many)",
          icon: <ArrowRightLeft className="size-3" />,
          onClick: () => cycleType("many-to-many"),
          disabled: rel.type === "many-to-many",
        },
        { label: "", separator: true, onClick: () => {} },
        {
          label: "Delete relation",
          icon: <Trash2 className="size-3" />,
          onClick: () =>
            setConfirm({ kind: "delete-relation", relationId: rel.id }),
          destructive: true,
        },
      ];
    }

    if (menu.kind === "pane") {
      return [
        {
          label: "Add table here",
          icon: <Plus className="size-3" />,
          onClick: () => addTable(`table_${schema.tables.length + 1}`),
        },
        {
          label: "Add relation",
          icon: <Link2 className="size-3" />,
          onClick: () => {
            setRelationDialogSource(undefined);
            setRelationDialogOpen(true);
          },
          disabled: schema.tables.length < 2,
        },
      ];
    }

    return [];
  };

  // Dialog content based on confirm state
  const confirmProps = (() => {
    if (!confirm) {
      return {
        open: false,
        title: "",
        description: "",
        onConfirm: () => {},
      };
    }
    if (confirm.kind === "delete-table") {
      const t = schema.tables.find((x) => x.id === confirm.tableId);
      const dependentRelations = schema.relations.filter(
        (r) =>
          r.sourceTable === confirm.tableId ||
          r.targetTable === confirm.tableId
      ).length;
      return {
        open: true,
        title: `Delete table "${t?.name}"?`,
        description: `This permanently removes the table and ${dependentRelations} associated relation${dependentRelations === 1 ? "" : "s"}. This cannot be undone.`,
        confirmLabel: "Delete table",
        onConfirm: () => removeTable(confirm.tableId),
      };
    }
    if (confirm.kind === "delete-many") {
      const ids = new Set(confirm.tableIds);
      const dependent = schema.relations.filter(
        (r) => ids.has(r.sourceTable) || ids.has(r.targetTable)
      ).length;
      return {
        open: true,
        title: `Delete ${confirm.tableIds.length} tables?`,
        description: `Permanently removes ${confirm.tableIds.length} table${confirm.tableIds.length === 1 ? "" : "s"} and ${dependent} associated relation${dependent === 1 ? "" : "s"}. This cannot be undone.`,
        confirmLabel: `Delete ${confirm.tableIds.length} tables`,
        onConfirm: () => {
          removeTables(confirm.tableIds);
          setMultiSelectedIds([]);
        },
      };
    }
    return {
      open: true,
      title: "Delete relation?",
      description: "This removes the foreign-key edge between these tables. The columns themselves stay.",
      confirmLabel: "Delete relation",
      onConfirm: () => removeRelation(confirm.relationId),
    };
  })();

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (
      e.dataTransfer.types.includes("application/super-schema-table")
    ) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      const tableId = e.dataTransfer.getData("application/super-schema-table");
      if (!tableId) return;
      e.preventDefault();
      const instance = reactFlowInstanceRef.current;
      if (!instance) return;
      const position = instance.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });
      updateTablePosition(tableId, position);
      setSelectedTableId(tableId);
    },
    [updateTablePosition, setSelectedTableId]
  );

  return (
    // Ensure React Flow parent has an explicit minimum height so it can measure
    // and render correctly; also keeps hydration stable across SSR/CSR.
    <div
      ref={wrapperRef}
      className="relative h-full w-full min-h-0"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={interactive}
        nodesConnectable={interactive}
        elementsSelectable={interactive}
        panOnDrag={interactive ? [0, 1, 2] : false}
        selectionOnDrag={false}
        selectionKeyCode="Control"
        multiSelectionKeyCode={["Shift", "Meta", "Control"]}
        zoomOnScroll={interactive}
        zoomOnPinch={interactive}
        zoomOnDoubleClick={interactive}
        // Wide bounds so big schemas can fit on one screen and small details
        // can be inspected up close. React Flow's defaults (0.5 / 2) felt
        // restrictive — let users zoom out to a near-thumbnail view and in
        // for pixel-level inspection.
        minZoom={0.05}
        maxZoom={4}
        onInit={(instance) => {
          reactFlowInstanceRef.current = instance;
          // First time RF mounts for the active schema, restore the saved
          // viewport. Defer one tick so the initial fitView (from `fitView`
          // prop) doesn't immediately overwrite our restore.
          const id = activeSchemaId;
          if (id && restoredForSchemaRef.current !== id) {
            restoredForSchemaRef.current = id;
            requestAnimationFrame(() => {
              restoreViewport(id);
            });
          }
        }}
        onMoveEnd={() => saveViewport()}
        onNodesChange={onNodesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onEdgeClick={onEdgeClick}
        onNodeClick={onNodeClick}
        onSelectionChange={({ nodes: selNodes }) => {
          // Order-independent compare: RF doesn't guarantee a stable order
          // for `selNodes` between renders, so a length-then-index loop can
          // wrongly report "different" and feed back into the render loop
          // (multiSelectedIds → new edges → new render → onSelectionChange
          // fires again). Compare as sets via a sorted joined key — same
          // contents in any order are treated as equal.
          const next = selNodes.map((n) => n.id);
          setMultiSelectedIds((prev) => {
            if (prev.length !== next.length) return next;
            const a = [...prev].sort().join("");
            const b = [...next].sort().join("");
            return a === b ? prev : next;
          });
        }}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        isValidConnection={isValidConnection}
        connectionLineStyle={{
          stroke: "var(--color-primary)",
          strokeWidth: 2,
          strokeDasharray: "5 4",
        }}
        connectionRadius={40}
        connectOnClick={false}
        connectionMode={ConnectionMode.Loose}
        fitView
        colorMode={colorMode}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: true,
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          className="!opacity-60"
        />
        <Controls
          showZoom={false}
          showFitView={false}
          showInteractive={false}
          className="!rounded-lg !border !border-border !bg-card !shadow-sm"
        >
          <Tip label="Zoom in (=)" side="right">
            <span className="inline-flex">
              <ControlButton
                onClick={() =>
                  reactFlowInstanceRef.current?.zoomIn({ duration: 200 })
                }
                aria-label="Zoom in"
              >
                <Plus />
              </ControlButton>
            </span>
          </Tip>
          <Tip label="Zoom out (-)" side="right">
            <span className="inline-flex">
              <ControlButton
                onClick={() =>
                  reactFlowInstanceRef.current?.zoomOut({ duration: 200 })
                }
                aria-label="Zoom out"
              >
                <Minus />
              </ControlButton>
            </span>
          </Tip>
          <Tip label="Fit view (F)" side="right">
            <span className="inline-flex">
              <ControlButton
                onClick={() =>
                  reactFlowInstanceRef.current?.fitView({
                    padding: 0.2,
                    duration: 300,
                  })
                }
                aria-label="Fit view"
              >
                <Maximize2 />
              </ControlButton>
            </span>
          </Tip>
          <Tip label={interactive ? "Lock canvas" : "Unlock canvas"} side="right">
            <span className="inline-flex">
              <ControlButton
                onClick={() => setInteractive((v) => !v)}
                aria-label={interactive ? "Lock canvas" : "Unlock canvas"}
              >
                {interactive ? <LockOpen /> : <Lock />}
              </ControlButton>
            </span>
          </Tip>
          <Tip
            label={canUndo ? "Undo (Ctrl+Z)" : "Nothing to undo"}
            side="right"
          >
            <span className="inline-flex">
              <ControlButton
                onClick={undo}
                aria-label="Undo"
                disabled={!canUndo}
              >
                <Undo2 />
              </ControlButton>
            </span>
          </Tip>
          <Tip
            label={canRedo ? "Redo (Ctrl+Shift+Z)" : "Nothing to redo"}
            side="right"
          >
            <span className="inline-flex">
              <ControlButton
                onClick={redo}
                aria-label="Redo"
                disabled={!canRedo}
              >
                <Redo2 />
              </ControlButton>
            </span>
          </Tip>
          <Tip
            label={
              schema.tables.length === 0
                ? "Add tables to auto-arrange"
                : "Auto-arrange tables (Shift+L)"
            }
            side="right"
          >
            <span className="inline-flex">
              <ControlButton
                onClick={autoArrange}
                aria-label="Auto-arrange tables"
                disabled={schema.tables.length === 0}
              >
                <LayoutGrid />
              </ControlButton>
            </span>
          </Tip>
        </Controls>
        {!isMobile && (
          <MiniMap
            pannable
            zoomable
            nodeBorderRadius={10}
            nodeStrokeWidth={3}
            nodeClassName={(n) =>
              n.selected ? "!border-primary" : "!border-border"
            }
            nodeColor={(n) => {
              const table = schema.tables.find((t) => t.id === n.id);
              return table?.color ?? "var(--color-muted-foreground)";
            }}
            className="!bg-card !border !border-border !rounded-lg !shadow-sm"
          />
        )}
      </ReactFlow>

      {/* Bootstrap loader — covers the canvas until workspace + active schema
          are loaded, so the user sees feedback instead of a blank pane. */}
      {workspaceLoading && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-background/60 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-2 rounded-lg border bg-card px-4 py-3 shadow-sm">
            <Loader />
            <p className="text-xs text-muted-foreground">Loading workspace</p>
          </div>
        </div>
      )}

      {/* Hint pill — visible only when 2+ tables exist and no relations yet,
          nudges new users toward the drag-from-column flow. */}
      {schema.tables.length >= 2 &&
        schema.relations.length === 0 &&
        multiSelectedIds.length < 2 && (
          <div className="pointer-events-none absolute right-3 top-3 z-0 flex items-center gap-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-medium text-violet-700 shadow-sm backdrop-blur-sm dark:text-violet-300">
            <Link2 className="size-3" />
            Drag from a column dot to link tables
          </div>
        )}

      {/* Bulk-action toolbar — appears whenever 2+ tables are selected (via
          drag-select or shift-click). Floats top-center for easy reach. */}
      {multiSelectedIds.length > 1 && (
        <div className="pointer-events-auto absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card/95 px-1.5 py-1 shadow-lg backdrop-blur">
          <span className="px-2 text-[11px] font-semibold text-foreground">
            {multiSelectedIds.length} selected
          </span>
          <span className="h-4 w-px bg-border" />
          <Tip label="Auto-arrange selected" side="bottom">
            <button
              type="button"
              onClick={() => {
                const inst = reactFlowInstanceRef.current;
                if (!inst) return;
                inst.fitView({
                  nodes: multiSelectedIds.map((id) => ({ id })),
                  padding: 0.4,
                  duration: 400,
                  maxZoom: 1.5,
                });
              }}
              className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <LayoutGrid className="size-3.5" />
            </button>
          </Tip>
          <Tip label="Duplicate selected" side="bottom">
            <button
              type="button"
              onClick={() => {
                let n = 0;
                for (const id of multiSelectedIds) {
                  if (duplicateTable(id, { select: false })) n++;
                }
                if (n > 0)
                  toast.success(`Duplicated ${n} table${n === 1 ? "" : "s"}`);
              }}
              className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Copy className="size-3.5" />
            </button>
          </Tip>
          <Tip label="Clear selection" side="bottom">
            <button
              type="button"
              onClick={() => {
                const inst = reactFlowInstanceRef.current;
                if (!inst) return;
                inst.setNodes((ns) => ns.map((n) => ({ ...n, selected: false })));
                setMultiSelectedIds([]);
              }}
              className="inline-flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Eye className="size-3.5" />
            </button>
          </Tip>
          <span className="h-4 w-px bg-border" />
          <Tip label="Delete selected" side="bottom">
            <button
              type="button"
              onClick={() =>
                setConfirm({
                  kind: "delete-many",
                  tableIds: multiSelectedIds,
                })
              }
              className="inline-flex size-7 items-center justify-center rounded-full text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5" />
            </button>
          </Tip>
        </div>
      )}

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={buildMenuItems()}
          onClose={() => setMenu(null)}
        />
      )}

      <AddRelationDialog
        open={relationDialogOpen}
        onOpenChange={setRelationDialogOpen}
        defaultSourceTable={relationDialogSource}
      />

      <RelationTypeDialog
        open={pendingConnection !== null}
        onOpenChange={(o) => {
          if (!o) setPendingConnection(null);
        }}
        sourceTableName={
          schema.tables.find((t) => t.id === pendingConnection?.sourceTableId)
            ?.name
        }
        sourceColumnName={
          schema.tables
            .find((t) => t.id === pendingConnection?.sourceTableId)
            ?.columns.find((c) => c.id === pendingConnection?.sourceColumnId)
            ?.name
        }
        targetTableName={
          schema.tables.find((t) => t.id === pendingConnection?.targetTableId)
            ?.name
        }
        targetColumnName={
          schema.tables
            .find((t) => t.id === pendingConnection?.targetTableId)
            ?.columns.find((c) => c.id === pendingConnection?.targetColumnId)
            ?.name
        }
        onPick={handleRelationTypePicked}
      />

      <ConfirmDialog
        open={confirmProps.open}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title={confirmProps.title}
        description={confirmProps.description}
        confirmLabel={confirmProps.confirmLabel}
        variant="destructive"
        onConfirm={confirmProps.onConfirm}
      />

      <TableConfigDialog
        tableId={configTableId}
        onOpenChange={(o) => {
          if (!o) setConfigTableId(null);
        }}
      />
    </div>
  );
}
