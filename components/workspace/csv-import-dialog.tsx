"use client";

import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useSchema } from "@/lib/schema-store";
import {
  parseCsv,
  inferTableFromCsv,
  type InferredTable,
  type InferredColumn,
} from "@/lib/csv-infer";
import { COLUMN_TYPES, TABLE_COLORS, type ColumnType, type Column, type ColumnConstraint, type Table } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { FileUp, Upload, FileSpreadsheet, Trash2 } from "lucide-react";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

function genId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.floor(Math.random() * 10000)}`;
}

export function CsvImportDialog({ open, onOpenChange }: CsvImportDialogProps) {
  const { schema, insertTable } = useSchema();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filename, setFilename] = useState<string>("");
  const [inferred, setInferred] = useState<InferredTable | null>(null);
  const [tableName, setTableName] = useState<string>("");
  const [pkColumnName, setPkColumnName] = useState<string>("__none__");
  const [columnTypes, setColumnTypes] = useState<Record<string, ColumnType>>({});
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const reset = () => {
    setFilename("");
    setInferred(null);
    setTableName("");
    setPkColumnName("__none__");
    setColumnTypes({});
    setParseError(null);
  };

  const handleFile = async (file: File) => {
    setParseError(null);
    if (!/\.(csv|tsv|txt)$/i.test(file.name)) {
      toast.error("Pick a .csv, .tsv, or .txt file");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      toast.error("File too big (max 10 MB)");
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.headers.length === 0) {
        setParseError("No header row found.");
        return;
      }
      const result = inferTableFromCsv(parsed, file.name);
      setFilename(file.name);
      setInferred(result);
      setTableName(result.tableName);
      const initial: Record<string, ColumnType> = {};
      for (const c of result.columns) initial[c.name] = c.type;
      setColumnTypes(initial);
      // Auto-pick PK if a column looks like an id
      const idCol = result.columns.find(
        (c) =>
          c.name === "id" ||
          (c.unique && (c.type === "INT" || c.type === "BIGINT" || c.type === "UUID"))
      );
      setPkColumnName(idCol?.name ?? "__none__");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Failed to parse CSV");
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) await handleFile(file);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await handleFile(file);
  };

  const handleImport = () => {
    if (!inferred) return;
    const finalName = tableName.trim() || inferred.tableName;
    let candidate = finalName;
    let suffix = 2;
    while (schema.tables.some((t) => t.name === candidate)) {
      candidate = `${finalName}_${suffix++}`;
    }

    const columns: Column[] = inferred.columns.map((c) => {
      const constraints: ColumnConstraint[] = [];
      if (c.name === pkColumnName) constraints.push("PRIMARY KEY");
      if (!c.nullable && c.name !== pkColumnName) constraints.push("NOT NULL");
      if (c.unique && c.name !== pkColumnName) constraints.push("UNIQUE");
      return {
        id: genId("col"),
        name: c.name,
        type: columnTypes[c.name] ?? c.type,
        constraints,
        comment: c.samples.length > 0 ? `e.g. ${c.samples.join(", ")}` : "",
      };
    });

    const table: Table = {
      id: genId("tbl"),
      name: candidate,
      color: TABLE_COLORS[schema.tables.length % TABLE_COLORS.length],
      columns,
      indexes: [],
      comment: `Imported from ${filename} (${inferred.rowCount} rows).`,
      position: { x: 80 + Math.random() * 200, y: 80 + Math.random() * 200 },
    };

    insertTable(table);
    toast.success(
      `Added table "${candidate}" — ${columns.length} column${columns.length === 1 ? "" : "s"}`
    );
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="flex h-[80vh] max-h-[80vh] w-[calc(100%-2rem)] flex-col gap-3 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="size-4" />
            CSV → table
          </DialogTitle>
          <DialogDescription>
            Drop a CSV; columns and types inferred from the first 200 rows.
          </DialogDescription>
        </DialogHeader>

        {!inferred ? (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
              isDragging
                ? "border-primary bg-primary/5"
                : "border-border bg-muted/20"
            )}
          >
            <FileUp className="size-10 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium">Drop a .csv file</p>
              <p className="text-xs text-muted-foreground">
                or click to browse — max 10 MB
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
              onChange={handleFileInputChange}
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-3.5" />
              Browse
            </Button>
            {parseError && (
              <p className="text-[11px] text-destructive">{parseError}</p>
            )}
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b pb-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileSpreadsheet className="size-3.5" />
                <span className="font-medium text-foreground">{filename}</span>
                <span>•</span>
                <span>{inferred.rowCount} rows</span>
                <span>•</span>
                <span>{inferred.columns.length} columns</span>
              </div>
              <Button
                variant="ghost"
                size="xs"
                onClick={reset}
                title="Pick another file"
              >
                <Trash2 className="size-3" />
                Reset
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 py-2 sm:grid-cols-2">
              <div className="grid gap-1">
                <Label className="text-xs">Table name</Label>
                <Input
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  placeholder="Table name"
                />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs">Primary key column</Label>
                <Select value={pkColumnName} onValueChange={(v) => setPkColumnName(v ?? "__none__")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No primary key</SelectItem>
                    {inferred.columns.map((c) => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <ScrollArea className="flex-1 rounded-lg border">
              <table className="w-full font-mono text-xs">
                <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm">
                  <tr className="border-b">
                    <th className="px-2 py-1.5 text-left font-semibold">Column</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Type</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Flags</th>
                    <th className="px-2 py-1.5 text-left font-semibold">Samples</th>
                  </tr>
                </thead>
                <tbody>
                  {inferred.columns.map((c) => (
                    <ColumnRow
                      key={c.name}
                      column={c}
                      type={columnTypes[c.name] ?? c.type}
                      onTypeChange={(t) =>
                        setColumnTypes((prev) => ({ ...prev, [c.name]: t }))
                      }
                      isPk={c.name === pkColumnName}
                    />
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={!inferred}>
            Add table
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ColumnRow({
  column,
  type,
  onTypeChange,
  isPk,
}: {
  column: InferredColumn;
  type: ColumnType;
  onTypeChange: (t: ColumnType) => void;
  isPk: boolean;
}) {
  return (
    <tr className="border-b border-border/30 hover:bg-muted/40">
      <td className="px-2 py-1.5">
        <span className="text-foreground/90">{column.name}</span>
        {isPk && <span className="ml-1.5 text-[9px] text-amber-500">PK</span>}
      </td>
      <td className="px-2 py-1">
        <Select value={type} onValueChange={(v) => onTypeChange((v ?? type) as ColumnType)}>
          <SelectTrigger size="sm" className="h-6 w-[110px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COLUMN_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t.toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>
      <td className="px-2 py-1.5 text-[10px] text-muted-foreground">
        <div className="flex gap-1">
          {column.nullable && (
            <span className="rounded bg-foreground/5 px-1 py-px">nullable</span>
          )}
          {column.unique && (
            <span className="rounded bg-violet-500/10 px-1 py-px text-violet-500">
              unique
            </span>
          )}
        </div>
      </td>
      <td className="max-w-[300px] truncate px-2 py-1.5 text-[10px] text-muted-foreground">
        {column.samples.length > 0 ? column.samples.join(", ") : "—"}
      </td>
    </tr>
  );
}
