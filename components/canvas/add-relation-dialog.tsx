"use client";

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
import { useRelationForm } from "@/lib/hooks/use-relation-form";

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
  const { schema } = useSchema();
  const { form, onSubmit } = useRelationForm(defaultSourceTable, onClose);

  const sourceTableId = form.watch("sourceTable");
  const targetTableId = form.watch("targetTable");

  const sourceTableObj = schema.tables.find((t) => t.id === sourceTableId);
  const targetTableObj = schema.tables.find((t) => t.id === targetTableId);

  const handleSourceTableChange = (tableId: string | null) => {
    if (!tableId) return;
    form.setValue("sourceTable", tableId);
    const tbl = schema.tables.find((t) => t.id === tableId);
    const firstNonPk =
      tbl?.columns.find((c) => !c.constraints.includes("PRIMARY KEY"))?.id ??
      tbl?.columns[0]?.id ??
      "";
    form.setValue("sourceColumn", firstNonPk);
  };

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

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add Relation</DialogTitle>
        <DialogDescription>
          Connect a column on one table to a column on another. The source
          column will be marked as a foreign key.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Controller
              control={form.control}
              name="sourceTable"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px]">Source table</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={handleSourceTableChange}>
                      <SelectTrigger className="w-full text-xs">
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
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Controller
              control={form.control}
              name="sourceColumn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px]">
                    Source column (FK)
                  </FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        className="w-full text-xs"
                        disabled={!sourceTableObj}
                      >
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
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Controller
              control={form.control}
              name="targetTable"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-[11px]">Target table</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={handleTargetTableChange}>
                      <SelectTrigger className="w-full text-xs">
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
                  <FormLabel className="text-[11px]">
                    Target column (PK)
                  </FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        className="w-full text-xs"
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
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-[11px]">Relationship type</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full text-xs">
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
                        Many-to-Many (N:M)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Create Relation</Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}
