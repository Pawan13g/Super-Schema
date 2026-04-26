"use client";

import { useState } from "react";
import { useSchema } from "@/lib/schema-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus,
  Trash2,
  Search,
  ChevronDown,
  MoreHorizontal,
} from "lucide-react";
import {
  COLUMN_TYPES,
  COLUMN_CONSTRAINTS,
  type ColumnType,
  type ColumnConstraint,
} from "@/lib/types";

export function SchemaSidebar() {
  const {
    schema,
    selectedTableId,
    setSelectedTableId,
    addTable,
    removeTable,
    addColumn,
    removeColumn,
    updateColumn,
  } = useSchema();

  const [newTableName, setNewTableName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedSections, setExpandedSections] = useState<
    Record<string, { fields: boolean; indexes: boolean; comments: boolean }>
  >({});

  const handleAddTable = () => {
    const name = newTableName.trim() || `table_${schema.tables.length + 1}`;
    addTable(name);
    setNewTableName("");
  };

  const toggleSection = (
    tableId: string,
    section: "fields" | "indexes" | "comments"
  ) => {
    setExpandedSections((prev) => {
      const current = prev[tableId] ?? { fields: false, indexes: false, comments: false };
      return {
        ...prev,
        [tableId]: { ...current, [section]: !current[section] },
      };
    });
  };

  const filteredTables = schema.tables.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full flex-col bg-card">
      {/* Tables header + Add button */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold text-foreground">Tables</span>
        <div className="flex items-center gap-1.5">
          <Input
            placeholder="Name..."
            value={newTableName}
            onChange={(e) => setNewTableName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddTable()}
            className="h-7 w-24 text-xs"
          />
          <Button
            size="sm"
            onClick={handleAddTable}
            className="h-7 gap-1 bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Plus className="size-3" />
            <span className="text-xs">Add Table</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="border-b px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="search table"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Table list */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {filteredTables.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              {schema.tables.length === 0
                ? "No tables yet. Add one above."
                : "No tables match your search."}
            </p>
          )}

          {filteredTables.map((table) => {
            const isSelected = selectedTableId === table.id;
            const sections = expandedSections[table.id] ?? {
              fields: false,
              indexes: false,
              comments: false,
            };

            return (
              <div key={table.id} className="border-b last:border-b-0">
                {/* Table row */}
                <button
                  onClick={() => {
                    setSelectedTableId(isSelected ? null : table.id);
                    if (!isSelected) {
                      setExpandedSections((prev) => {
                        const current = prev[table.id];
                        return {
                          ...prev,
                          [table.id]: current ?? { fields: true, indexes: false, comments: false },
                        };
                      });
                    }
                  }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/50 ${
                    isSelected ? "bg-muted/50" : ""
                  }`}
                >
                  <div
                    className="h-4 w-1 shrink-0 rounded-full"
                    style={{ backgroundColor: table.color }}
                  />
                  <span className="flex-1 truncate font-medium">
                    {table.name}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTable(table.id);
                    }}
                    className="rounded p-0.5 opacity-0 transition-opacity hover:bg-destructive/10 group-hover:opacity-100 [.border-b:hover_&]:opacity-100"
                  >
                    <MoreHorizontal className="size-3.5 text-muted-foreground" />
                  </button>
                </button>

                {/* Expanded table content */}
                {isSelected && (
                  <div className="pb-2 pl-6 pr-3">
                    {/* Fields section */}
                    <Collapsible
                      open={sections.fields}
                      onOpenChange={() =>
                        toggleSection(table.id, "fields")
                      }
                    >
                      <CollapsibleTrigger className="flex w-full items-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                        <ChevronDown
                          className={`size-3 transition-transform ${
                            sections.fields ? "" : "-rotate-90"
                          }`}
                        />
                        Fields
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="space-y-1.5 pb-2">
                          {table.columns.map((col) => (
                            <div
                              key={col.id}
                              className="flex items-center gap-1"
                            >
                              {/* Constraint toggles inline */}
                              <div className="flex shrink-0 gap-0.5">
                                {(
                                  [
                                    "PRIMARY KEY",
                                    "NOT NULL",
                                    "UNIQUE",
                                    "AUTO_INCREMENT",
                                  ] as ColumnConstraint[]
                                ).map((constraint) => {
                                  const active =
                                    col.constraints.includes(constraint);
                                  const label =
                                    constraint === "PRIMARY KEY"
                                      ? "PK"
                                      : constraint === "NOT NULL"
                                        ? "NN"
                                        : constraint === "UNIQUE"
                                          ? "UQ"
                                          : "AI";
                                  return (
                                    <button
                                      key={constraint}
                                      onClick={() => {
                                        const next = active
                                          ? col.constraints.filter(
                                              (c) => c !== constraint
                                            )
                                          : [
                                              ...col.constraints,
                                              constraint,
                                            ];
                                        updateColumn(table.id, col.id, {
                                          constraints: next,
                                        });
                                      }}
                                      className={`rounded px-1 py-px text-[9px] font-semibold leading-tight transition-colors ${
                                        active
                                          ? "bg-primary/15 text-primary"
                                          : "text-muted-foreground/40 hover:text-muted-foreground"
                                      }`}
                                      title={constraint}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Name input */}
                              <Input
                                value={col.name}
                                onChange={(e) =>
                                  updateColumn(table.id, col.id, {
                                    name: e.target.value,
                                  })
                                }
                                className="h-6 min-w-0 flex-1 border-dashed text-xs"
                              />

                              {/* Type select */}
                              <Select
                                value={col.type}
                                onValueChange={(val) => {
                                  if (val) {
                                    updateColumn(table.id, col.id, {
                                      type: val as ColumnType,
                                    });
                                  }
                                }}
                              >
                                <SelectTrigger className="h-6 w-[90px] shrink-0 border-dashed text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {COLUMN_TYPES.map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {t}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {/* Delete */}
                              <button
                                onClick={() =>
                                  removeColumn(table.id, col.id)
                                }
                                className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              >
                                <MoreHorizontal className="size-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Indexes section */}
                    <Collapsible
                      open={sections.indexes}
                      onOpenChange={() =>
                        toggleSection(table.id, "indexes")
                      }
                    >
                      <CollapsibleTrigger className="flex w-full items-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                        <ChevronDown
                          className={`size-3 transition-transform ${
                            sections.indexes ? "" : "-rotate-90"
                          }`}
                        />
                        Indexes
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <p className="pb-2 text-[10px] text-muted-foreground/60">
                          No indexes defined.
                        </p>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Comments section */}
                    <Collapsible
                      open={sections.comments}
                      onOpenChange={() =>
                        toggleSection(table.id, "comments")
                      }
                    >
                      <CollapsibleTrigger className="flex w-full items-center gap-1.5 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                        <ChevronDown
                          className={`size-3 transition-transform ${
                            sections.comments ? "" : "-rotate-90"
                          }`}
                        />
                        Comments
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <p className="pb-2 text-[10px] text-muted-foreground/60">
                          No comments.
                        </p>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Action buttons */}
                    <div className="flex gap-1.5 pt-1">
                      <Button
                        size="xs"
                        variant="outline"
                        className="h-6 text-[10px]"
                        disabled
                      >
                        Add Index
                      </Button>
                      <Button
                        size="xs"
                        variant="outline"
                        className="h-6 text-[10px]"
                        onClick={() => addColumn(table.id)}
                      >
                        Add Field
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
