"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ConnectionMode,
  type Node,
  type Edge,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { Schema } from "@/lib/types";
import { TableNode } from "./table-node";

const nodeTypes = { tableNode: TableNode };

interface ReadOnlyCanvasProps {
  schema: Schema;
}

const noop = () => {};

export function ReadOnlyCanvas({ schema }: ReadOnlyCanvasProps) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  // Defer theme-aware mode until after hydration to avoid SSR/CSR mismatch.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);
  const colorMode = mounted && resolvedTheme === "dark" ? "dark" : "light";

  const nodes: Node[] = schema.tables.map((table) => ({
    id: table.id,
    type: "tableNode",
    position: table.position,
    draggable: false,
    selectable: false,
    connectable: false,
    data: {
      table,
      selected: false,
      onSelect: noop,
      onRequestDelete: noop,
      onRename: noop,
    },
  }));

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

  return (
    <div className="relative h-full w-full min-h-0">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        connectionMode={ConnectionMode.Loose}
        fitView
        colorMode={colorMode}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "smoothstep", animated: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          className="!opacity-60"
        />
        <Controls
          className="!rounded-lg !border !border-border !bg-card !shadow-sm"
          showInteractive={false}
        />
        <MiniMap
          pannable
          zoomable
          nodeBorderRadius={10}
          nodeStrokeWidth={3}
          nodeColor={(n) => {
            const table = schema.tables.find((t) => t.id === n.id);
            return table?.color ?? "var(--color-muted-foreground)";
          }}
          className="!bg-card !border !border-border !rounded-lg !shadow-sm"
        />
      </ReactFlow>
    </div>
  );
}
