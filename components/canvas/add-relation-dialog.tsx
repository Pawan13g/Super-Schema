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

interface AddRelationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultSourceTable?: string;
}

export function AddRelationDialog({
  open,
  onOpenChange,
  defaultSourceTable,
}: AddRelationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {open && (
          <DialogBody
            defaultSourceTable={defaultSourceTable}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DialogBody({
  defaultSourceTable,
  onClose,
}: {
  defaultSourceTable?: string;
  onClose: () => void;
}) {
  const { schema, addRelation, updateColumn } = useSchema();

  const initialSource = defaultSourceTable ?? schema.tables[0]?.id ?? "";
  const initialTarget =
    schema.tables.find((t) => t.id !== initialSource)?.id ?? "";

  const [sourceTable, setSourceTable] = useState(initialSource);
  const [targetTable, setTargetTable] = useState(initialTarget);

  const sourceTableObj = schema.tables.find((t) => t.id === sourceTable);
  const targetTableObj = schema.tables.find((t) => t.id === targetTable);

  const defaultSourceCol =
    sourceTableObj?.columns.find(
      (c) => !c.constraints.includes("PRIMARY KEY")
    )?.name ??
    sourceTableObj?.columns[0]?.name ??
    "";
  const defaultTargetCol =
    targetTableObj?.columns.find((c) =>
      c.constraints.includes("PRIMARY KEY")
    )?.name ??
    targetTableObj?.columns[0]?.name ??
    "";

  const [sourceColumn, setSourceColumn] = useState(defaultSourceCol);
  const [targetColumn, setTargetColumn] = useState(defaultTargetCol);
  const [relType, setRelType] = useState<Relation["type"]>("one-to-many");

  const canSubmit =
    sourceTable &&
    sourceColumn &&
    targetTable &&
    targetColumn &&
    !(sourceTable === targetTable && sourceColumn === targetColumn);

  const handleCreate = () => {
    if (!canSubmit || !sourceTableObj || !targetTableObj) return;
    const srcCol = sourceTableObj.columns.find((c) => c.id === sourceColumn);
    const tgtCol = targetTableObj.columns.find((c) => c.id === targetColumn);
    if (!srcCol || !tgtCol) return;

    if (!srcCol.constraints.includes("REFERENCES")) {
      updateColumn(sourceTableObj.id, srcCol.id, {
        constraints: [...srcCol.constraints, "REFERENCES"],
        references: { table: targetTableObj.name, column: tgtCol.name },
      });
    }

    addRelation({
      sourceTable,
      sourceColumn,
      targetTable,
      targetColumn,
      type: relType,
    });

    onClose();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add Relation</DialogTitle>
        <DialogDescription>
          Connect a column on one table to a column on another. The source
          column will be marked as a foreign key.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 py-1">
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1">
            <Label className="text-[11px] text-muted-foreground">
              Source table
            </Label>
            <Select
              value={sourceTable}
              onValueChange={(v) => {
                const next = v ?? "";
                setSourceTable(next);
                const tbl = schema.tables.find((t) => t.id === next);
                const firstNonPk =
                  tbl?.columns.find(
                    (c) => !c.constraints.includes("PRIMARY KEY")
                  )?.id ??
                  tbl?.columns[0]?.id ??
                  "";
                setSourceColumn(firstNonPk);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Pick table">
                  {sourceTableObj?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {schema.tables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-[11px] text-muted-foreground">
              Source column (FK)
            </Label>
            <Select
              value={sourceColumn}
              onValueChange={(v) => setSourceColumn(v ?? "")}
              disabled={!sourceTableObj}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Pick column" />
              </SelectTrigger>
              <SelectContent>
                {sourceTableObj?.columns.map((c) => (
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
                <SelectValue placeholder="Pick table">
                  {targetTableObj?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {schema.tables.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1">
            <Label className="text-[11px] text-muted-foreground">
              Target column (PK)
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
                Many-to-Many (N:M)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={!canSubmit}>
          Create Relation
        </Button>
      </DialogFooter>
    </>
  );
}
