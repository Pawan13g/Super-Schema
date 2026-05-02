import { useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
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
  const initialSourceCol =
    sourceTableObj?.columns.find(
      (c) => !c.constraints.includes("PRIMARY KEY")
    ) || sourceTableObj?.columns[0];

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
