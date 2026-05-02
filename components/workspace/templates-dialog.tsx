"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSchema } from "@/lib/schema-store";
import {
  SCHEMA_TEMPLATES,
  templateToSchema,
  type SchemaTemplate,
} from "@/lib/schema-templates";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LayoutTemplate, Table2, Link2, AlertTriangle } from "lucide-react";

interface TemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplatesDialog({ open, onOpenChange }: TemplatesDialogProps) {
  const { schema, replaceSchema } = useSchema();
  const [selectedId, setSelectedId] = useState<string>(SCHEMA_TEMPLATES[0]?.id ?? "");

  const selected = SCHEMA_TEMPLATES.find((t) => t.id === selectedId) ?? null;
  const hasExistingTables = schema.tables.length > 0;

  const handleApply = () => {
    if (!selected) return;
    if (
      hasExistingTables &&
      !window.confirm(
        `This will replace ${schema.tables.length} existing table${schema.tables.length === 1 ? "" : "s"} with the "${selected.name}" template. Continue?`
      )
    ) {
      return;
    }
    const next = templateToSchema(selected);
    replaceSchema(next);
    toast.success(`Loaded "${selected.name}" template — ${next.tables.length} tables`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-h-[80vh] w-[calc(100%-2rem)] flex-col gap-3 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LayoutTemplate className="size-4" />
            Schema templates
          </DialogTitle>
          <DialogDescription>
            One-click starter schemas. Loading replaces the current canvas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden sm:grid-cols-[220px_1fr]">
          {/* Template list */}
          <ScrollArea className="rounded-lg border">
            <div className="flex flex-col p-1">
              {SCHEMA_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={cn(
                    "flex flex-col items-start gap-0.5 rounded-md px-2.5 py-2 text-left transition-colors",
                    selectedId === t.id
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <span className="text-sm font-medium">{t.name}</span>
                  <span className="line-clamp-2 text-[11px] text-muted-foreground">
                    {t.description}
                  </span>
                </button>
              ))}
            </div>
          </ScrollArea>

          {/* Preview pane */}
          <div className="flex flex-col overflow-hidden rounded-lg border">
            {selected ? (
              <TemplatePreview template={selected} />
            ) : (
              <div className="flex h-full items-center justify-center p-8 text-xs text-muted-foreground">
                Pick a template
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          {hasExistingTables ? (
            <span className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-3" />
              Loading replaces current canvas.
            </span>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={!selected}>
              {hasExistingTables ? "Replace canvas" : "Load template"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TemplatePreview({ template }: { template: SchemaTemplate }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b bg-muted/30 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{template.name}</h3>
          <div className="flex gap-1">
            {template.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-foreground/5 px-1.5 py-px text-[9px] font-medium text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {template.description}
        </p>
        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Table2 className="size-2.5" />
            {template.tables.length} tables
          </span>
          <span className="flex items-center gap-1">
            <Link2 className="size-2.5" />
            {template.relations.length} relations
          </span>
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 font-mono text-[11px]">
          {template.tables.map((t) => (
            <div key={t.name} className="mb-2 rounded-md border">
              <div className="flex items-center gap-1.5 border-b bg-muted/30 px-2 py-1">
                <Table2 className="size-3 text-primary/80" />
                <span className="font-semibold text-foreground">{t.name}</span>
                {t.comment && (
                  <span className="ml-2 truncate text-[10px] text-muted-foreground italic">
                    {t.comment}
                  </span>
                )}
              </div>
              <div>
                {t.columns.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between gap-2 border-b border-border/30 px-2 py-0.5 last:border-b-0"
                  >
                    <span className="truncate">
                      <span className="text-foreground/90">{c.name}</span>
                      {c.constraints?.includes("PRIMARY KEY") && (
                        <span className="ml-1 text-[9px] text-amber-500">PK</span>
                      )}
                      {c.constraints?.includes("REFERENCES") && (
                        <span className="ml-1 text-[9px] text-cyan-500">FK</span>
                      )}
                    </span>
                    <span className="shrink-0 text-[10px] text-muted-foreground">
                      {c.type.toLowerCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
