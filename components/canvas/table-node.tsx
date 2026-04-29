"use client";

import { memo, useEffect, useRef, useState, type ReactElement } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Table2,
  X,
  Pencil,
  Check,
  KeyRound,
  Asterisk,
  Fingerprint,
  ArrowUp,
  Link2,
} from "lucide-react";
import type { Table } from "@/lib/types";

type TableNodeData = {
  table: Table;
  selected: boolean;
  onSelect: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onRename: (id: string, name: string) => void;
};

function TableNodeComponent({ data }: NodeProps & { data: TableNodeData }) {
  const { table, selected, onSelect, onRequestDelete, onRename } = data;
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(table.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const beginEdit = () => {
    setDraftName(table.name);
    setEditing(true);
  };

  const commitRename = () => {
    const next = draftName.trim();
    if (next && next !== table.name) onRename(table.id, next);
    else setDraftName(table.name);
    setEditing(false);
  };

  const getConstraintIndicators = (col: Table["columns"][number]) => {
    const indicators: Array<{
      key: string;
      label: string;
      icon: ReactElement;
      className: string;
    }> = [];

    if (col.constraints.includes("PRIMARY KEY")) {
      indicators.push({
        key: "pk",
        label: "Primary Key",
        icon: <KeyRound className="size-2.5" />,
        className: "text-amber-500",
      });
    }
    if (col.constraints.includes("NOT NULL")) {
      indicators.push({
        key: "nn",
        label: "Not Null",
        icon: <Asterisk className="size-2.5" />,
        className: "text-rose-500",
      });
    }
    if (col.constraints.includes("UNIQUE")) {
      indicators.push({
        key: "uq",
        label: "Unique",
        icon: <Fingerprint className="size-2.5" />,
        className: "text-violet-500",
      });
    }
    if (col.constraints.includes("AUTO_INCREMENT")) {
      indicators.push({
        key: "ai",
        label: "Auto Increment",
        icon: <ArrowUp className="size-2.5" />,
        className: "text-emerald-500",
      });
    }
    if ((col.constraints.includes("REFERENCES") || col.references)) {
      indicators.push({
        key: "fk",
        label: "Foreign Key",
        icon: <Link2 className="size-2.5" />,
        className: "text-cyan-500",
      });
    }

    return indicators;
  };

  return (
    <div
      className="group/node min-w-[220px] overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition-all hover:shadow-md"
      style={{
        borderColor: selected ? table.color : "var(--color-border)",
        boxShadow: selected ? `0 0 0 2px ${table.color}33` : undefined,
      }}
      onClick={() => onSelect(table.id)}
    >
      {/* Pastel header */}
      <div
        className="flex items-center gap-2 px-3 py-2 border-b"
        style={{
          backgroundColor: `${table.color}1f`,
          borderColor: `${table.color}33`,
        }}
      >
        <Table2 className="size-3.5 shrink-0" style={{ color: table.color }} />
        {editing ? (
          <input
            ref={inputRef}
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") commitRename();
              if (e.key === "Escape") {
                setDraftName(table.name);
                setEditing(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 min-w-0 rounded bg-background/80 px-1.5 py-0.5 text-[13px] font-semibold outline-none ring-1 ring-foreground/10 focus:ring-foreground/30"
          />
        ) : (
          <span
            className="flex-1 truncate text-[13px] font-semibold tracking-tight text-foreground"
            onDoubleClick={(e) => {
              e.stopPropagation();
              beginEdit();
            }}
            title="Double-click to rename"
          >
            {table.name}
          </span>
        )}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/node:opacity-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (editing) commitRename();
              else beginEdit();
            }}
            title={editing ? "Save name" : "Rename table"}
            className="rounded p-0.5 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
          >
            {editing ? (
              <Check className="size-3" />
            ) : (
              <Pencil className="size-3" />
            )}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRequestDelete(table.id);
            }}
            title="Delete table"
            className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="size-3" />
          </button>
        </div>
      </div>

      {/* Column rows */}
      <div className="bg-card">
        {table.columns.map((col, i) => {
          const isPk = col.constraints.includes("PRIMARY KEY");
          const indicators = getConstraintIndicators(col);
          return (
            <div
              key={col.id}
              className={`relative flex items-center justify-between gap-2 px-3 py-1.5 text-xs ${
                i > 0 ? "border-t border-border/60" : ""
              }`}
            >
              <Handle
                type="target"
                position={Position.Left}
                id={`${col.id}-target`}
                style={{ background: table.color }}
                className="!-left-[5px] !size-2.5 !rounded-full !border-2 !border-background !opacity-40 transition-opacity hover:!opacity-100 group-hover/node:!opacity-90"
              />
              <span
                className={`flex items-center gap-1 truncate font-mono ${isPk ? "font-semibold text-foreground" : "text-foreground/90"}`}
              >
                <span className="truncate">{col.name}</span>
                {indicators.length > 0 && (
                  <span className="ml-0.5 flex items-center gap-1">
                    {indicators.map((item) => (
                      <span
                        key={item.key}
                        title={item.label}
                        aria-label={item.label}
                        className={item.className}
                      >
                        {item.icon}
                      </span>
                    ))}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                {col.type.toLowerCase()}
              </span>
              <Handle
                type="source"
                position={Position.Right}
                id={`${col.id}-source`}
                style={{ background: table.color }}
                className="!-right-[5px] !size-2.5 !rounded-full !border-2 !border-background !opacity-40 transition-opacity hover:!opacity-100 group-hover/node:!opacity-90"
              />
            </div>
          );
        })}
        {table.columns.length === 0 && (
          <div className="px-3 py-2 text-[11px] italic text-muted-foreground/60">
            no columns
          </div>
        )}
      </div>
    </div>
  );
}

export const TableNode = memo(TableNodeComponent);
