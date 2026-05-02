"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "next-themes";
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
import type { Table } from "@/lib/types";
import { TableNode } from "./table-node";
import {
  ContextMenu,
  type ContextMenuItem,
} from "@/components/ui/context-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AddRelationDialog } from "./add-relation-dialog";
import { RelationTypeDialog } from "./relation-type-dialog";
import { Button } from "@/components/ui/button";
import {
  Pencil,
  Plus,
  Trash2,
  Copy,
  Link2,
  ArrowRightLeft,
  Eye,
  LayoutGrid,
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
    addTable,
    addColumn,
    removeTable,
    removeRelation,
    createJunctionTable,
    duplicateTable,
    insertTable,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useSchema();
  const { saveNow } = useWorkspace();

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

  const requestDeleteTable = useCallback((id: string) => {
    setConfirm({ kind: "delete-table", tableId: id });
  }, []);

  // Sugiyama-style layered auto-layout: layer assignment → crossing
  // reduction (barycenter) → position assignment with centering.
  const autoArrange = useCallback(() => {
    const tables = schema.tables;
    if (tables.length === 0) return;

    const idSet = new Set(tables.map((t) => t.id));
    const incoming = new Map<string, Set<string>>();
    const outgoing = new Map<string, Set<string>>();
    const neighbors = new Map<string, Set<string>>();
    tables.forEach((t) => {
      incoming.set(t.id, new Set());
      outgoing.set(t.id, new Set());
      neighbors.set(t.id, new Set());
    });
    schema.relations.forEach((r) => {
      if (!idSet.has(r.sourceTable) || !idSet.has(r.targetTable)) return;
      if (r.sourceTable === r.targetTable) return;
      outgoing.get(r.sourceTable)!.add(r.targetTable);
      incoming.get(r.targetTable)!.add(r.sourceTable);
      neighbors.get(r.sourceTable)!.add(r.targetTable);
      neighbors.get(r.targetTable)!.add(r.sourceTable);
    });

    // ── 1. Layer assignment via longest-path BFS ──
    const layer = new Map<string, number>();
    const queue: string[] = [];
    tables.forEach((t) => {
      if ((incoming.get(t.id)?.size ?? 0) === 0) {
        layer.set(t.id, 0);
        queue.push(t.id);
      }
    });
    while (queue.length) {
      const id = queue.shift()!;
      const d = layer.get(id) ?? 0;
      outgoing.get(id)?.forEach((next) => {
        const nd = layer.get(next);
        if (nd === undefined || nd < d + 1) {
          layer.set(next, d + 1);
          queue.push(next);
        }
      });
    }

    // Find connected components for isolated subgraphs
    const visited = new Set<string>();
    const components: string[][] = [];
    const bfs = (start: string) => {
      const comp: string[] = [];
      const q = [start];
      visited.add(start);
      while (q.length) {
        const id = q.shift()!;
        comp.push(id);
        neighbors.get(id)?.forEach((n) => {
          if (!visited.has(n)) {
            visited.add(n);
            q.push(n);
          }
        });
      }
      return comp;
    };
    // Connected tables first
    tables.forEach((t) => {
      if (!visited.has(t.id) && (neighbors.get(t.id)?.size ?? 0) > 0) {
        components.push(bfs(t.id));
      }
    });
    // Orphan tables (no relations) — each in its own component
    const orphans: string[] = [];
    tables.forEach((t) => {
      if (!visited.has(t.id)) orphans.push(t.id);
    });

    // Assign layers to cycle nodes / orphans
    let maxLayer = 0;
    layer.forEach((d) => { if (d > maxLayer) maxLayer = d; });
    // Cycle nodes that BFS never reached go into next layer
    tables.forEach((t) => {
      if (!layer.has(t.id)) layer.set(t.id, maxLayer + 1);
    });

    // ── 2. Collect layers ──
    const layers = new Map<number, string[]>();
    tables.forEach((t) => {
      const l = layer.get(t.id) ?? 0;
      if (!layers.has(l)) layers.set(l, []);
      layers.get(l)!.push(t.id);
    });

    // ── 3. Crossing reduction: barycenter heuristic (2 passes) ──
    const sortedLayerKeys = Array.from(layers.keys()).sort((a, b) => a - b);

    // Helper: position-in-layer lookup for the previous/next layer
    const posInLayer = (layerIds: string[]) => {
      const m = new Map<string, number>();
      layerIds.forEach((id, i) => m.set(id, i));
      return m;
    };

    // Forward pass: order each layer by barycenter of parents
    for (let li = 1; li < sortedLayerKeys.length; li++) {
      const prevIds = layers.get(sortedLayerKeys[li - 1])!;
      const currIds = layers.get(sortedLayerKeys[li])!;
      const prevPos = posInLayer(prevIds);

      const barycenters = new Map<string, number>();
      currIds.forEach((id) => {
        const parents = incoming.get(id) ?? new Set();
        let sum = 0, count = 0;
        parents.forEach((p) => {
          const pos = prevPos.get(p);
          if (pos !== undefined) { sum += pos; count++; }
        });
        barycenters.set(id, count > 0 ? sum / count : Infinity);
      });
      currIds.sort((a, b) => (barycenters.get(a) ?? Infinity) - (barycenters.get(b) ?? Infinity));
      layers.set(sortedLayerKeys[li], currIds);
    }

    // Backward pass: refine by barycenter of children
    for (let li = sortedLayerKeys.length - 2; li >= 0; li--) {
      const nextIds = layers.get(sortedLayerKeys[li + 1])!;
      const currIds = layers.get(sortedLayerKeys[li])!;
      const nextPos = posInLayer(nextIds);

      const barycenters = new Map<string, number>();
      currIds.forEach((id) => {
        const children = outgoing.get(id) ?? new Set();
        let sum = 0, count = 0;
        children.forEach((c) => {
          const pos = nextPos.get(c);
          if (pos !== undefined) { sum += pos; count++; }
        });
        barycenters.set(id, count > 0 ? sum / count : Infinity);
      });
      currIds.sort((a, b) => (barycenters.get(a) ?? Infinity) - (barycenters.get(b) ?? Infinity));
      layers.set(sortedLayerKeys[li], currIds);
    }

    // ── 4. Measure nodes ──
    const FALLBACK_W = 240;
    const FALLBACK_H = (cols: number) => 60 + cols * 32;
    const measureFor = (id: string, columnCount: number) => {
      const node = reactFlowInstanceRef.current?.getNode(id);
      const w = node?.measured?.width ?? FALLBACK_W;
      const h = node?.measured?.height ?? FALLBACK_H(columnCount);
      return { w, h };
    };

    // ── 5. Position assignment with centering ──
    const X_GAP = 100;
    const Y_GAP = 50;
    const X_START = 80;
    const Y_START = 80;

    // Measure per-layer max width
    const layerWidths = new Map<number, number>();
    layers.forEach((ids, l) => {
      let maxW = 0;
      ids.forEach((tid) => {
        const t = tables.find((x) => x.id === tid)!;
        const { w } = measureFor(tid, t.columns.length);
        if (w > maxW) maxW = w;
      });
      layerWidths.set(l, maxW);
    });

    // Compute total height per layer for centering
    const layerHeights = new Map<number, number>();
    layers.forEach((ids, l) => {
      let totalH = 0;
      ids.forEach((tid) => {
        const t = tables.find((x) => x.id === tid)!;
        const { h } = measureFor(tid, t.columns.length);
        totalH += h;
      });
      totalH += Math.max(0, ids.length - 1) * Y_GAP;
      layerHeights.set(l, totalH);
    });
    const globalMaxH = Math.max(...Array.from(layerHeights.values()), 0);

    const positions: Record<string, { x: number; y: number }> = {};
    let xCursor = X_START;

    for (const l of sortedLayerKeys) {
      const ids = layers.get(l)!;
      const colW = layerWidths.get(l) ?? FALLBACK_W;
      const totalH = layerHeights.get(l) ?? 0;
      // Center this layer's group vertically relative to tallest layer
      let yCursor = Y_START + (globalMaxH - totalH) / 2;

      for (const tid of ids) {
        const t = tables.find((x) => x.id === tid)!;
        const { h } = measureFor(tid, t.columns.length);
        positions[tid] = { x: xCursor, y: yCursor };
        yCursor += h + Y_GAP;
      }
      xCursor += colW + X_GAP;
    }

    // ── 6. Place orphan tables in a grid below the main graph ──
    if (orphans.length > 0) {
      const orphanCols = Math.max(1, Math.ceil(Math.sqrt(orphans.length)));
      const orphanYStart = Y_START + globalMaxH + Y_GAP * 2;
      let ox = X_START, oy = orphanYStart;
      let rowMaxH = 0;
      orphans.forEach((tid, i) => {
        const t = tables.find((x) => x.id === tid)!;
        const { w, h } = measureFor(tid, t.columns.length);
        positions[tid] = { x: ox, y: oy };
        if (h > rowMaxH) rowMaxH = h;
        if ((i + 1) % orphanCols === 0) {
          ox = X_START;
          oy += rowMaxH + Y_GAP;
          rowMaxH = 0;
        } else {
          ox += w + X_GAP;
        }
      });
    }

    setTablePositions(positions);

    // Wait for React to commit new positions + React Flow to measure, then
    // zoom-to-fit. Double rAF ensures the layout paint has completed.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        reactFlowInstanceRef.current?.fitView({
          padding: 0.2,
          duration: 500,
          includeHiddenNodes: false,
        });
      });
    });
    toast.success(
      `Arranged ${tables.length} table${tables.length === 1 ? "" : "s"}`
    );
  }, [schema.tables, schema.relations, setTablePositions]);

  // Sync schema → React Flow nodes. RF owns measured dimensions / drag
  // positions; schema owns identity + persisted position. Skip sync while a
  // drag is in flight; flush on drag-stop.
  const syncNodesFromSchema = useCallback(() => {
    setNodes((prev) => {
      const prevById = new Map(prev.map((n) => [n.id, n]));
      return schema.tables.map((table) => {
        const existing = prevById.get(table.id);
        const data = {
          table,
          selected: table.id === selectedTableId,
          onSelect: setSelectedTableId,
          onRequestDelete: requestDeleteTable,
          onRename: updateTableName,
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
    selectedTableId,
    setSelectedTableId,
    requestDeleteTable,
    updateTableName,
  ]);

  useEffect(() => {
    if (draggingRef.current) {
      pendingSyncRef.current = true;
      return;
    }
    syncNodesFromSchema();
  }, [syncNodesFromSchema]);

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

      // Delete selected
      if ((k === "delete" || k === "backspace") && !mod) {
        const id = selectedTableIdRef.current;
        if (!id) return;
        e.preventDefault();
        setConfirm({ kind: "delete-table", tableId: id });
        return;
      }

      // Escape — clear selection / close menus
      if (k === "escape") {
        setSelectedTableId(null);
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
    duplicateTable,
    insertTable,
    schema.tables,
    setSelectedTableId,
  ]);

  const edges: Edge[] = schema.relations.map((rel) => {
    const sourceTable = schema.tables.find((t) => t.id === rel.sourceTable);
    const sourceColor = sourceTable?.color ?? "var(--color-muted-foreground)";
    return {
      id: rel.id,
      source: rel.sourceTable,
      target: rel.targetTable,
      sourceHandle: `${rel.sourceColumn}-source-right`,
      targetHandle: `${rel.targetColumn}-target-left`,
      type: "smoothstep",
      animated: true,
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
        stroke: "var(--color-border)",
        strokeWidth: 1,
      },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 6,
      markerEnd: { type: MarkerType.ArrowClosed, color: sourceColor },
      style: { stroke: sourceColor, strokeWidth: 1.75 },
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

      setPendingConnection({
        sourceTableId: connection.source,
        sourceColumnId: sourceCol,
        targetTableId: connection.target,
        targetColumnId: targetCol,
      });
    },
    []
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

  // Prevent invalid connections (same node)
  const isValidConnection = useCallback(
    (conn: Connection | Edge) => {
      if (!conn.source || !conn.target) return false;
      return conn.source !== conn.target;
    },
    []
  );

  const onPaneClick = useCallback(() => {
    setSelectedTableId(null);
    setMenu(null);
  }, [setSelectedTableId]);

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
          label: "Add relation from here…",
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
        const newRel: Relation = { ...rel, type: next };
        // Replace via remove + add (store has no direct update)
        removeRelation(rel.id);
        addRelation({
          sourceTable: newRel.sourceTable,
          sourceColumn: newRel.sourceColumn,
          targetTable: newRel.targetTable,
          targetColumn: newRel.targetColumn,
          type: newRel.type,
        });
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
          label: "Add relation…",
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
      className="relative h-full w-full min-h-[60vh]"
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onInit={(instance) => {
          reactFlowInstanceRef.current = instance;
        }}
        onNodesChange={onNodesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
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
        <Controls className="!rounded-lg !border !border-border !bg-card !shadow-sm">
          <ControlButton
            onClick={undo}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            disabled={!canUndo}
          >
            <Undo2 />
          </ControlButton>
          <ControlButton
            onClick={redo}
            title="Redo (Ctrl+Shift+Z)"
            aria-label="Redo"
            disabled={!canRedo}
          >
            <Redo2 />
          </ControlButton>
          <ControlButton
            onClick={autoArrange}
            title="Auto-arrange tables"
            aria-label="Auto-arrange tables"
            disabled={schema.tables.length === 0}
          >
            <LayoutGrid />
          </ControlButton>
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

      {/* Floating toolbar — top right */}
      <div className="pointer-events-none absolute right-3 top-3 z-10 flex gap-1.5">
        <Button
          size="sm"
          onClick={() => {
            setRelationDialogSource(undefined);
            setRelationDialogOpen(true);
          }}
          disabled={schema.tables.length < 2}
          className="pointer-events-auto h-7 gap-1 bg-violet-600 px-2.5 text-white shadow-sm hover:bg-violet-700 disabled:bg-muted disabled:text-muted-foreground"
          title={
            schema.tables.length < 2
              ? "Add at least 2 tables first"
              : "Create a foreign-key relation"
          }
        >
          <Link2 className="size-3" />
          <span className="text-xs font-medium">Add Relation</span>
        </Button>
      </div>

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
    </div>
  );
}
