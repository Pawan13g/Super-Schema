"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
import {
  Form,
  FormControl,
  FormItem,
  FormLabel,
  FormMessage,
  Controller,
} from "@/components/ui/form";
import { useSchema } from "@/lib/schema-store";

const fkFormSchema = z.object({
  targetTable: z.string().min(1, "Target table is required"),
  targetColumn: z.string().min(1, "Target column is required"),
  relType: z.enum(["one-to-one", "one-to-many", "many-to-many"]),
});

type FkFormValues = z.infer<typeof fkFormSchema>;

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
  const { schema, addRelation, updateColumn, createJunctionTable } =
    useSchema();

  const sourceTable = schema.tables.find((t) => t.id === sourceTableId);
  const sourceCol = sourceTable?.columns.find((c) => c.id === sourceColumnId);

  const initialTargetTable =
    schema.tables.find((t) => t.id !== sourceTableId)?.id ?? "";
  const initialTargetCol = schema.tables
    .find((t) => t.id === initialTargetTable)
    ?.columns.find((c) => c.constraints.includes("PRIMARY KEY"))?.name;

  const form = useForm<FkFormValues>({
    resolver: zodResolver(fkFormSchema),
    defaultValues: {
      targetTable: initialTargetTable,
      targetColumn: initialTargetCol ?? "",
      relType: "one-to-many",
    },
  });

  const targetTableId = form.watch("targetTable");
  const relType = form.watch("relType");

  const targetTableObj = schema.tables.find((t) => t.id === targetTableId);

  const handleTargetTableChange = (tableId: string | null) => {
    if (!tableId) return;
    form.setValue("targetTable", tableId);
    const tbl = schema.tables.find((t) => t.id === tableId);
    const firstPk =
      tbl?.columns.find((c) => c.constraints.includes("PRIMARY KEY"))?.id ??
      tbl?.columns[0]?.id ??
      "";
    form.setValue("targetColumn", firstPk);
  };

  const onSubmit = (values: FkFormValues) => {
    if (!sourceTable || !sourceCol || !targetTableObj) return;
    const tgtCol = targetTableObj.columns.find(
      (c) => c.id === values.targetColumn
    );
    if (!tgtCol) return;

    if (values.relType === "many-to-many") {
      createJunctionTable(
        sourceTableId,
        sourceColumnId,
        values.targetTable,
        values.targetColumn
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
        targetTable: values.targetTable,
        targetColumn: values.targetColumn,
        type: values.relType,
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

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Controller
              control={form.control}
              name="targetTable"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px]">Target table</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={handleTargetTableChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pick table">
                          {targetTableObj?.name}
                        </SelectValue>
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
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Controller
              control={form.control}
              name="targetColumn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px]">Target column</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        className="w-full"
                        disabled={!targetTableObj}
                      >
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
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Controller
            control={form.control}
            name="relType"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px]">Relationship type</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one-to-one">
                        One-to-One (1:1)
                      </SelectItem>
                      <SelectItem value="one-to-many">
                        One-to-Many (1:N)
                      </SelectItem>
                      <SelectItem value="many-to-many">
                        Many-to-Many (N:M, junction)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                {relType === "many-to-many" && (
                  <p className="text-[10px] text-muted-foreground">
                    Will auto-create a junction table; this column stays
                    unchanged.
                  </p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {relType === "many-to-many" ? "Create Junction" : "Set FK"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}
