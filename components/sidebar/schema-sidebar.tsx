"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  Columns3,
  GripVertical,
  Hash,
  KeyRound,
  Link2,
  MessageSquare,
  Pencil,
  Plus,
  Search,
  Settings,
  Table2,
  Trash2,
} from "lucide-react";
import { TableConfigDialog } from "@/components/workspace/table-config-dialog";
import { ColumnConfigDialog } from "./column-config-dialog";
import { useWorkspace } from "@/lib/workspace-context";
import { useStoredState } from "@/lib/use-stored-state";
import { Tip } from "@/components/ui/tip";
import {
  type ColumnConstraint,
  type ColumnType,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type TablePanelTab = "columns" | "indexes" | "comments";

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
    reorderColumn,
    addIndex,
    removeIndex,
    updateTableComment,
  } = useSchema();

  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [renamingTableId, setRenamingTableId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Tree expansion state per table — independent from selection. Persisted
  // as a string array (Set is not JSON-serializable).
  const [expandedTableIds, setExpandedTableIds] = useStoredState<string[]>(
    "super-schema:sidebar-expanded-tables",
    [],
    { validate: (v): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string") }
  );
  const expandedTables = useMemo(
    () => new Set(expandedTableIds),
    [expandedTableIds]
  );
  const setExpandedTables = useCallback(
    (next: Set<string> | ((prev: Set<string>) => Set<string>)) => {
      setExpandedTableIds((prev) => {
        const prevSet = new Set(prev);
        const result = typeof next === "function" ? next(prevSet) : next;
        return Array.from(result);
      });
    },
    [setExpandedTableIds]
  );
  // Active tab for the inline edit panel under the selected table.
  const [activeTab, setActiveTab] = useState<TablePanelTab>("columns");
  // Column-level selection for keyboard targeting (Enter opens config dialog).
  const [selectedColumn, setSelectedColumn] = useState<{
    tableId: string;
    columnId: string;
  } | null>(null);
  const selectedColumnRef = useRef(selectedColumn);
  useEffect(() => {
    selectedColumnRef.current = selectedColumn;
  }, [selectedColumn]);
  const selectedTableRef = useRef(selectedTableId);
  useEffect(() => {
    selectedTableRef.current = selectedTableId;
  }, [selectedTableId]);
  // Column edit dialog state.
  const [configColumn, setConfigColumn] = useState<{
    tableId: string;
    columnId: string;
  } | null>(null);

  const [indexDrafts, setIndexDrafts] = useState<
    Record<string, { name: string; columnId: string; unique: boolean }>
  >({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
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
  const [configTableId, setConfigTableId] = useState<string | null>(null);
  const { loading: workspaceLoading } = useWorkspace();

  // `/` keyboard shortcut focuses the search input (matches screenshot hint).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA" ||
        t.isContentEditable
      )
        return;
      e.preventDefault();
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Enter on selected column → open column config. Enter on selected table
  // (with no column highlighted) → open table config dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable)
      )
        return;
      const col = selectedColumnRef.current;
      if (col) {
        e.preventDefault();
        setConfigColumn(col);
        return;
      }
      const tableId = selectedTableRef.current;
      if (tableId) {
        e.preventDefault();
        setConfigTableId(tableId);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (renamingTableId) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renamingTableId]);

  const filteredTables = useMemo(
    () =>
      schema.tables.filter((table) =>
        table.name.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [schema.tables, searchQuery]
  );

  const toggleTable = (id: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const collapseAll = () => {
    setExpandedTables(new Set());
    setSelectedTableId(null);
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

  const handleSelectTable = (id: string) => {
    if (selectedTableId !== id) setSelectedTableId(id);
    if (!expandedTables.has(id)) toggleTable(id);
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      {/* Top toolbar: search + add */}
      <div className="shrink-0 space-y-2 border-b bg-card p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/70" />
          <Input
            ref={searchInputRef}
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 rounded-md bg-muted/40 pl-8 pr-7 text-xs"
          />
          <kbd className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 rounded border bg-background px-1 py-px font-mono text-[10px] font-medium text-muted-foreground">
            /
          </kbd>
        </div>
        <Button
          size="sm"
          onClick={() => {
            const id = `table_${schema.tables.length + 1}`;
            addTable(id);
          }}
          className="h-7 w-full gap-1 bg-violet-600 px-2.5 text-white shadow-sm hover:bg-violet-700"
        >
          <Plus className="size-3" />
          <span className="text-xs font-medium">Add Table</span>
        </Button>
      </div>

      {/* Scrollable tree — flat table list, no collapsible header */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex items-center gap-1.5 border-b bg-muted/30 px-3 py-1.5">
          <Table2 className="size-3 text-muted-foreground" />
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Tables
          </span>
          <span className="rounded bg-foreground/5 px-1.5 py-px text-[9px] font-medium text-muted-foreground">
            {schema.tables.length}
          </span>
          {schema.tables.length > 0 && (
            <Tip label="Collapse all">
              <button
                type="button"
                onClick={collapseAll}
                className="ml-auto inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <ChevronsDownUp className="size-3" />
              </button>
            </Tip>
          )}
        </div>

        <div className="py-1">
          {workspaceLoading && filteredTables.length === 0 && (
            <div className="space-y-1.5 px-2 py-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded px-2 py-1"
                >
                  <div className="size-3 animate-pulse rounded bg-muted" />
                  <div className="h-3 flex-1 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          )}
          {!workspaceLoading && filteredTables.length === 0 && (
            <p className="px-4 py-8 text-center text-xs text-muted-foreground">
              {schema.tables.length === 0
                ? "No tables. Click Add Table."
                : "No tables match search."}
            </p>
          )}
          {/* SCHEMA_LIST_MARKER */}

            {filteredTables.map((table) => {
              const isSelected = selectedTableId === table.id;
              const isOpen = expandedTables.has(table.id);
              const tableIndexes = table.indexes ?? [];

              const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
                e.dataTransfer.setData(
                  "application/super-schema-table",
                  table.id
                );
                e.dataTransfer.setData("text/plain", table.name);
                e.dataTransfer.effectAllowed = "move";
              };

              return (
                <div key={table.id} className="select-none">
                  {/* Table row */}
                  <div
                    className={cn(
                      "group/table flex items-center gap-1 px-2 py-1 text-[12px] transition-colors",
                      isSelected
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted/60"
                    )}
                    draggable={renamingTableId !== table.id}
                    onDragStart={handleDragStart}
                    title="Drag to reposition on the canvas"
                  >
                    <button
                      type="button"
                      onClick={() => toggleTable(table.id)}
                      className="flex size-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                    >
                      {isOpen ? (
                        <ChevronDown className="size-3" />
                      ) : (
                        <ChevronRight className="size-3" />
                      )}
                    </button>
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
                        className="h-5 flex-1 px-1 text-[12px]"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          handleSelectTable(table.id);
                          setSelectedColumn(null);
                        }}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setSelectedTableId(table.id);
                          setSelectedColumn(null);
                          setConfigTableId(table.id);
                        }}
                        className="flex flex-1 truncate text-left"
                      >
                        <span
                          className={cn(
                            "truncate",
                            isSelected
                              ? "font-semibold text-primary"
                              : "text-foreground/90"
                          )}
                        >
                          {table.name}
                        </span>
                      </button>
                    )}

                    <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/table:opacity-100">
                      <Tip label="Configure table">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfigTableId(table.id);
                          }}
                          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Settings className="size-3" />
                        </button>
                      </Tip>
                      <Tip label="Rename table">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            beginRename(table.id, table.name);
                          }}
                          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Pencil className="size-3" />
                        </button>
                      </Tip>
                      <Tip label="Delete table">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteTableId(table.id);
                          }}
                          className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </Tip>
                    </span>
                  </div>

                  {/* Tree subtree */}
                  {isOpen && (
                    <div className="relative ml-4 border-l border-border/60 pl-2">
                      {/* Columns subgroup */}
                      <SubGroupHeader
                        icon={<Columns3 className="size-3" />}
                        label="Columns"
                        count={table.columns.length}
                      />
                      <div>
                        {table.columns.length === 0 ? (
                          <div className="py-1 pl-5 text-[10px] italic text-muted-foreground/60">
                            no columns
                          </div>
                        ) : (
                          table.columns.map((col) => (
                            <ColumnRow
                              key={col.id}
                              tableId={table.id}
                              col={col}
                              isSelected={
                                selectedColumn?.tableId === table.id &&
                                selectedColumn?.columnId === col.id
                              }
                              onSelect={() => {
                                setSelectedTableId(table.id);
                                setSelectedColumn({
                                  tableId: table.id,
                                  columnId: col.id,
                                });
                              }}
                              onOpenConfig={() => {
                                setSelectedTableId(table.id);
                                setSelectedColumn({
                                  tableId: table.id,
                                  columnId: col.id,
                                });
                                setConfigColumn({
                                  tableId: table.id,
                                  columnId: col.id,
                                });
                              }}
                              onDelete={() =>
                                setConfirmDeleteColumn({
                                  tableId: table.id,
                                  columnId: col.id,
                                })
                              }
                              onReorder={(src, tgt, pos) =>
                                reorderColumn(table.id, src, tgt, pos)
                              }
                            />
                          ))
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectTable(table.id);
                            addColumn(table.id);
                          }}
                          className="ml-2 mt-0.5 inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          <Plus className="size-3" />
                          Add column
                        </button>
                      </div>

                      {/* Indexes subgroup */}
                      {tableIndexes.length > 0 || isSelected ? (
                        <>
                          <SubGroupHeader
                            icon={<Hash className="size-3" />}
                            label="Indexes"
                            count={tableIndexes.length}
                          />
                          {tableIndexes.length === 0 ? (
                            <div className="py-1 pl-5 text-[10px] italic text-muted-foreground/60">
                              no indexes
                            </div>
                          ) : (
                            tableIndexes.map((idx) => {
                              const cols = idx.columns
                                .map(
                                  (cid) =>
                                    table.columns.find((c) => c.id === cid)
                                      ?.name
                                )
                                .filter((n): n is string => !!n);
                              return (
                                <div
                                  key={idx.id}
                                  className="group/idx flex items-center gap-1.5 px-2 py-1 text-[11px] hover:bg-muted/60"
                                >
                                  <Hash className="size-3 text-muted-foreground" />
                                  <span className="truncate text-foreground/90">
                                    {idx.name}
                                  </span>
                                  <span className="ml-1 truncate text-[10px] text-muted-foreground">
                                    ({cols.join(", ")})
                                  </span>
                                  {idx.unique && (
                                    <span className="rounded bg-violet-500/10 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-violet-600">
                                      uq
                                    </span>
                                  )}
                                  <Tip label="Delete index">
                                    <button
                                      type="button"
                                      onClick={() => removeIndex(table.id, idx.id)}
                                      className="ml-auto rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/idx:opacity-100"
                                    >
                                      <Trash2 className="size-3" />
                                    </button>
                                  </Tip>
                                </div>
                              );
                            })
                          )}
                        </>
                      ) : null}

                      {/* Selected — inline editing panels */}
                      {isSelected && (
                        <SelectedTablePanel
                          activeTab={activeTab}
                          setActiveTab={setActiveTab}
                          tableId={table.id}
                          tableName={table.name}
                          tableComment={table.comment ?? ""}
                          tableColumns={table.columns.map((c) => ({
                            id: c.id,
                            name: c.name,
                            comment: c.comment ?? "",
                          }))}
                          firstColumn={table.columns[0]}
                          indexDraft={
                            indexDrafts[table.id] ?? {
                              name: `idx_${table.name}_${table.columns[0]?.name ?? "field"}`,
                              columnId: table.columns[0]?.id ?? "",
                              unique: false,
                            }
                          }
                          commentDraft={commentDrafts[table.id] ?? table.comment ?? ""}
                          onSaveIndex={() => {
                            const draft = indexDrafts[table.id];
                            const chosen = table.columns.find(
                              (c) => c.id === (draft?.columnId ?? table.columns[0]?.id)
                            );
                            if (!chosen) return;
                            addIndex(table.id, {
                              name:
                                draft?.name.trim() ||
                                `idx_${table.name}_${chosen.name}`,
                              columns: [chosen.id],
                              unique: !!draft?.unique,
                            });
                            setIndexDrafts((prev) => ({
                              ...prev,
                              [table.id]: {
                                name: `idx_${table.name}_${chosen.name}`,
                                columnId: chosen.id,
                                unique: false,
                              },
                            }));
                          }}
                          onIndexDraftChange={(d) =>
                            setIndexDrafts((prev) => ({ ...prev, [table.id]: d }))
                          }
                          onCommentDraftChange={(v) =>
                            setCommentDrafts((prev) => ({ ...prev, [table.id]: v }))
                          }
                          onSaveComment={() =>
                            updateTableComment(
                              table.id,
                              (commentDrafts[table.id] ?? "").trim()
                            )
                          }
                          onClearComment={() => {
                            setCommentDrafts((prev) => ({
                              ...prev,
                              [table.id]: "",
                            }));
                            updateTableComment(table.id, "");
                          }}
                          onUpdateColumnComment={(colId, comment) =>
                            updateColumn(table.id, colId, { comment })
                          }
                        />
                      )}
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
          const table = schema.tables.find(
            (entry) => entry.id === confirmDeleteTableId
          );
          return table ? `Delete table "${table.name}"?` : "Delete table?";
        })()}
        description={(() => {
          if (!confirmDeleteTableId) return "";
          const dependentRelations = schema.relations.filter(
            (relation) =>
              relation.sourceTable === confirmDeleteTableId ||
              relation.targetTable === confirmDeleteTableId
          ).length;
          return `This permanently removes the table and ${dependentRelations} associated relation${
            dependentRelations === 1 ? "" : "s"
          }. This cannot be undone.`;
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

      <TableConfigDialog
        tableId={configTableId}
        onOpenChange={(o) => {
          if (!o) setConfigTableId(null);
        }}
      />

      <ColumnConfigDialog
        tableId={configColumn?.tableId ?? null}
        columnId={configColumn?.columnId ?? null}
        onOpenChange={(o) => {
          if (!o) setConfigColumn(null);
        }}
        onPickFk={() => {
          if (!configColumn) return;
          setFkPicker(configColumn);
        }}
      />
    </div>
  );
}

function SubGroupHeader({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
}) {
  return (
    <div className="flex items-center gap-1.5 px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {icon}
      {label}
      <span className="rounded bg-foreground/5 px-1 py-px text-[9px] text-muted-foreground">
        {count}
      </span>
    </div>
  );
}

interface ColumnRowProps {
  tableId: string;
  col: {
    id: string;
    name: string;
    type: ColumnType;
    constraints: ColumnConstraint[];
    references?: { table: string; column: string };
  };
  isSelected: boolean;
  onSelect: () => void;
  onOpenConfig: () => void;
  onDelete: () => void;
  onReorder: (
    sourceColumnId: string,
    targetColumnId: string,
    position: "before" | "after"
  ) => void;
}

function ColumnRow({
  tableId,
  col,
  isSelected,
  onSelect,
  onOpenConfig,
  onDelete,
  onReorder,
}: ColumnRowProps) {
  const isPk = col.constraints.includes("PRIMARY KEY");
  const isFk = col.constraints.includes("REFERENCES");

  const TypeIcon = isPk ? KeyRound : isFk ? Link2 : Columns3;
  const typeColor = isPk
    ? "text-amber-500"
    : isFk
      ? "text-cyan-500"
      : "text-muted-foreground/60";

  const [dragOver, setDragOver] = useState<"before" | "after" | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const COLUMN_DND_TYPE = "application/super-schema-column";

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      onDragStart={(e) => {
        e.stopPropagation();
        e.dataTransfer.setData(
          COLUMN_DND_TYPE,
          JSON.stringify({ tableId, columnId: col.id })
        );
        e.dataTransfer.effectAllowed = "move";
        setIsDragging(true);
      }}
      onDragEnd={() => {
        setIsDragging(false);
        setDragOver(null);
      }}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes(COLUMN_DND_TYPE)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        const rect = e.currentTarget.getBoundingClientRect();
        const offset = e.clientY - rect.top;
        setDragOver(offset < rect.height / 2 ? "before" : "after");
      }}
      onDragLeave={(e) => {
        // Ignore leave events for child elements within the row.
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return;
        setDragOver(null);
      }}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData(COLUMN_DND_TYPE);
        setDragOver(null);
        if (!raw) return;
        e.preventDefault();
        e.stopPropagation();
        try {
          const payload = JSON.parse(raw) as {
            tableId: string;
            columnId: string;
          };
          if (payload.tableId !== tableId) return;
          if (payload.columnId === col.id) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const offset = e.clientY - rect.top;
          const position = offset < rect.height / 2 ? "before" : "after";
          onReorder(payload.columnId, col.id, position);
        } catch {
          /* ignore */
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onOpenConfig();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          onOpenConfig();
        }
      }}
      className={cn(
        "group/col relative flex w-full cursor-pointer items-center gap-1.5 px-2 py-0.5 text-[11px] outline-none transition-colors",
        isSelected
          ? "bg-primary/10 ring-1 ring-inset ring-primary/30"
          : "hover:bg-muted/60 focus-visible:bg-muted/60",
        isDragging && "opacity-40"
      )}
      title="Drag to reorder · double-click or Enter to edit"
    >
      {dragOver && (
        <span
          className={cn(
            "pointer-events-none absolute inset-x-1 h-0.5 rounded-full bg-primary",
            dragOver === "before" ? "-top-px" : "-bottom-px"
          )}
        />
      )}
      <GripVertical className="size-3 shrink-0 cursor-grab text-muted-foreground/30 opacity-0 transition-opacity group-hover/col:opacity-100 active:cursor-grabbing" />
      <TypeIcon className={cn("size-3 shrink-0", typeColor)} />
      <span
        className={cn(
          "truncate font-mono",
          isPk ? "font-semibold text-foreground" : "text-foreground/90",
          isSelected && "text-primary"
        )}
      >
        {col.name}
      </span>
      {col.constraints.includes("NOT NULL") && (
        <span className="text-[8px] text-rose-500">*</span>
      )}
      <span className="ml-auto truncate font-mono text-[10px] text-muted-foreground">
        {col.type.toLowerCase()}
      </span>
      <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/col:opacity-100">
        <Tip label="Edit column">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenConfig();
            }}
            className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="size-3" />
          </button>
        </Tip>
        <Tip label="Delete column">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3" />
          </button>
        </Tip>
      </span>
    </div>
  );
}

