"use client";

import { useCallback, useEffect, useState, useMemo } from "react";
import { useTheme } from "next-themes";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  type Node,
  type Edge,
  type OnNodesChange,
  type Connection,
  type OnNodeDrag,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useSchema } from "@/lib/schema-store";
import { TableNode } from "./table-node";

const nodeTypes = { tableNode: TableNode };

export function SchemaCanvas() {
  const {
    schema,
    selectedTableId,
    setSelectedTableId,
    updateTablePosition,
    addRelation,
  } = useSchema();

  const { resolvedTheme } = useTheme();
  const colorMode = resolvedTheme === "dark" ? "dark" : "light";

  const [nodes, setNodes] = useState<Node[]>([]);

  // Sync schema tables → React Flow nodes
  useEffect(() => {
    setNodes((prev) =>
      schema.tables.map((table) => {
        const existing = prev.find((n) => n.id === table.id);
        return {
          ...(existing ?? {}),
          id: table.id,
          type: "tableNode",
          // Keep React Flow's internal position during drag, only reset if no existing node
          position: existing ? existing.position : table.position,
          data: {
            table,
            selected: table.id === selectedTableId,
            onSelect: setSelectedTableId,
          },
        };
      })
    );
  }, [schema.tables, selectedTableId, setSelectedTableId]);

  const edges: Edge[] = schema.relations.map((rel) => ({
    id: rel.id,
    source: rel.sourceTable,
    target: rel.targetTable,
    sourceHandle: `${rel.sourceColumn}-source`,
    targetHandle: `${rel.targetColumn}-target`,
    type: "smoothstep",
    animated: true,
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: "var(--color-muted-foreground)", strokeWidth: 1.5 },
  }));

  // Let React Flow handle all node changes (dimensions, selection, position, etc.)
  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  // Sync position back to schema store when drag ends
  const onNodeDragStop: OnNodeDrag = useCallback(
    (_event, node) => {
      updateTablePosition(node.id, node.position);
    },
    [updateTablePosition]
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const sourceCol =
        connection.sourceHandle
          ?.replace("-pk-source", "")
          .replace("-source", "") ?? "";
      const targetCol =
        connection.targetHandle?.replace("-target", "") ?? "";
      addRelation({
        sourceTable: connection.source,
        sourceColumn: sourceCol,
        targetTable: connection.target,
        targetColumn: targetCol,
        type: "one-to-many",
      });
    },
    [addRelation]
  );

  const onPaneClick = useCallback(() => {
    setSelectedTableId(null);
  }, [setSelectedTableId]);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={onConnect}
        onPaneClick={onPaneClick}
        fitView
        colorMode={colorMode}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: "smoothstep",
          animated: true,
        }}
      >
        <Background gap={16} size={1} />
        <Controls />
        <MiniMap
          nodeStrokeWidth={3}
          className="!bg-card !border !border-border !rounded-lg !shadow-sm"
        />
      </ReactFlow>
    </div>
  );
}
