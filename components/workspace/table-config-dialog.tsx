"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tip } from "@/components/ui/tip";
import { useSchema } from "@/lib/schema-store";
import {
  COLUMN_TYPES,
  TABLE_COLORS,
  type ColumnConstraint,
  type ColumnType,
  type Relation,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Check,
  Hash,
  KeyRound,
  Link2,
  MessageSquare,
  Plus,
  Settings,
  Table2,
  Trash2,
} from "lucide-react";

interface TableConfigDialogProps {
  tableId: string | null;
  onOpenChange: (open: boolean) => void;
}

const PILL_FULL: Record<ColumnConstraint, string> = {
  "PRIMARY KEY": "Primary Key",
  "NOT NULL": "Not Null",
  UNIQUE: "Unique",
  AUTO_INCREMENT: "Auto Increment",
  DEFAULT: "Default value",
  CHECK: "Check constraint",
  REFERENCES: "Foreign Key",
};

export function TableConfigDialog({
  tableId,
  onOpenChange,
}: TableConfigDialogProps) {
  const open = tableId !== null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-h-[80vh] w-[calc(100%-2rem)] flex-col gap-3 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="size-4" />
            Table configuration
          </DialogTitle>
          <DialogDescription>
            Edit name, color, comments, columns, indexes, and relationships in
            one place.
          </DialogDescription>
        </DialogHeader>
        {tableId && (
          <TableConfigBody
            tableId={tableId}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

type TabKey = "general" | "columns" | "indexes" | "relationships";

function TableConfigBody({
  tableId,
  onClose,
}: {
  tableId: string;
  onClose: () => void;
}) {
  const {
    schema,
    updateTableName,
    updateTableComment,
    updateTableColor,
    addColumn,
    removeColumn,
    updateColumn,
    addIndex,
    removeIndex,
    addRelation,
    removeRelation,
  } = useSchema();

  const table = schema.tables.find((t) => t.id === tableId);
  const [tab, setTab] = useState<TabKey>("general");
  const [name, setName] = useState(table?.name ?? "");
  const [comment, setComment] = useState(table?.comment ?? "");
  const [confirmDeleteCol, setConfirmDeleteCol] = useState<string | null>(null);
  const [confirmDeleteRel, setConfirmDeleteRel] = useState<string | null>(null);

  // Sync local state to incoming table changes (e.g. external rename).
  useEffect(() => {
    if (!table) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(table.name);
    setComment(table.comment ?? "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [table]);

  if (!table) {
    return (
      <p className="py-12 text-center text-xs text-muted-foreground">
        Table not found.
      </p>
    );
  }

  const commitName = () => {
    const next = name.trim();
    if (next && next !== table.name) updateTableName(tableId, next);
  };
  const commitComment = () => {
    const next = comment.trim();
    if (next !== (table.comment ?? "").trim()) updateTableComment(tableId, next);
  };

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as TabKey)} className="flex flex-1 flex-col gap-2 overflow-hidden">
      <TabsList className="h-8 self-start">
        <TabsTrigger value="general" className="gap-1 px-2.5 text-xs">
          <Table2 className="size-3" />
          General
        </TabsTrigger>
        <TabsTrigger value="columns" className="gap-1 px-2.5 text-xs">
          <KeyRound className="size-3" />
          Columns
          <span className="ml-0.5 rounded bg-foreground/10 px-1 py-px text-[9px] font-semibold">
            {table.columns.length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="indexes" className="gap-1 px-2.5 text-xs">
          <Hash className="size-3" />
          Indexes
          <span className="ml-0.5 rounded bg-foreground/10 px-1 py-px text-[9px] font-semibold">
            {(table.indexes ?? []).length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="relationships" className="gap-1 px-2.5 text-xs">
          <Link2 className="size-3" />
          Relationships
        </TabsTrigger>
      </TabsList>

      <TabsContent value="general" className="overflow-hidden">
        <ScrollArea className="h-full">
          <div className="grid gap-4 p-1">
            <div className="grid gap-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => e.key === "Enter" && commitName()}
              />
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">Color</Label>
              <div className="flex flex-wrap gap-2">
                {TABLE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updateTableColor(tableId, c)}
                    className={cn(
                      "size-7 rounded-full border-2 transition-all",
                      table.color === c
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: c }}
                    title={c}
                  >
                    {table.color === c && (
                      <Check className="size-3.5 text-white drop-shadow" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label className="flex items-center gap-1.5 text-xs">
                <MessageSquare className="size-3" />
                Comment
              </Label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onBlur={commitComment}
                placeholder="Describe what this table represents"
                className="min-h-[88px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/50"
              />
              <p className="text-[10px] text-muted-foreground">
                Saved on blur. Surfaces in canvas hover, SQL <code>COMMENT ON</code>, and exported docs.
              </p>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Stats
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <StatTile label="Columns" value={table.columns.length} />
                <StatTile label="Indexes" value={(table.indexes ?? []).length} />
                <StatTile
                  label="Relations"
                  value={
                    schema.relations.filter(
                      (r) => r.sourceTable === tableId || r.targetTable === tableId
                    ).length
                  }
                />
              </div>
            </div>
          </div>
        </ScrollArea>
      </TabsContent>

      <TabsContent value="columns" className="overflow-hidden">
        <ColumnsTab
          tableId={tableId}
          onAddColumn={() => addColumn(tableId)}
          onRemoveColumn={(colId) => setConfirmDeleteCol(colId)}
          onUpdateColumn={(colId, updates) =>
            updateColumn(tableId, colId, updates)
          }
        />
      </TabsContent>

      <TabsContent value="indexes" className="overflow-hidden">
        <IndexesTab
          tableId={tableId}
          onAddIndex={(name, columnIds, unique) =>
            addIndex(tableId, { name, columns: columnIds, unique })
          }
          onRemoveIndex={(idxId) => removeIndex(tableId, idxId)}
        />
      </TabsContent>

      <TabsContent value="relationships" className="overflow-hidden">
        <RelationshipsTab
          tableId={tableId}
          onAddRelation={(rel) => addRelation(rel)}
          onRemoveRelation={(relId) => setConfirmDeleteRel(relId)}
        />
      </TabsContent>

      <div className="flex items-center justify-end gap-2 border-t pt-2">
        <Button variant="outline" onClick={onClose}>
          Done
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDeleteCol !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmDeleteCol(null);
        }}
        title="Delete column?"
        description="This permanently removes the column. Relations referencing it may break."
        confirmLabel="Delete column"
        onConfirm={() => {
          if (confirmDeleteCol) removeColumn(tableId, confirmDeleteCol);
        }}
      />
      <ConfirmDialog
        open={confirmDeleteRel !== null}
        onOpenChange={(o) => {
          if (!o) setConfirmDeleteRel(null);
        }}
        title="Delete relation?"
        description="The foreign-key edge will be removed. Columns stay."
        confirmLabel="Delete relation"
        onConfirm={() => {
          if (confirmDeleteRel) removeRelation(confirmDeleteRel);
        }}
      />
    </Tabs>
  );
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card p-2">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-base font-semibold">{value}</p>
    </div>
  );
}

// ─── Columns tab ───

function ColumnsTab({
  tableId,
  onAddColumn,
  onRemoveColumn,
  onUpdateColumn,
}: {
  tableId: string;
  onAddColumn: () => void;
  onRemoveColumn: (colId: string) => void;
  onUpdateColumn: (
    colId: string,
    updates: Partial<{
      name: string;
      type: ColumnType;
      constraints: ColumnConstraint[];
      defaultValue: string;
      comment: string;
    }>
  ) => void;
}) {
  const { schema } = useSchema();
  const table = schema.tables.find((t) => t.id === tableId);
  if (!table) return null;

  const togglePill = (
    colId: string,
    constraints: ColumnConstraint[],
    constraint: ColumnConstraint
  ) => {
    const active = constraints.includes(constraint);
    const next = active
      ? constraints.filter((c) => c !== constraint)
      : [...constraints, constraint];
    onUpdateColumn(colId, { constraints: next });
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-2 p-1">
        {table.columns.map((col) => {
          const isFk = col.constraints.includes("REFERENCES");
          const isAi = col.constraints.includes("AUTO_INCREMENT");
          return (
            <div
              key={col.id}
              className="rounded-lg border bg-card p-3"
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px_auto]">
                <div className="grid gap-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Name
                  </Label>
                  <Input
                    value={col.name}
                    onChange={(e) =>
                      onUpdateColumn(col.id, { name: e.target.value })
                    }
                    className="h-8 text-xs"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Type
                  </Label>
                  <Select
                    value={col.type}
                    onValueChange={(v) => {
                      if (v) onUpdateColumn(col.id, { type: v as ColumnType });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
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
                </div>
                <div className="flex items-end">
                  <Tip label="Delete column">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => onRemoveColumn(col.id)}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  </Tip>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {(
                  [
                    ["PRIMARY KEY", "PK", "amber"],
                    ["NOT NULL", "NN", "violet"],
                    ["UNIQUE", "UQ", "violet"],
                    ["AUTO_INCREMENT", "AI", "violet"],
                    ["REFERENCES", "FK", "cyan"],
                  ] as [ColumnConstraint, string, "amber" | "violet" | "cyan"][]
                ).map(([c, label, color]) => {
                  const active = col.constraints.includes(c);
                  const disabled =
                    (c === "AUTO_INCREMENT" && isFk) ||
                    (c === "REFERENCES" && isAi);
                  const colorClass = active
                    ? color === "amber"
                      ? "bg-amber-500/15 text-amber-600 ring-1 ring-amber-500/30"
                      : color === "cyan"
                        ? "bg-cyan-500/15 text-cyan-600 ring-1 ring-cyan-500/30"
                        : "bg-violet-500/15 text-violet-600 ring-1 ring-violet-500/30"
                    : "text-muted-foreground/60 hover:text-muted-foreground";
                  return (
                    <Tip key={c} label={PILL_FULL[c]}>
                      <button
                        type="button"
                        onClick={() => togglePill(col.id, col.constraints, c)}
                        disabled={disabled}
                        className={cn(
                          "rounded-md px-2 py-0.5 text-[10px] font-semibold transition-all",
                          colorClass,
                          disabled && "cursor-not-allowed opacity-40"
                        )}
                      >
                        {label}
                      </button>
                    </Tip>
                  );
                })}
              </div>

              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="grid gap-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Default value
                  </Label>
                  <Input
                    value={col.defaultValue ?? ""}
                    onChange={(e) =>
                      onUpdateColumn(col.id, {
                        defaultValue: e.target.value || undefined,
                      })
                    }
                    placeholder={"e.g. 0, 'pending', CURRENT_TIMESTAMP"}
                    className="h-7 font-mono text-[11px]"
                  />
                </div>
                <div className="grid gap-1">
                  <Label className="text-[10px] text-muted-foreground">
                    Comment
                  </Label>
                  <Input
                    value={col.comment ?? ""}
                    onChange={(e) =>
                      onUpdateColumn(col.id, { comment: e.target.value })
                    }
                    placeholder="Short description"
                    className="h-7 text-[11px]"
                  />
                </div>
              </div>

              {col.references && (
                <p className="mt-2 inline-flex items-center gap-1 rounded bg-cyan-500/10 px-2 py-1 text-[10px] font-medium text-cyan-700 dark:text-cyan-400">
                  <Link2 className="size-3" />
                  References{" "}
                  <code>
                    {col.references.table}.{col.references.column}
                  </code>
                </p>
              )}
            </div>
          );
        })}

        <Button
          variant="outline"
          onClick={onAddColumn}
          className="w-full"
        >
          <Plus className="size-3.5" />
          Add column
        </Button>
      </div>
    </ScrollArea>
  );
}

// ─── Indexes tab ───

function IndexesTab({
  tableId,
  onAddIndex,
  onRemoveIndex,
}: {
  tableId: string;
  onAddIndex: (name: string, columnIds: string[], unique: boolean) => void;
  onRemoveIndex: (idxId: string) => void;
}) {
  const { schema } = useSchema();
  const table = schema.tables.find((t) => t.id === tableId);
  const [draftName, setDraftName] = useState("");
  const [draftCols, setDraftCols] = useState<string[]>([]);
  const [draftUnique, setDraftUnique] = useState(false);

  if (!table) return null;

  const toggleCol = (colId: string) => {
    setDraftCols((prev) =>
      prev.includes(colId)
        ? prev.filter((c) => c !== colId)
        : [...prev, colId]
    );
  };

  const handleAdd = () => {
    if (draftCols.length === 0) return;
    const colNames = draftCols
      .map((id) => table.columns.find((c) => c.id === id)?.name)
      .filter((n): n is string => !!n);
    const name = draftName.trim() || `idx_${table.name}_${colNames.join("_")}`;
    onAddIndex(name, draftCols, draftUnique);
    setDraftName("");
    setDraftCols([]);
    setDraftUnique(false);
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-1">
        {(table.indexes ?? []).map((idx) => {
          const colNames = idx.columns
            .map((cid) => table.columns.find((c) => c.id === cid)?.name)
            .filter((n): n is string => !!n);
          return (
            <div
              key={idx.id}
              className="flex items-center justify-between gap-2 rounded-lg border bg-card p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-semibold">
                  <Hash className="size-3.5 text-muted-foreground" />
                  {idx.name}
                  {idx.unique && (
                    <span className="rounded bg-violet-500/10 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-violet-600">
                      Unique
                    </span>
                  )}
                </div>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  ({colNames.join(", ") || "—"})
                </p>
              </div>
              <Tip label="Delete index">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRemoveIndex(idx.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </Tip>
            </div>
          );
        })}
        {(table.indexes ?? []).length === 0 && (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            No indexes defined.
          </p>
        )}

        {/* Add new */}
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            New index
          </p>
          <div className="grid gap-2">
            <Input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder={`idx_${table.name}_`}
              className="h-7 text-xs"
            />
            <div className="grid gap-1">
              <Label className="text-[10px] text-muted-foreground">
                Columns
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {table.columns.map((col) => {
                  const on = draftCols.includes(col.id);
                  return (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() => toggleCol(col.id)}
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-[11px] font-mono transition-colors",
                        on
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border bg-background text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {col.name}
                    </button>
                  );
                })}
              </div>
              {draftCols.length > 0 && (
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Order:{" "}
                  {draftCols
                    .map(
                      (id) =>
                        table.columns.find((c) => c.id === id)?.name ?? "?"
                    )
                    .join(" → ")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="xs"
                variant={draftUnique ? "default" : "outline"}
                type="button"
                onClick={() => setDraftUnique((v) => !v)}
                className="h-7 gap-1 px-2 text-[10px]"
              >
                <Hash className="size-3" />
                {draftUnique ? "Unique" : "Regular"}
              </Button>
              <Button
                size="xs"
                onClick={handleAdd}
                disabled={draftCols.length === 0}
                className="h-7 gap-1 px-2 text-[10px]"
              >
                <Plus className="size-3" />
                Add Index
              </Button>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}

// ─── Relationships tab ───

function RelationshipsTab({
  tableId,
  onAddRelation,
  onRemoveRelation,
}: {
  tableId: string;
  onAddRelation: (rel: Omit<Relation, "id">) => void;
  onRemoveRelation: (relId: string) => void;
}) {
  const { schema } = useSchema();
  const table = schema.tables.find((t) => t.id === tableId);

  // Filter relations involving this table.
  const relations = useMemo(
    () =>
      schema.relations.filter(
        (r) => r.sourceTable === tableId || r.targetTable === tableId
      ),
    [schema.relations, tableId]
  );

  // Add-relation drafting state.
  const [direction, setDirection] = useState<"out" | "in">("out");
  const [sourceCol, setSourceCol] = useState<string>("");
  const [targetTbl, setTargetTbl] = useState<string>("");
  const [targetCol, setTargetCol] = useState<string>("");
  const [relType, setRelType] = useState<Relation["type"]>("one-to-many");

  if (!table) return null;

  const otherTables = schema.tables.filter((t) => t.id !== tableId);
  const targetTable = schema.tables.find((t) => t.id === targetTbl);

  const handleAdd = () => {
    if (!sourceCol || !targetTbl || !targetCol) return;
    if (direction === "out") {
      onAddRelation({
        sourceTable: tableId,
        sourceColumn: sourceCol,
        targetTable: targetTbl,
        targetColumn: targetCol,
        type: relType,
      });
    } else {
      onAddRelation({
        sourceTable: targetTbl,
        sourceColumn: targetCol,
        targetTable: tableId,
        targetColumn: sourceCol,
        type: relType,
      });
    }
    setSourceCol("");
    setTargetTbl("");
    setTargetCol("");
  };

  return (
    <ScrollArea className="h-full">
      <div className="space-y-3 p-1">
        {/* Existing relations */}
        {relations.length === 0 ? (
          <p className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
            No relationships involving this table.
          </p>
        ) : (
          relations.map((r) => {
            const src = schema.tables.find((t) => t.id === r.sourceTable);
            const tgt = schema.tables.find((t) => t.id === r.targetTable);
            const sCol = src?.columns.find((c) => c.id === r.sourceColumn);
            const tCol = tgt?.columns.find((c) => c.id === r.targetColumn);
            const isOutgoing = r.sourceTable === tableId;
            return (
              <div
                key={r.id}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg border bg-card p-3",
                  isOutgoing ? "border-l-4 border-l-cyan-500" : "border-l-4 border-l-amber-500"
                )}
              >
                <div className="min-w-0 flex-1 font-mono text-[11px]">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-foreground">
                      {src?.name}.{sCol?.name}
                    </span>
                    <ArrowRight className="size-3 text-muted-foreground" />
                    <span className="font-semibold text-foreground">
                      {tgt?.name}.{tCol?.name}
                    </span>
                    <span className="rounded bg-foreground/10 px-1.5 py-px text-[9px] font-bold uppercase">
                      {r.type === "one-to-many"
                        ? "1:N"
                        : r.type === "one-to-one"
                          ? "1:1"
                          : "N:M"}
                    </span>
                    <span
                      className={cn(
                        "rounded px-1.5 py-px text-[9px] font-bold uppercase",
                        isOutgoing
                          ? "bg-cyan-500/10 text-cyan-600"
                          : "bg-amber-500/10 text-amber-600"
                      )}
                    >
                      {isOutgoing ? "outgoing" : "incoming"}
                    </span>
                  </div>
                </div>
                <Tip label="Delete relation">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onRemoveRelation(r.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </Tip>
              </div>
            );
          })
        )}

        {/* Add new */}
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            New relationship
          </p>
          <div className="grid gap-2">
            <div className="grid gap-1">
              <Label className="text-[10px] text-muted-foreground">
                Direction
              </Label>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setDirection("out")}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                    direction === "out"
                      ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-700 dark:text-cyan-400"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  Outgoing — {table.name} → other
                </button>
                <button
                  type="button"
                  onClick={() => setDirection("in")}
                  className={cn(
                    "flex-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                    direction === "in"
                      ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  Incoming — other → {table.name}
                </button>
              </div>
            </div>
            <div className="grid gap-1">
              <Label className="text-[10px] text-muted-foreground">
                {direction === "out" ? "FK column on this table" : "PK column on this table"}
              </Label>
              <Select value={sourceCol} onValueChange={(v) => setSourceCol(v ?? "")}>
                <SelectTrigger className="h-8 w-full text-xs">
                  <SelectValue placeholder="Choose column" />
                </SelectTrigger>
                <SelectContent>
                  {table.columns.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}{" "}
                      <span className="text-muted-foreground">
                        ({c.type.toLowerCase()})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label className="text-[10px] text-muted-foreground">
                Other table
              </Label>
              <Select
                value={targetTbl}
                onValueChange={(v) => {
                  setTargetTbl(v ?? "");
                  setTargetCol("");
                }}
              >
                <SelectTrigger className="h-8 w-full text-xs">
                  <SelectValue placeholder="Choose table" />
                </SelectTrigger>
                <SelectContent>
                  {otherTables.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {targetTable && (
              <div className="grid gap-1">
                <Label className="text-[10px] text-muted-foreground">
                  {direction === "out"
                    ? `PK column on ${targetTable.name}`
                    : `FK column on ${targetTable.name}`}
                </Label>
                <Select value={targetCol} onValueChange={(v) => setTargetCol(v ?? "")}>
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue placeholder="Choose column" />
                  </SelectTrigger>
                  <SelectContent>
                    {targetTable.columns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{" "}
                        <span className="text-muted-foreground">
                          ({c.type.toLowerCase()})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid gap-1">
              <Label className="text-[10px] text-muted-foreground">
                Cardinality
              </Label>
              <div className="flex gap-1">
                {(["one-to-one", "one-to-many", "many-to-many"] as Relation["type"][]).map(
                  (t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setRelType(t)}
                      className={cn(
                        "flex-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
                        relType === t
                          ? "border-primary/50 bg-primary/10 text-primary"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {t === "one-to-one"
                        ? "1:1"
                        : t === "one-to-many"
                          ? "1:N"
                          : "N:M"}
                    </button>
                  )
                )}
              </div>
            </div>
            <Button
              onClick={handleAdd}
              disabled={!sourceCol || !targetTbl || !targetCol}
              className="w-full"
            >
              <Plus className="size-3.5" />
              Add relationship
            </Button>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
