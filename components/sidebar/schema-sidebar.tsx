"use client";

import { useEffect, useRef, useState } from "react";
import { useSchema } from "@/lib/schema-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FkPickerDialog } from "./fk-picker-dialog";
import { LintPanel } from "./lint-panel";
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
  ChevronDown,
  GripVertical,
  Hash,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Table2,
  Trash2,
} from "lucide-react";
import {
  COLUMN_TYPES,
  type ColumnConstraint,
  type ColumnType,
} from "@/lib/types";

type TableSections = {
  fields: boolean;
  indexes: boolean;
  comments: boolean;
};

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
    addIndex,
    removeIndex,
    updateTableComment,
  } = useSchema();

  const [searchQuery, setSearchQuery] = useState("");
  const [renamingTableId, setRenamingTableId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [expandedSections, setExpandedSections] = useState<Record<string, TableSections>>({});
  const [indexDrafts, setIndexDrafts] = useState<
    Record<string, { name: string; columnId: string; unique: boolean }>
  >({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [confirmDeleteTableId, setConfirmDeleteTableId] = useState<string | null>(null);
  const [confirmDeleteColumn, setConfirmDeleteColumn] = useState<{
    tableId: string;
    columnId: string;
  } | null>(null);
  const [fkPicker, setFkPicker] = useState<{
    tableId: string;
    columnId: string;
  } | null>(null);

  useEffect(() => {
    if (renamingTableId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingTableId]);

  const filteredTables = schema.tables.filter((table) =>
    table.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSection = (tableId: string, section: keyof TableSections) => {
    setExpandedSections((prev) => {
      const current = prev[tableId] ?? {
        fields: false,
        indexes: false,
        comments: false,
      };
      return {
        ...prev,
        [tableId]: { ...current, [section]: !current[section] },
      };
    });
  };

  const beginRename = (tableId: string, currentName: string) => {
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

  const saveIndex = (
    tableId: string,
    tableName: string,
    tableColumns: { id: string; name: string }[]
  ) => {
    const draft = indexDrafts[tableId];
    const chosenColumn = tableColumns.find((column) => column.id === draft?.columnId);
    if (!chosenColumn) return;

    addIndex(tableId, {
      name: draft?.name.trim() || `idx_${tableName}_${chosenColumn.name}`,
      columns: [chosenColumn.id],
      unique: !!draft?.unique,
    });

    setIndexDrafts((prev) => ({
      ...prev,
      [tableId]: {
        name: `idx_${tableName}_${chosenColumn.name}`,
        columnId: chosenColumn.id,
        unique: false,
      },
    }));
  };

  const renderConstraintButtons = (
    tableId: string,
    col: {
      id: string;
      name: string;
      constraints: ColumnConstraint[];
      references?: { table: string; column: string };
    },
    isFk: boolean,
    isAi: boolean
  ) => {
    const pills: Array<{
      constraint: ColumnConstraint;
      label: string;
      color: string;
      disabled?: boolean;
      disabledReason?: string;
    }> = [
      { constraint: "PRIMARY KEY", label: "PK", color: "amber" },
      { constraint: "NOT NULL", label: "NN", color: "violet" },
      { constraint: "UNIQUE", label: "UQ", color: "violet" },
      {
        constraint: "AUTO_INCREMENT",
        label: "AI",
        color: "violet",
        disabled: isFk,
        disabledReason: "Disabled - column is a foreign key",
      },
      {
        constraint: "REFERENCES",
        label: "FK",
        color: "cyan",
        disabled: isAi,
        disabledReason: "Disabled - column auto-increments",
      },
    ];

    return pills.map(({ constraint, label, color, disabled, disabledReason }) => {
      const active = col.constraints.includes(constraint);
      const colorClass = active
        ? color === "amber"
          ? "bg-amber-500/15 text-amber-600"
          : color === "cyan"
            ? "bg-cyan-500/15 text-cyan-600"
            : "bg-violet-500/15 text-violet-600"
        : disabled
          ? "cursor-not-allowed text-muted-foreground/20"
          : "text-muted-foreground/40 hover:text-muted-foreground";

      return (
        <button
          key={constraint}
          type="button"
          onClick={() => {
            if (disabled) return;
            if (constraint === "REFERENCES" && !active) {
              setFkPicker({ tableId, columnId: col.id });
              return;
            }
            const next = active
              ? col.constraints.filter((entry) => entry !== constraint)
              : [...col.constraints, constraint];
            const updates: Partial<typeof col> = { constraints: next };
            if (constraint === "REFERENCES" && active) {
              updates.references = undefined;
            }
            updateColumn(tableId, col.id, updates);
          }}
          disabled={disabled}
          className={`rounded px-1 py-px text-[9px] font-semibold leading-tight transition-colors ${colorClass}`}
          title={disabled ? disabledReason : constraint}
        >
          {label}
        </button>
      );
    });
  };

  return (
    <div className="flex h-full flex-col bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="text-sm font-semibold tracking-tight text-foreground">
          Tables
        </span>
        <Button
          size="sm"
          onClick={() => addTable(`table_${schema.tables.length + 1}`)}
          className="h-7 gap-1 bg-violet-600 px-2.5 text-white shadow-sm hover:bg-violet-700"
        >
          <Plus className="size-3" />
          <span className="text-xs font-medium">Add Table</span>
        </Button>
      </div>

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

      <div className="border-b px-3 py-2">
        <LintPanel />
      </div>

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
            const firstColumn = table.columns[0];
            const tableIndexes = table.indexes ?? [];
            const indexDraft = indexDrafts[table.id] ?? {
              name: `idx_${table.name}_${firstColumn?.name ?? "field"}`,
              columnId: firstColumn?.id ?? "",
              unique: false,
            };
            const commentDraft = commentDrafts[table.id] ?? table.comment ?? "";

            const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
              e.dataTransfer.setData(
                "application/super-schema-table",
                table.id
              );
              e.dataTransfer.setData("text/plain", table.name);
              e.dataTransfer.effectAllowed = "move";
            };

            return (
              <div
                key={table.id}
                className={`border-b last:border-b-0 ${isSelected ? "bg-muted/30" : ""}`}
              >
                <div
                  className="group/table flex items-center gap-1.5 px-2 py-1.5"
                  draggable={renamingTableId !== table.id}
                  onDragStart={handleDragStart}
                  title="Drag to reposition on the canvas"
                >
                  <GripVertical className="size-3.5 shrink-0 cursor-grab text-muted-foreground/30 group-hover/table:text-muted-foreground" />
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
                      type="button"
                      onClick={() => {
                        setSelectedTableId(isSelected ? null : table.id);
                        if (!isSelected) {
                          setExpandedSections((prev) => ({
                            ...prev,
                            [table.id]: prev[table.id] ?? {
                              fields: true,
                              indexes: false,
                              comments: false,
                            },
                          }));
                        }
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        beginRename(table.id, table.name);
                      }}
                      className="flex flex-1 items-center gap-2 truncate rounded text-left text-sm hover:text-foreground"
                    >
                      <span
                        className={`flex-1 truncate ${isSelected ? "font-semibold text-foreground" : "font-medium text-foreground/90"}`}
                      >
                        {table.name}
                      </span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      beginRename(table.id, table.name);
                    }}
                    className="rounded p-0.5 text-muted-foreground/50 hover:bg-muted hover:text-foreground"
                    title="Rename table"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteTableId(table.id)}
                    className="rounded p-0.5 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                    title="Delete table"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>

                {isSelected && (
                  <div className="pb-2 pl-7 pr-3">
                    <Collapsible
                      open={sections.fields}
                      onOpenChange={() => toggleSection(table.id, "fields")}
                    >
                      <CollapsibleTrigger className="flex w-full items-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                        <ChevronDown
                          className={`size-3 transition-transform ${sections.fields ? "" : "-rotate-90"}`}
                        />
                        Fields
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="flex flex-col gap-1 pb-1">
                          {table.columns.map((col) => {
                            const isFk = col.constraints.includes("REFERENCES");
                            const isAi = col.constraints.includes("AUTO_INCREMENT");
                            return (
                              <div
                                key={col.id}
                                className="group/field flex items-center gap-1"
                              >
                                <GripVertical className="size-3 shrink-0 cursor-grab text-muted-foreground/30" />
                                <div className="flex shrink-0 gap-0.5">
                                  {renderConstraintButtons(table.id, col, isFk, isAi)}
                                </div>
                                <Input
                                  value={col.name}
                                  onChange={(e) =>
                                    updateColumn(table.id, col.id, {
                                      name: e.target.value,
                                    })
                                  }
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
                                    {COLUMN_TYPES.map((type) => (
                                      <SelectItem key={type} value={type}>
                                        {type}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <button
                                  type="button"
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
                            );
                          })}
                          {table.columns.length === 0 && (
                            <p className="py-1 text-[10px] italic text-muted-foreground/60">
                              No fields. Click Add Field below.
                            </p>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible
                      open={sections.indexes}
                      onOpenChange={() => toggleSection(table.id, "indexes")}
                    >
                      <CollapsibleTrigger className="flex w-full items-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                        <ChevronDown
                          className={`size-3 transition-transform ${sections.indexes ? "" : "-rotate-90"}`}
                        />
                        Indexes
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="flex flex-col gap-2 pb-2">
                          {tableIndexes.length === 0 ? (
                            <p className="text-[10px] text-muted-foreground/60">
                              No indexes defined.
                            </p>
                          ) : (
                            tableIndexes.map((index) => {
                              const columns = index.columns
                                .map((columnId) =>
                                  table.columns.find((column) => column.id === columnId)?.name
                                )
                                .filter((name): name is string => Boolean(name));

                              return (
                                <div
                                  key={index.id}
                                  className="flex items-center justify-between gap-2 rounded-md border bg-muted/25 px-2 py-1"
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                                      <Hash className="size-3 shrink-0 text-muted-foreground" />
                                      <span className="truncate">{index.name}</span>
                                      {index.unique && (
                                        <span className="rounded bg-violet-500/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-violet-600">
                                          Unique
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                                      {columns.join(", ") || "Unknown columns"}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeIndex(table.id, index.id)}
                                    className="shrink-0 rounded p-0.5 text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive"
                                    title="Delete index"
                                  >
                                    <Trash2 className="size-3" />
                                  </button>
                                </div>
                              );
                            })
                          )}

                          <div className="grid gap-2 rounded-md border bg-background/60 p-2">
                            <Input
                              value={indexDraft.name}
                              onChange={(e) =>
                                setIndexDrafts((prev) => ({
                                  ...prev,
                                  [table.id]: {
                                    ...indexDraft,
                                    name: e.target.value,
                                  },
                                }))
                              }
                              placeholder={`idx_${table.name}_${firstColumn?.name ?? "field"}`}
                              className="h-7 text-xs"
                            />
                            <Select
                              value={indexDraft.columnId}
                              onValueChange={(value) =>
                                setIndexDrafts((prev) => ({
                                  ...prev,
                                  [table.id]: {
                                    ...indexDraft,
                                    columnId: value ?? "",
                                  },
                                }))
                              }
                            >
                              <SelectTrigger className="h-7 w-full text-xs">
                                <SelectValue placeholder="Choose column" />
                              </SelectTrigger>
                              <SelectContent>
                                {table.columns.map((column) => (
                                  <SelectItem key={column.id} value={column.id}>
                                    {column.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex items-center gap-2">
                              <Button
                                size="xs"
                                variant={indexDraft.unique ? "default" : "outline"}
                                type="button"
                                onClick={() =>
                                  setIndexDrafts((prev) => ({
                                    ...prev,
                                    [table.id]: {
                                      ...indexDraft,
                                      unique: !indexDraft.unique,
                                    },
                                  }))
                                }
                                className="h-7 gap-1 px-2 text-[11px]"
                              >
                                <Hash className="size-3" />
                                {indexDraft.unique ? "Unique" : "Regular"}
                              </Button>
                              <Button
                                size="xs"
                                type="button"
                                onClick={() => saveIndex(table.id, table.name, table.columns)}
                                disabled={!table.columns.length}
                                className="h-7 gap-1 px-2 text-[11px]"
                              >
                                <Plus className="size-3" />
                                Add Index
                              </Button>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    <Collapsible
                      open={sections.comments}
                      onOpenChange={() => toggleSection(table.id, "comments")}
                    >
                      <CollapsibleTrigger className="flex w-full items-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                        <ChevronDown
                          className={`size-3 transition-transform ${sections.comments ? "" : "-rotate-90"}`}
                        />
                        Comments
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="flex flex-col gap-2 pb-2">
                          {table.comment ? (
                            <p className="rounded-md border bg-muted/25 px-2 py-1 text-[10px] text-muted-foreground">
                              {table.comment}
                            </p>
                          ) : (
                            <p className="text-[10px] text-muted-foreground/60">
                              No comment yet.
                            </p>
                          )}
                          <div className="grid gap-2 rounded-md border bg-background/60 p-2">
                            <textarea
                              value={commentDraft}
                              onChange={(e) =>
                                setCommentDrafts((prev) => ({
                                  ...prev,
                                  [table.id]: e.target.value,
                                }))
                              }
                              placeholder="Write a table comment..."
                              className="min-h-[72px] w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/50"
                            />
                            <div className="flex items-center gap-2">
                              <Button
                                size="xs"
                                type="button"
                                onClick={() =>
                                  updateTableComment(table.id, commentDraft.trim())
                                }
                                className="h-7 gap-1 px-2 text-[11px]"
                              >
                                <MessageSquare className="size-3" />
                                Save Comment
                              </Button>
                              <Button
                                size="xs"
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  setCommentDrafts((prev) => ({
                                    ...prev,
                                    [table.id]: "",
                                  }));
                                  updateTableComment(table.id, "");
                                }}
                                className="h-7 px-2 text-[11px]"
                              >
                                Clear
                              </Button>
                            </div>
                          </div>

                          <div className="grid gap-1.5 rounded-md border bg-background/60 p-2">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                              Field comments
                            </p>
                            {table.columns.length === 0 ? (
                              <p className="text-[10px] text-muted-foreground/60">
                                No fields available.
                              </p>
                            ) : (
                              table.columns.map((col) => (
                                <div key={col.id} className="grid gap-1">
                                  <label className="text-[10px] text-foreground/80">
                                    {col.name}
                                  </label>
                                  <Input
                                    value={col.comment ?? ""}
                                    onChange={(e) =>
                                      updateColumn(table.id, col.id, {
                                        comment: e.target.value,
                                      })
                                    }
                                    placeholder="Add field comment..."
                                    className="h-7 text-xs"
                                  />
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>

                    <div className="flex flex-wrap gap-1.5 pt-1.5">
                      <Button
                        size="xs"
                        type="button"
                        className="h-7 gap-1 bg-foreground/90 px-2.5 text-background hover:bg-foreground"
                        onClick={() => toggleSection(table.id, "indexes")}
                      >
                        <Plus className="size-3" />
                        <span className="text-[11px] font-medium">Add Index</span>
                      </Button>
                      <Button
                        size="xs"
                        type="button"
                        className="h-7 gap-1 bg-foreground/90 px-2.5 text-background hover:bg-foreground"
                        onClick={() => toggleSection(table.id, "comments")}
                      >
                        <MessageSquare className="size-3" />
                        <span className="text-[11px] font-medium">Add Comment</span>
                      </Button>
                      <Button
                        size="xs"
                        type="button"
                        className="h-7 gap-1 bg-foreground/90 px-2.5 text-background hover:bg-foreground"
                        onClick={() => addColumn(table.id)}
                      >
                        <Plus className="size-3" />
                        <span className="text-[11px] font-medium">Add Field</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <ConfirmDialog
        open={confirmDeleteTableId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteTableId(null);
        }}
        title={(() => {
          const table = schema.tables.find((entry) => entry.id === confirmDeleteTableId);
          return table ? `Delete table "${table.name}"?` : "Delete table?";
        })()}
        description={(() => {
          if (!confirmDeleteTableId) return "";
          const dependentRelations = schema.relations.filter(
            (relation) =>
              relation.sourceTable === confirmDeleteTableId ||
              relation.targetTable === confirmDeleteTableId
          ).length;
          return `This permanently removes the table and ${dependentRelations} associated relation${dependentRelations === 1 ? "" : "s"}. This cannot be undone.`;
        })()}
        confirmLabel="Delete table"
        onConfirm={() => {
          if (confirmDeleteTableId) removeTable(confirmDeleteTableId);
        }}
      />

      <FkPickerDialog
        open={fkPicker !== null}
        onOpenChange={(open) => {
          if (!open) setFkPicker(null);
        }}
        sourceTableId={fkPicker?.tableId}
        sourceColumnId={fkPicker?.columnId}
      />

      <ConfirmDialog
        open={confirmDeleteColumn !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteColumn(null);
        }}
        title="Delete field?"
        description="This permanently removes the column. Existing relations referencing it will break."
        confirmLabel="Delete field"
        onConfirm={() => {
          if (confirmDeleteColumn) {
            removeColumn(confirmDeleteColumn.tableId, confirmDeleteColumn.columnId);
          }
        }}
      />
    </div>
  );
}
