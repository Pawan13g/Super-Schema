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
import type { Relation } from "@/lib/types";
import { Link2, ArrowRightLeft } from "lucide-react";

interface RelationTypeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceTableName?: string;
  sourceColumnName?: string;
  targetTableName?: string;
  targetColumnName?: string;
  onPick: (type: Relation["type"]) => void;
}

const OPTIONS: Array<{
  value: Relation["type"];
  label: string;
  short: string;
  hint: string;
  icon: typeof Link2;
}> = [
  {
    value: "one-to-one",
    label: "One-to-One",
    short: "1:1",
    hint: "Each row in source matches exactly one row in target.",
    icon: Link2,
  },
  {
    value: "one-to-many",
    label: "One-to-Many",
    short: "1:N",
    hint: "Each target row can be referenced by many source rows.",
    icon: Link2,
  },
  {
    value: "many-to-many",
    label: "Many-to-Many",
    short: "N:M",
    hint: "Auto-creates a junction table linking both sides.",
    icon: ArrowRightLeft,
  },
];

export function RelationTypeDialog({
  open,
  onOpenChange,
  sourceTableName,
  sourceColumnName,
  targetTableName,
  targetColumnName,
  onPick,
}: RelationTypeDialogProps) {
  const [selected, setSelected] = useState<Relation["type"]>("one-to-many");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose relationship type</DialogTitle>
          <DialogDescription>
            {sourceTableName && targetTableName ? (
              <>
                <span className="font-mono text-foreground">
                  {sourceTableName}.{sourceColumnName}
                </span>{" "}
                →{" "}
                <span className="font-mono text-foreground">
                  {targetTableName}.{targetColumnName}
                </span>
              </>
            ) : (
              "Pick how these tables relate."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-1">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const active = selected === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setSelected(opt.value)}
                className={`flex items-start gap-3 rounded-md border p-3 text-left transition-all ${
                  active
                    ? "border-violet-500 bg-violet-500/5 ring-1 ring-violet-500/30"
                    : "border-border hover:border-foreground/20 hover:bg-muted/30"
                }`}
              >
                <Icon
                  className={`mt-0.5 size-4 shrink-0 ${active ? "text-violet-600 dark:text-violet-400" : "text-muted-foreground"}`}
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{opt.label}</span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                        active
                          ? "bg-violet-500/20 text-violet-700 dark:text-violet-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {opt.short}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {opt.hint}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onPick(selected);
              onOpenChange(false);
            }}
          >
            {selected === "many-to-many"
              ? "Create with Junction Table"
              : "Create Relation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
