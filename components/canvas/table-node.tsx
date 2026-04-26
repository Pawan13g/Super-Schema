"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Grid3X3 } from "lucide-react";
import type { Table } from "@/lib/types";

type TableNodeData = {
  table: Table;
  selected: boolean;
  onSelect: (id: string) => void;
};

function TableNodeComponent({ data }: NodeProps & { data: TableNodeData }) {
  const { table, selected, onSelect } = data;

  return (
    <div
      className="min-w-[220px] overflow-hidden rounded-lg border-2 bg-card text-card-foreground shadow-sm transition-shadow"
      style={{ borderColor: selected ? table.color : "var(--color-border)" }}
      onClick={() => onSelect(table.id)}
    >
      {/* Colored header */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ backgroundColor: table.color }}
      >
        <Grid3X3 className="size-3.5 text-white/80" />
        <span className="text-sm font-semibold text-white">{table.name}</span>
      </div>

      {/* Column rows */}
      <div>
        {table.columns.map((col) => (
          <div
            key={col.id}
            className="relative flex items-center justify-between border-t px-3 py-1.5"
          >
            <Handle
              type="target"
              position={Position.Left}
              id={`${col.id}-target`}
              className="!-left-[3px] !size-1.5 !rounded-full !border-none !bg-muted-foreground/40"
            />
            <span className="text-xs font-medium text-foreground">
              {col.name}
            </span>
            <span className="text-xs text-muted-foreground">{col.type.toLowerCase()}</span>
            <Handle
              type="source"
              position={Position.Right}
              id={`${col.id}-source`}
              className="!-right-[3px] !size-1.5 !rounded-full !border-none !bg-muted-foreground/40"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export const TableNode = memo(TableNodeComponent);