// ─── Inline editing panel for the selected table ─────────────────────────

interface SelectedTablePanelProps {
  activeTab: TablePanelTab;
  setActiveTab: (t: TablePanelTab) => void;
  tableId: string;
  tableName: string;
  tableComment: string;
  tableColumns: { id: string; name: string; comment: string }[];
  firstColumn: { id: string; name: string } | undefined;
  indexDraft: { name: string; columnId: string; unique: boolean };
  commentDraft: string;
  onSaveIndex: () => void;
  onIndexDraftChange: (d: { name: string; columnId: string; unique: boolean }) => void;
  onCommentDraftChange: (v: string) => void;
  onSaveComment: () => void;
  onClearComment: () => void;
  onUpdateColumnComment: (colId: string, comment: string) => void;
}

function SelectedTablePanel({
  activeTab,
  setActiveTab,
  tableName,
  tableComment,
  tableColumns,
  firstColumn,
  indexDraft,
  commentDraft,
  onSaveIndex,
  onIndexDraftChange,
  onCommentDraftChange,
  onSaveComment,
  onClearComment,
  onUpdateColumnComment,
}: SelectedTablePanelProps) {
  return (
    <div className="mt-2 rounded-md border bg-card/60">
      <div className="flex items-center gap-1 border-b px-1 py-1">
        {(["columns", "indexes", "comments"] as TablePanelTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "rounded px-2 py-0.5 text-[11px] font-medium transition-colors",
              activeTab === tab
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {tab === "columns"
              ? "Columns"
              : tab === "indexes"
                ? "Indexes"
                : "Comments"}
          </button>
        ))}
      </div>

      {activeTab === "indexes" && (
        <div className="grid gap-2 p-2">
          <Input
            value={indexDraft.name}
            onChange={(e) =>
              onIndexDraftChange({ ...indexDraft, name: e.target.value })
            }
            placeholder={`idx_${tableName}_${firstColumn?.name ?? "field"}`}
            className="h-7 text-[11px]"
          />
          <Select
            value={indexDraft.columnId}
            onValueChange={(value) =>
              onIndexDraftChange({ ...indexDraft, columnId: value ?? "" })
            }
          >
            <SelectTrigger className="h-7 w-full text-[11px]">
              <SelectValue placeholder="Choose column" />
            </SelectTrigger>
            <SelectContent>
              {tableColumns.map((column) => (
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
                onIndexDraftChange({ ...indexDraft, unique: !indexDraft.unique })
              }
              className="h-6 gap-1 px-2 text-[10px]"
            >
              <Hash className="size-3" />
              {indexDraft.unique ? "Unique" : "Regular"}
            </Button>
            <Button
              size="xs"
              type="button"
              onClick={onSaveIndex}
              disabled={!tableColumns.length}
              className="h-6 gap-1 px-2 text-[10px]"
            >
              <Plus className="size-3" />
              Add Index
            </Button>
          </div>
        </div>
      )}

      {activeTab === "comments" && (
        <div className="grid gap-2 p-2">
          {tableComment ? (
            <p className="rounded-md border bg-muted/25 px-2 py-1 text-[10px] text-muted-foreground">
              {tableComment}
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground/60">
              No table comment yet.
            </p>
          )}
          <textarea
            value={commentDraft}
            onChange={(e) => onCommentDraftChange(e.target.value)}
            placeholder="Write a table comment"
            className="min-h-[64px] w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-[11px] outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <div className="flex items-center gap-2">
            <Button
              size="xs"
              type="button"
              onClick={onSaveComment}
              className="h-6 gap-1 px-2 text-[10px]"
            >
              <MessageSquare className="size-3" />
              Save Comment
            </Button>
            <Button
              size="xs"
              type="button"
              variant="outline"
              onClick={onClearComment}
              className="h-6 px-2 text-[10px]"
            >
              Clear
            </Button>
          </div>

          <div className="grid gap-1.5 rounded-md border bg-background/60 p-2">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Field comments
            </p>
            {tableColumns.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/60">
                No fields available.
              </p>
            ) : (
              tableColumns.map((col) => (
                <div key={col.id} className="grid gap-1">
                  <label className="text-[10px] text-foreground/80">
                    {col.name}
                  </label>
                  <Input
                    value={col.comment}
                    onChange={(e) =>
                      onUpdateColumnComment(col.id, e.target.value)
                    }
                    placeholder="Add field comment"
                    className="h-6 text-[11px]"
                  />
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === "columns" && (
        <p className="px-2 py-2 text-[10px] text-muted-foreground/70">
          Click any column row above to edit name, type, and constraints.
        </p>
      )}
    </div>
  );
}
