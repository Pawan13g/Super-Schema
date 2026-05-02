"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useSchema } from "@/lib/schema-store";
import {
  COLUMN_TYPES,
  type ColumnConstraint,
  type ColumnType,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Check,
  Columns3,
  KeyRound,
  Link2,
  MessageSquare,
  Pencil,
  ShieldCheck,
  Trash2,
  Wand2,
} from "lucide-react";

interface ColumnConfigDialogProps {
  tableId: string | null;
  columnId: string | null;
  onOpenChange: (open: boolean) => void;
  onPickFk?: () => void;
}

const PILL_FULL: Record<ColumnConstraint, string> = {
  "PRIMARY KEY": "Primary Key — uniquely identifies each row",
  "NOT NULL": "Not Null — column always has a value",
  UNIQUE: "Unique — values cannot repeat",
  AUTO_INCREMENT: "Auto Increment — DB assigns next integer",
  DEFAULT: "Default — set when no value provided",
  CHECK: "Check — custom validation expression",
  REFERENCES: "Foreign Key — links to another table",
};

const PILLS: [ColumnConstraint, string, "amber" | "violet" | "cyan"][] = [
  ["PRIMARY KEY", "PK", "amber"],
  ["NOT NULL", "NN", "violet"],
  ["UNIQUE", "UQ", "violet"],
  ["AUTO_INCREMENT", "AI", "violet"],
  ["REFERENCES", "FK", "cyan"],
];

