"use client";

import { useEffect, useRef, useState } from "react";
import { useSchema } from "@/lib/schema-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FkPickerDialog } from "./fk-picker-dialog";
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
  Search,
  ChevronDown,
  MoreHorizontal,
  GripVertical,
  Table2,
  Trash2,
  Pencil,
} from "lucide-react";
import {
  COLUMN_TYPES,
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
    updateTableName,
    addColumn,
    removeColumn,
    updateColumn,
  } = useSchema();

  const [searchQuery, setSearchQuery] = useState("");
  const [openMenuTableId, setOpenMenuTableId] = useState<string | null>(null);
  const [renamingTableId, setRenamingTableId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDeleteTableId, setConfirmDeleteTableId] = useState<string | null>(
    null
  );
  const [confirmDeleteColumn, setConfirmDeleteColumn] = useState<{
    tableId: string;
    columnId: string;
  } | null>(null);
  const [fkPicker, setFkPicker] = useState<{
    tableId: string;
    columnId: string;
  } | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const [expandedSections, setExpandedSections] = useState<
    Record<string, { fields: boolean; indexes: boolean; comments: boolean }>
  >({});

  useEffect(() => {
    if (renamingTableId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingTableId]);

  const startRename = (tableId: string, currentName: string) => {
    setRenamingTableId(tableId);
    setRenameDraft(currentName);
  };

  const commitRename = () => {
    if (renamingTableId) {
      const next = renameDraft.trim();
      if (next) updateTableName(renamingTableId, next);
    }
    setRenamingTableId(null);
    setRenameDraft("");
  };

  const handleAddTable = () => {
    const name = `table_${schema.tables.length + 1}`;
    addTable(name);
  };

  const toggleSection = (
    tableId: string,
    section: "fields" | "indexes" | "comments"
  ) => {
    setExpandedSections((prev) => {
      const current =
        prev[tableId] ?? { fields: false, indexes: false, comments: false };
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
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Tables
        </span>
        <Button
          size="sm"
          onClick={handleAddTable}
          className="h-7 gap-1 bg-violet-600 px-2.5 text-white shadow-sm hover:bg-violet-700"
        >
          <Plus className="size-3" />
          <span className="text-xs font-medium">Add Table</span>
        </Button>
      </div>

      {/* Search */}
      <div className="border-b px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            placeholder="search table"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 rounded-md bg-muted/40 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Table list */}
      <ScrollArea className="flex-1">
        <div className="py-1">
          {filteredTables.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              {schema.tables.length === 0
                ? "No tables yet. Click + Add Table."
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
            const menuOpen = openMenuTableId === table.id;

            return (
              <div
                key={table.id}
                className={`group/table border-b last:border-b-0 ${
                  isSelected ? "bg-muted/30" : ""
                }`}
              >
                {/* Table row */}
                <div className="relative flex items-center gap-1.5 px-2 py-1.5">
                  <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground/30 transition-colors group-hover/table:text-muted-foreground/70" />
                  <Table2
                    className="size-3.5 shrink-0"
                    style={{ color: table.color }}
                  />
                  {renamingTableId === table.id ? (
                    <Input
                      ref={renameInputRef}
                      value={renameDraft}
                      onChange={(e) => setRenameDraft(e.target.value)}
                      onBlur={commitRename}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") {
                          setRenamingTableId(null);
                          setRenameDraft("");
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="h-6 flex-1 text-sm"
                    />
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedTableId(isSelected ? null : table.id);
                        if (!isSelected) {
                          setExpandedSections((prev) => {
                            const current = prev[table.id];
                            return {
                              ...prev,
                              [table.id]:
                                current ?? {
                                  fields: true,
                                  indexes: false,
                                  comments: false,
                                },
                            };
                          });
                        }
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startRename(table.id, table.name);
                      }}
                      className="flex flex-1 items-center gap-2 truncate rounded text-left text-sm hover:text-foreground"
                      title="Click to expand, double-click to rename"
                    >
                      <span
                        className={`flex-1 truncate ${isSelected ? "font-semibold text-foreground" : "font-medium text-foreground/90"}`}
                      >
                        {table.name}
                      </span>
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuTableId(menuOpen ? null : table.id);
                    }}
                    className="rounded p-0.5 text-muted-foreground/50 opacity-0 transition-all hover:bg-muted hover:text-foreground group-hover/table:opacity-100 data-[open=true]:opacity-100"
                    data-open={menuOpen}
                  >
                    <MoreHorizontal className="size-3.5" />
                  </button>
                  {menuOpen && (
                    <>
                      <button
                        className="fixed inset-0 z-10 cursor-default"
                        onClick={() => setOpenMenuTableId(null)}
                        aria-label="close menu"
                      />
                      <div className="absolute right-2 top-7 z-20 min-w-[140px] rounded-md border bg-popover p-1 shadow-md">
                        <button
                          onClick={() => {
                            startRename(table.id, table.name);
                            setOpenMenuTableId(null);
                          }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted"
                        >
                          <Pencil className="size-3" />
                          Rename table
                        </button>
                        <button
                          onClick={() => {
                            addColumn(table.id);
                            setOpenMenuTableId(null);
                          }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted"
                        >
                          <Plus className="size-3" />
                          Add field
                        </button>
                        <div className="my-1 h-px bg-border" />
                        <button
                          onClick={() => {
                            setConfirmDeleteTableId(table.id);
                            setOpenMenuTableId(null);
                          }}
                          className="flex w-full items-center gap-2 rounded px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3" />
                          Delete table
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Expanded content */}
                {isSelected && (
                  <div className="pb-2 pl-7 pr-3">
                    {/* Fields */}
                    <Collapsible
                      open={sections.fields}
                      onOpenChange={() => toggleSection(table.id, "fields")}
                    >
                      <CollapsibleTrigger className="flex w-full items-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                        <ChevronDown
                          className={`size-3 transition-transform ${
                            sections.fields ? "" : "-rotate-90"
                          }`}
                        />
                        Fields
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="space-y-1 pb-1">
                          {table.columns.map((col) => (
                            <div
                              key={col.id}
                              className="group/field flex items-center gap-1"
                            >
                              <GripVertical className="size-3 shrink-0 cursor-grab text-muted-foreground/30 group-hover/field:text-muted-foreground/70" />

                              {/* Constraint pills */}
                              <div className="flex shrink-0 gap-0.5">
                                {(() => {
                                  const isFk =
                                    col.constraints.includes("REFERENCES");
                                  const isAi =
                                    col.constraints.includes("AUTO_INCREMENT");
                                  const PILLS: Array<{
                                    constraint: ColumnConstraint;
                                    label: string;
                                    color: string;
                                    disabled: boolean;
                                    disabledReason?: string;
                                  }> = [
                                    {
                                      constraint: "PRIMARY KEY",
                                      label: "PK",
                                      color: "amber",
                                      disabled: false,
                                    },
                                    {
                                      constraint: "NOT NULL",
                                      label: "NN",
                                      color: "violet",
                                      disabled: false,
                                    },
                                    {
                                      constraint: "UNIQUE",
                                      label: "UQ",
                                      color: "violet",
                                      disabled: false,
                                    },
                                    {
                                      constraint: "AUTO_INCREMENT",
                                      label: "AI",
                                      color: "violet",
                                      disabled: isFk,
                                      disabledReason:
                                        "Disabled — column is a foreign key",
                                    },
                                    {
                                      constraint: "REFERENCES",
                                      label: "FK",
                                      color: "cyan",
                                      disabled: isAi,
                                      disabledReason:
                                        "Disabled — column auto-increments",
                                    },
                                  ];

                                  return PILLS.map(
                                    ({
                                      constraint,
                                      label,
                                      color,
                                      disabled,
                                      disabledReason,
                                    }) => {
                                      const active =
                                        col.constraints.includes(constraint);
                                      const handleClick = () => {
                                        if (disabled) return;
                                        if (
                                          constraint === "REFERENCES" &&
                                          !active
                                        ) {
                                          // Opening FK requires picking target → open picker
                                          setFkPicker({
                                            tableId: table.id,
                                            columnId: col.id,
                                          });
                                          return;
                                        }
                                        const next = active
                                          ? col.constraints.filter(
                                              (c) => c !== constraint
                                            )
                                          : [...col.constraints, constraint];
                                        const updates: Partial<
                                          typeof col
                                        > = { constraints: next };
                                        if (
                                          constraint === "REFERENCES" &&
                                          active
                                        ) {
                                          updates.references = undefined;
                                        }
                                        updateColumn(
                                          table.id,
                                          col.id,
                                          updates
                                        );
                                      };
                                      const colorClass = active
                                        ? color === "amber"
                                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                          : color === "cyan"
                                            ? "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400"
                                            : "bg-violet-500/15 text-violet-600 dark:text-violet-400"
                                        : disabled
                                          ? "text-muted-foreground/20 cursor-not-allowed"
                                          : "text-muted-foreground/40 hover:text-muted-foreground";
                                      return (
                                        <button
                                          key={constraint}
                                          onClick={handleClick}
                                          disabled={disabled}
                                          className={`rounded px-1 py-px text-[9px] font-semibold leading-tight transition-colors ${colorClass}`}
                                          title={
                                            disabled
                                              ? disabledReason
                                              : constraint
                                          }
                                        >
                                          {label}
                                        </button>
                                      );
                                    }
                                  );
                                })()}
                              </div>

                              <Input
                                value={col.name}
                                onChange={(e) =>
                                  updateColumn(table.id, col.id, {
                                    name: e.target.value,
                                  })
                                }
                                className="h-6 min-w-0 flex-1 rounded-md bg-muted/40 px-2 text-xs"
                              />

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
                                <SelectTrigger className="h-6 w-[88px] shrink-0 rounded-md bg-muted/40 px-2 text-xs">
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

                              <button
                                onClick={() =>
                                  setConfirmDeleteColumn({
                                    tableId: table.id,
                                    columnId: col.id,
                                  })
                                }
                                className="shrink-0 rounded p-0.5 text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover/field:opacity-100"
                                title="Delete field"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                          ))}
                          {table.columns.length === 0 && (
                            <p className="py-1 text-[10px] italic text-muted-foreground/60">
                              No fields. Click Add Field below.
                            </p>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Indexes */}
                    <Collapsible
                      open={sections.indexes}
                      onOpenChange={() => toggleSection(table.id, "indexes")}
                    >
                      <CollapsibleTrigger className="flex w-full items-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
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

                    {/* Comments */}
                    <Collapsible
                      open={sections.comments}
                      onOpenChange={() => toggleSection(table.id, "comments")}
                    >
                      <CollapsibleTrigger className="flex w-full items-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
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

                    {/* Action buttons — dark pills */}
                    <div className="flex gap-1.5 pt-1.5">
                      <Button
                        size="xs"
                        className="h-7 gap-1 bg-foreground/90 px-2.5 text-background hover:bg-foreground"
                        disabled
                      >
                        <Plus className="size-3" />
                        <span className="text-[11px] font-medium">
                          Add Index
                        </span>
                      </Button>
                      <Button
                        size="xs"
                        className="h-7 gap-1 bg-foreground/90 px-2.5 text-background hover:bg-foreground"
                        onClick={() => addColumn(table.id)}
                      >
                        <Plus className="size-3" />
                        <span className="text-[11px] font-medium">
                          Add Field
                        </span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Delete table confirm */}
      <ConfirmDialog
        open={confirmDeleteTableId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteTableId(null);
        }}
        title={(() => {
          const t = schema.tables.find((x) => x.id === confirmDeleteTableId);
          return t ? `Delete table "${t.name}"?` : "Delete table?";
        })()}
        description={(() => {
          if (!confirmDeleteTableId) return "";
          const dependentRelations = schema.relations.filter(
            (r) =>
              r.sourceTable === confirmDeleteTableId ||
              r.targetTable === confirmDeleteTableId
          ).length;
          return `This permanently removes the table and ${dependentRelations} associated relation${dependentRelations === 1 ? "" : "s"}. This cannot be undone.`;
        })()}
        confirmLabel="Delete table"
        onConfirm={() => {
          if (confirmDeleteTableId) removeTable(confirmDeleteTableId);
        }}
      />

      {/* FK picker dialog */}
      <FkPickerDialog
        open={fkPicker !== null}
        onOpenChange={(open) => {
          if (!open) setFkPicker(null);
        }}
        sourceTableId={fkPicker?.tableId}
        sourceColumnId={fkPicker?.columnId}
      />

      {/* Delete column confirm */}
      <ConfirmDialog
        open={confirmDeleteColumn !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteColumn(null);
        }}
        title="Delete field?"
        description="This permanently removes the column. Existing relations referencing it will break."
        confirmLabel="Delete field"
        onConfirm={() => {
          if (confirmDeleteColumn)
            removeColumn(
              confirmDeleteColumn.tableId,
              confirmDeleteColumn.columnId
            );
        }}
      />
    </div>
  );
}
