"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  applyNodeChanges,
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
    updateTableName,
    updateColumn,
    addRelation,
    addTable,
    addColumn,
    removeTable,
    removeRelation,
    createJunctionTable,
  } = useSchema();

  const { resolvedTheme } = useTheme();
  // Avoid hydration mismatch: only compute theme-aware mode after client mount.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const colorMode = mounted && resolvedTheme === "dark" ? "dark" : "light";

  const [nodes, setNodes] = useState<Node[]>([]);
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
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

  // Sync schema → React Flow nodes. RF owns measured dimensions / drag
  // positions; schema owns identity + persisted position.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNodes((prev) =>
      schema.tables.map((table) => {
        const existing = prev.find((n) => n.id === table.id);
        return {
          ...(existing ?? {}),
          id: table.id,
          type: "tableNode",
          position: existing ? existing.position : table.position,
          data: {
            table,
            selected: table.id === selectedTableId,
            onSelect: setSelectedTableId,
            onRequestDelete: requestDeleteTable,
            onRename: updateTableName,
          },
        };
      })
    );
  }, [
    schema.tables,
    selectedTableId,
    setSelectedTableId,
    requestDeleteTable,
    updateTableName,
  ]);

  const edges: Edge[] = schema.relations.map((rel) => {
    const sourceTable = schema.tables.find((t) => t.id === rel.sourceTable);
    const sourceColor = sourceTable?.color ?? "var(--color-muted-foreground)";
    return {
      id: rel.id,
      source: rel.sourceTable,
      target: rel.targetTable,
      sourceHandle: `${rel.sourceColumn}-source`,
      targetHandle: `${rel.targetColumn}-target`,
      type: "smoothstep",
      animated: true,
      label:
        rel.type === "one-to-many"
          ? "1:N"
          : rel.type === "one-to-one"
            ? "1:1"
            : "N:M",
      labelStyle: { fontSize: 10, fontWeight: 600 },
      labelBgStyle: { fill: "var(--color-card)" },
      labelBgPadding: [4, 2] as [number, number],
      labelBgBorderRadius: 4,
      markerEnd: { type: MarkerType.ArrowClosed, color: sourceColor },
      style: { stroke: sourceColor, strokeWidth: 1.5 },
    };
  });

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      updateTablePosition(node.id, node.position);
    },
    [updateTablePosition]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      if (connection.source === connection.target) return; // no self-table loops via drag
      const sourceCol =
        connection.sourceHandle
          ?.replace("-pk-source", "")
          .replace("-source", "") ?? "";
      const targetCol =
        connection.targetHandle?.replace("-target", "") ?? "";
      if (!sourceCol || !targetCol) return;

      // Stash and prompt for relation type
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
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        isValidConnection={isValidConnection}
        connectionLineStyle={{
          stroke: "#8b5cf6",
          strokeWidth: 2,
          strokeDasharray: "4 4",
        }}
        connectionRadius={28}
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
        <Controls className="!rounded-lg !border !border-border !bg-card !shadow-sm" />
        <MiniMap
        pannable zoomable 
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