export function ColumnConfigDialog({
  tableId,
  columnId,
  onOpenChange,
  onPickFk,
}: ColumnConfigDialogProps) {
  const open = tableId !== null && columnId !== null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[90vh] max-h-[90vh] w-[calc(100%-1rem)] flex-col gap-0 overflow-hidden p-0 sm:h-[min(85vh,720px)] sm:max-h-[85vh] sm:w-[calc(100%-2rem)] sm:max-w-2xl">
        <DialogHeader className="shrink-0 space-y-1 border-b p-4 pr-12 sm:p-5 sm:pr-12">
          <DialogTitle className="flex items-center gap-2">
            <Columns3 className="size-4" />
            Configure column
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Edit name, type, constraints, default value, foreign key, and
            check expression. Changes apply immediately.
          </DialogDescription>
        </DialogHeader>
        {tableId && columnId && (
          <ColumnConfigBody
            tableId={tableId}
            columnId={columnId}
            onClose={() => onOpenChange(false)}
            onPickFk={onPickFk}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ColumnConfigBody({
  tableId,
  columnId,
  onClose,
  onPickFk,
}: {
  tableId: string;
  columnId: string;
  onClose: () => void;
  onPickFk?: () => void;
}) {
  const { schema, updateColumn, removeColumn } = useSchema();
  const table = schema.tables.find((t) => t.id === tableId);
  const col = table?.columns.find((c) => c.id === columnId);

  const [name, setName] = useState(col?.name ?? "");
  const [comment, setComment] = useState(col?.comment ?? "");
  const [defaultValue, setDefaultValue] = useState(col?.defaultValue ?? "");
  const [checkExpr, setCheckExpr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Sync local drafts when the target column or its data changes externally.
  useEffect(() => {
    if (!col) return;
    /* eslint-disable react-hooks/set-state-in-effect */
    setName(col.name);
    setComment(col.comment ?? "");
    setDefaultValue(col.defaultValue ?? "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [col]);

  if (!table || !col) {
    return (
      <p className="py-12 text-center text-xs text-muted-foreground">
        Column not found.
      </p>
    );
  }

  const isFk = col.constraints.includes("REFERENCES");
  const isAi = col.constraints.includes("AUTO_INCREMENT");
  const isPk = col.constraints.includes("PRIMARY KEY");

  const commitName = () => {
    const next = name.trim();
    if (next && next !== col.name) updateColumn(tableId, col.id, { name: next });
  };
  const commitComment = () => {
    const next = comment.trim();
    if (next !== (col.comment ?? "").trim())
      updateColumn(tableId, col.id, { comment: next });
  };
  const commitDefault = () => {
    const next = defaultValue.trim();
    const cur = (col.defaultValue ?? "").trim();
    if (next === cur) return;
    if (next) {
      const constraints = col.constraints.includes("DEFAULT")
        ? col.constraints
        : [...col.constraints, "DEFAULT" as ColumnConstraint];
      updateColumn(tableId, col.id, { defaultValue: next, constraints });
    } else {
      const constraints = col.constraints.filter((c) => c !== "DEFAULT");
      updateColumn(tableId, col.id, { defaultValue: undefined, constraints });
    }
  };

  const togglePill = (constraint: ColumnConstraint) => {
    if (!col) return;
    const active = col.constraints.includes(constraint);
    if (constraint === "REFERENCES" && !active) {
      onPickFk?.();
      return;
    }
    const nextConstraints: ColumnConstraint[] = active
      ? col.constraints.filter((c) => c !== constraint)
      : [...col.constraints, constraint];
    if (constraint === "REFERENCES" && active) {
      updateColumn(tableId, col.id, {
        constraints: nextConstraints,
        references: undefined,
      });
    } else {
      updateColumn(tableId, col.id, { constraints: nextConstraints });
    }
  };

  const clearFk = () => {
    const next = col.constraints.filter((c) => c !== "REFERENCES");
    updateColumn(tableId, col.id, { constraints: next, references: undefined });
  };

  return (
    <>
      <ScrollArea className="min-h-0 flex-1">
      <div className="grid gap-5 p-4 sm:p-5">
        {/* Header card showing where this column lives */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 p-3">
          <span
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: table.color }}
          />
          <p className="text-xs font-mono text-foreground/80">
            <span className="font-semibold text-foreground">{table.name}</span>
            <span className="text-muted-foreground">.</span>
            <span className="font-semibold text-foreground">{col.name}</span>
          </p>
          <span className="ml-auto rounded bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {col.type}
          </span>
        </div>

        {/* Name + Type */}
        <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
          <div className="grid gap-1.5">
            <Label className="flex items-center gap-1.5 text-xs">
              <Pencil className="size-3" />
              Name
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitName();
                }
              }}
              className="font-mono text-sm"
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground">
              snake_case recommended.
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs">Type</Label>
            <Select
              value={col.type}
              onValueChange={(v) => {
                if (v) updateColumn(tableId, col.id, { type: v as ColumnType });
              }}
            >
              <SelectTrigger className="text-sm">
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
        </div>

        {/* Constraints */}
        <div className="grid gap-2">
          <Label className="flex items-center gap-1.5 text-xs">
            <ShieldCheck className="size-3" />
            Constraints
          </Label>
          <div className="flex flex-wrap gap-1.5">
            {PILLS.map(([c, label, color]) => {
              const active = col.constraints.includes(c);
              const disabled =
                (c === "AUTO_INCREMENT" && isFk) ||
                (c === "REFERENCES" && isAi);
              const colorClass = active
                ? color === "amber"
                  ? "bg-amber-500 text-amber-50 ring-1 ring-amber-500 shadow-sm"
                  : color === "cyan"
                    ? "bg-cyan-500 text-cyan-50 ring-1 ring-cyan-500 shadow-sm"
                    : "bg-violet-600 text-violet-50 ring-1 ring-violet-600 shadow-sm"
                : "border border-border bg-card text-muted-foreground hover:border-foreground/30 hover:bg-muted/50 hover:text-foreground";
              return (
                <button
                  key={c}
                  type="button"
                  title={PILL_FULL[c]}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    togglePill(c);
                  }}
                  disabled={disabled}
                  data-active={active ? "" : undefined}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all",
                    colorClass,
                    disabled && "cursor-not-allowed opacity-40"
                  )}
                >
                  {active && <Check className="size-3" />}
                  {label}
                  <span
                    className={cn(
                      "text-[9px] font-normal",
                      active ? "opacity-90" : "opacity-70"
                    )}
                  >
                    {PILL_FULL[c].split(" — ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
          {(isPk || isAi || isFk) && (
            <p className="text-[10px] text-muted-foreground">
              {isPk && "Primary keys are non-null and unique. "}
              {isAi && "Auto-increment requires an integer type. "}
              {isFk && "Foreign keys cannot also auto-increment."}
            </p>
          )}
        </div>

        {/* Default value */}
        <div className="grid gap-1.5">
          <Label className="text-xs">Default value</Label>
          <Input
            value={defaultValue}
            onChange={(e) => setDefaultValue(e.target.value)}
            onBlur={commitDefault}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitDefault();
              }
            }}
            placeholder={"e.g. 0, 'pending', CURRENT_TIMESTAMP, gen_random_uuid()"}
            className="font-mono text-xs"
          />
          <p className="text-[10px] text-muted-foreground">
            Saved on blur. Auto-toggles the <code>DEFAULT</code> constraint.
          </p>
        </div>

        {/* Foreign key reference */}
        <div className="grid gap-1.5 rounded-lg border bg-muted/20 p-3">
          <Label className="flex items-center gap-1.5 text-xs">
            <Link2 className="size-3 text-cyan-500" />
            Foreign key
          </Label>
          {col.references ? (
            <div className="flex flex-wrap items-center gap-2 rounded-md bg-cyan-500/10 px-2.5 py-1.5 font-mono text-xs text-cyan-700 dark:text-cyan-300">
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                <span className="truncate font-semibold">{col.name}</span>
                <ArrowRight className="size-3 shrink-0" />
                <span className="truncate font-semibold">
                  {col.references.table}.{col.references.column}
                </span>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-6 px-2 text-[10px]"
                  onClick={onPickFk}
                >
                  Change
                </Button>
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive"
                  onClick={clearFk}
                >
                  Clear
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={onPickFk}
              disabled={isAi}
              className="justify-start gap-2"
            >
              <Link2 className="size-3.5 text-cyan-500" />
              {isAi ? "Disabled — column auto-increments" : "Pick a target table & column"}
            </Button>
          )}
        </div>

        {/* Check constraint */}
        <div className="grid gap-1.5">
          <Label className="flex items-center gap-1.5 text-xs">
            <Wand2 className="size-3" />
            CHECK expression
          </Label>
          <Input
            value={checkExpr}
            onChange={(e) => setCheckExpr(e.target.value)}
            placeholder={`e.g. ${col.name} > 0`}
            disabled
            className="font-mono text-xs opacity-60"
          />
          <p className="text-[10px] text-muted-foreground">
            CHECK editor lives on the table&apos;s Configure dialog. Use the{" "}
            <KeyRound className="inline size-3 align-text-bottom" /> CHECK
            pill above to mark this column as participating.
          </p>
        </div>

        {/* Comment */}
        <div className="grid gap-1.5">
          <Label className="flex items-center gap-1.5 text-xs">
            <MessageSquare className="size-3" />
            Comment
          </Label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            onBlur={commitComment}
            placeholder="Describe what this column stores"
            className="min-h-[72px] w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-xs outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <p className="text-[10px] text-muted-foreground">
            Surfaces in SQL <code>COMMENT ON COLUMN</code>, generated docs,
            and exported models.
          </p>
        </div>

      </div>
      </ScrollArea>

      {/* Sticky footer pinned at bottom of dialog */}
      <div className="flex shrink-0 flex-col-reverse items-stretch gap-2 border-t bg-card/40 p-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirmDelete(true)}
          className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
          Delete column
        </Button>
        <Button onClick={onClose}>Done</Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete column "${col.name}"?`}
        description="This permanently removes the column. Relations referencing it will break."
        confirmLabel="Delete column"
        onConfirm={() => {
          removeColumn(tableId, col.id);
          onClose();
        }}
      />
    </>
  );
}
