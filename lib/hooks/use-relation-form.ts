import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { useSchema } from "@/lib/schema-store";

const relationFormSchema = z.object({
  sourceTable: z.string().min(1, "Source table is required"),
  sourceColumn: z.string().min(1, "Source column is required"),
  targetTable: z.string().min(1, "Target table is required"),
  targetColumn: z.string().min(1, "Target column is required"),
  type: z.enum(["one-to-one", "one-to-many", "many-to-many"]),
});

export type RelationFormValues = z.infer<typeof relationFormSchema>;

export function useRelationForm(
  defaultSourceTable?: string,
  onSuccess?: () => void
) {
  const { schema, addRelation, updateColumn, createJunctionTable } =
    useSchema();

  const sourceTableObj =
    schema.tables.find((t) => t.id === defaultSourceTable) || schema.tables[0];
  // Default source column to the first NON-PK column. If the table only
  // has PK columns, leave the field empty rather than falling back to a
  // PK — picking the PK as the FK source produces a circular self-FK and
  // is almost never what the user wants. The submit handler also rejects
  // PK-only sources with a toast so the user gets a clear reason.
  const initialSourceCol = sourceTableObj?.columns.find(
    (c) => !c.constraints.includes("PRIMARY KEY")
  );

  const form = useForm<RelationFormValues>({
    resolver: zodResolver(relationFormSchema),
    defaultValues: {
      sourceTable: sourceTableObj?.id ?? "",
      sourceColumn: initialSourceCol?.id ?? "",
      targetTable:
        schema.tables.find((t) => t.id !== sourceTableObj?.id)?.id ?? "",
      targetColumn: "",
      type: "one-to-many",
    },
  });

  const onSubmit = useCallback(
    (values: RelationFormValues) => {
      const sourceTableData = schema.tables.find(
        (t) => t.id === values.sourceTable
      );
      const targetTableData = schema.tables.find(
        (t) => t.id === values.targetTable
      );
      const sourceCol = sourceTableData?.columns.find(
        (c) => c.id === values.sourceColumn
      );
      const targetCol = targetTableData?.columns.find(
        (c) => c.id === values.targetColumn
      );

      if (!sourceTableData || !targetTableData || !sourceCol || !targetCol)
        return;

      // Reject PK → anything FKs. The source column of a FK should be a
      // non-PK column on the child table; picking the PK creates the
      // table's-own-id-as-FK case, which is a no-op or worse a self-loop.
      if (sourceCol.constraints.includes("PRIMARY KEY")) {
        toast.error(
          `"${sourceCol.name}" is the primary key of ${sourceTableData.name}. Pick a non-PK column as the FK source, or add one first.`
        );
        return;
      }

      if (values.type === "many-to-many") {
        createJunctionTable(
          values.sourceTable,
          values.sourceColumn,
          values.targetTable,
          values.targetColumn
        );
      } else {
        // Mark source column as FK
        const nextConstraints = sourceCol.constraints.filter(
          (c) => c !== "AUTO_INCREMENT"
        );
        if (!nextConstraints.includes("REFERENCES")) {
          nextConstraints.push("REFERENCES");
        }
        updateColumn(values.sourceTable, values.sourceColumn, {
          constraints: nextConstraints,
          references: {
            table: targetTableData.name,
            column: targetCol.name,
          },
        });

        addRelation({
          sourceTable: values.sourceTable,
          sourceColumn: values.sourceColumn,
          targetTable: values.targetTable,
          targetColumn: values.targetColumn,
          type: values.type,
        });
      }

      onSuccess?.();
    },
    [schema.tables, addRelation, updateColumn, createJunctionTable, onSuccess]
  );

  return { form, onSubmit };
}
