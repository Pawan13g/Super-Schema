"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useSchema } from "@/lib/schema-store";
import type { Relation } from "@/lib/types";

interface FkPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceTableId?: string;
  sourceColumnId?: string;
}

export function FkPickerDialog({
  open,
  onOpenChange,
  sourceTableId,
  sourceColumnId,
}: FkPickerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && sourceTableId && sourceColumnId && (
          <Body
            sourceTableId={sourceTableId}
            sourceColumnId={sourceColumnId}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Body({
  sourceTableId,
  sourceColumnId,
  onClose,
}: {
  sourceTableId: string;
  sourceColumnId: string;
  onClose: () => void;
}) {
  const { schema, addRelation, updateColumn, createJunctionTable } = useSchema();

  const sourceTable = schema.tables.find((t) => t.id === sourceTableId);
  const sourceCol = sourceTable?.columns.find((c) => c.id === sourceColumnId);

  const initialTarget =
    schema.tables.find((t) => t.id !== sourceTableId)?.id ?? "";
  const [targetTable, setTargetTable] = useState(initialTarget);

  const targetTableObj = schema.tables.find((t) => t.id === targetTable);
  const defaultTargetCol =
    targetTableObj?.columns.find((c) =>
      c.constraints.includes("PRIMARY KEY")
    )?.id ??
    targetTableObj?.columns[0]?.id ??
    "";
  const [targetColumn, setTargetColumn] = useState(defaultTargetCol);
  const [relType, setRelType] = useState<Relation["type"]>("one-to-many");

  const canSubmit =
    sourceTable && sourceCol && targetTableObj && targetColumn;

  const handleCreate = () => {
    if (!canSubmit) return;
    const tgtCol = targetTableObj.columns.find((c) => c.id === targetColumn);
    if (!tgtCol) return;

    if (relType === "many-to-many") {
      createJunctionTable(
        sourceTableId,
        sourceColumnId,
        targetTable,
        targetColumn
      );
    } else {
      // Mark column as FK (clear AI if present)
      const nextConstraints = sourceCol.constraints.filter(
        (c) => c !== "AUTO_INCREMENT"
      );
      if (!nextConstraints.includes("REFERENCES")) {
        nextConstraints.push("REFERENCES");
      }
      updateColumn(sourceTableId, sourceColumnId, {
        constraints: nextConstraints,
        references: { table: targetTableObj.name, column: tgtCol.name },
      });
      addRelation({
        sourceTable: sourceTableId,
        sourceColumn: sourceColumnId,
        targetTable,
        targetColumn,
        type: relType,
      });
    }
    onClose();
  };

  if (!sourceTable || !sourceCol) {
    return (
      <DialogHeader>
        <DialogTitle>Column not found</DialogTitle>
      </DialogHeader>
    );
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Make foreign key</DialogTitle>
        <DialogDescription>
          Pick the table + column that{" "}
          <span className="font-mono text-foreground">
            {sourceTable.name}.{sourceCol.name}
          </span>{" "}
          should reference.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 py-1">
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label className="text-[11px] text-muted-foreground">
              Target table
            </Label>
            <Select
              value={targetTable}
              onValueChange={(v) => {
                const next = v ?? "";
                setTargetTable(next);
                const tbl = schema.tables.find((t) => t.id === next);
                const firstPk =
                  tbl?.columns.find((c) =>
                    c.constraints.includes("PRIMARY KEY")
                  )?.id ??
                  tbl?.columns[0]?.id ??
                  "";
                setTargetColumn(firstPk);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Pick table" />
              </SelectTrigger>
              <SelectContent>
                {schema.tables
                  .filter((t) => t.id !== sourceTableId)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-[11px] text-muted-foreground">
              Target column
            </Label>
            <Select
              value={targetColumn}
              onValueChange={(v) => setTargetColumn(v ?? "")}
              disabled={!targetTableObj}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Pick column" />
              </SelectTrigger>
              <SelectContent>
                {targetTableObj?.columns.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                    <span className="ml-2 text-muted-foreground">
                      {c.type.toLowerCase()}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-1">
          <Label className="text-[11px] text-muted-foreground">
            Relationship type
          </Label>
          <Select
            value={relType}
            onValueChange={(v) => v && setRelType(v as Relation["type"])}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="one-to-one">One-to-One (1:1)</SelectItem>
              <SelectItem value="one-to-many">One-to-Many (1:N)</SelectItem>
              <SelectItem value="many-to-many">
                Many-to-Many (N:M, junction)
              </SelectItem>
            </SelectContent>
          </Select>
          {relType === "many-to-many" && (
            <p className="text-[10px] text-muted-foreground">
              Will auto-create a junction table; this column stays unchanged.
            </p>
          )}
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={!canSubmit}>
          {relType === "many-to-many" ? "Create Junction" : "Set FK"}
        </Button>
      </DialogFooter>
    </>
  );
}
