"use client";

import { useEffect, useMemo, useState } from "react";
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader } from "@/components/ui/loader";
import { highlightSql } from "@/lib/sql-highlight";
import type { SchemaDiff } from "@/lib/schema-diff";
import type { MigrationResult, SqlDialect } from "@/lib/schema-migration";
import { useWorkspace } from "@/lib/workspace-context";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Copy,
  Check,
  Download,
  GitCompare,
  Plus,
  Minus,
  Pencil,
  Table2,
  Link2,
  AlertTriangle,
} from "lucide-react";

interface SchemaListItem {
  id: string;
  name: string;
  version: number;
  updatedAt: string;
  projectId: string;
  projectName: string;
  workspaceId: string;
  workspaceName: string;
}

interface CompareResponse {
  left: { id: string; name: string };
  right: { id: string; name: string };
  dialect: SqlDialect;
  diff: SchemaDiff;
  migration: MigrationResult;
}

interface CompareSchemasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CompareSchemasDialog({
  open,
  onOpenChange,
}: CompareSchemasDialogProps) {
  const { activeSchemaId } = useWorkspace();

  const [schemas, setSchemas] = useState<SchemaListItem[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");
  const [dialect, setDialect] = useState<SqlDialect>("postgresql");
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [activeTab, setActiveTab] = useState<"diff" | "migration">("diff");
  const [copied, setCopied] = useState(false);

  // Fetch all user-owned schemas when opened
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setLoadingList(true);
      try {
        const res = await fetch("/api/schemas");
        if (!res.ok) {
          toast.error("Failed to load schemas");
          return;
        }
        const data = (await res.json()) as { schemas: SchemaListItem[] };
        if (cancelled) return;
        setSchemas(data.schemas);
        // Default left = active schema, right = first different schema
        if (activeSchemaId && data.schemas.some((s) => s.id === activeSchemaId)) {
          setLeftId(activeSchemaId);
          const other = data.schemas.find((s) => s.id !== activeSchemaId);
          if (other) setRightId(other.id);
        } else if (data.schemas[0]) {
          setLeftId(data.schemas[0].id);
          if (data.schemas[1]) setRightId(data.schemas[1].id);
        }
      } finally {
        if (!cancelled) setLoadingList(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, activeSchemaId]);

  const pickLeft = (id: string) => {
    setLeftId(id);
    setResult(null);
  };
  const pickRight = (id: string) => {
    setRightId(id);
    setResult(null);
  };
  const pickDialect = (d: SqlDialect) => {
    setDialect(d);
    setResult(null);
  };

  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; items: SchemaListItem[] }>();
    for (const s of schemas) {
      const key = `${s.workspaceName} / ${s.projectName}`;
      const entry = map.get(key) ?? { name: key, items: [] };
      entry.items.push(s);
      map.set(key, entry);
    }
    return Array.from(map.values());
  }, [schemas]);

  const canCompare =
    leftId.length > 0 && rightId.length > 0 && leftId !== rightId && !comparing;

  const handleCompare = async () => {
    if (!canCompare) return;
    setComparing(true);
    setResult(null);
    try {
      const res = await fetch("/api/schemas/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leftId, rightId, dialect }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "Compare failed");
        return;
      }
      const data = (await res.json()) as CompareResponse;
      setResult(data);
      setActiveTab("diff");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Compare failed");
    } finally {
      setComparing(false);
    }
  };

  const handleCopySql = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result.migration.sql);
    setCopied(true);
    toast.success("Migration SQL copied");
    setTimeout(() => setCopied(false), 1500);
  };

  const handleDownloadSql = () => {
    if (!result) return;
    const ext = dialect === "postgresql" ? "pgsql" : dialect;
    const blob = new Blob([result.migration.sql], { type: "text/sql" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `migration-${result.left.name}-to-${result.right.name}.${ext}.sql`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const swapSides = () => {
    setLeftId(rightId);
    setRightId(leftId);
    setResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-h-[80vh] w-[calc(100%-2rem)] flex-col gap-3 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="size-4" />
            Compare schemas
          </DialogTitle>
          <DialogDescription>
            Pick two schemas to see add/drop/alter list and a migration SQL between them.
          </DialogDescription>
        </DialogHeader>

        {/* Picker row */}
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_auto_1fr_auto]">
          <SchemaPicker
            label="From (old)"
            value={leftId}
            onChange={pickLeft}
            grouped={grouped}
            loading={loadingList}
            otherId={rightId}
          />
          <Button
            variant="outline"
            size="icon-sm"
            onClick={swapSides}
            title="Swap"
            disabled={!leftId || !rightId}
            className="self-end"
          >
            <ArrowRight className="size-3.5" />
          </Button>
          <SchemaPicker
            label="To (new)"
            value={rightId}
            onChange={pickRight}
            grouped={grouped}
            loading={loadingList}
            otherId={leftId}
          />
          <Button onClick={handleCompare} disabled={!canCompare} className="self-end">
            {comparing ? <Loader size="xs" /> : "Compare"}
          </Button>
        </div>

        {/* Dialect selector */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Migration dialect:</span>
          <Tabs
            value={dialect}
            onValueChange={(v) => pickDialect(v as SqlDialect)}
          >
            <TabsList className="h-6">
              <TabsTrigger value="postgresql" className="h-5 px-2 text-[10px]">
                PostgreSQL
              </TabsTrigger>
              <TabsTrigger value="mysql" className="h-5 px-2 text-[10px]">
                MySQL
              </TabsTrigger>
              <TabsTrigger value="sqlite" className="h-5 px-2 text-[10px]">
                SQLite
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Result area */}
        <div className="flex-1 overflow-hidden rounded-lg border">
          {!result ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-xs text-muted-foreground">
              <GitCompare className="size-8 text-muted-foreground/30" />
              <p>
                {comparing
                  ? "Comparing schemas…"
                  : leftId === rightId && leftId
                    ? "Pick two different schemas"
                    : "Select two schemas and click Compare"}
              </p>
            </div>
          ) : (
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "diff" | "migration")}
              className="flex h-full flex-col gap-0"
            >
              <div className="flex items-center justify-between gap-2 border-b px-3 py-1">
                <TabsList className="h-6">
                  <TabsTrigger value="diff" className="h-5 gap-1 px-2 text-[10px]">
                    <Pencil className="size-3" />
                    Changes
                    <ChangeCount diff={result.diff} />
                  </TabsTrigger>
                  <TabsTrigger
                    value="migration"
                    className="h-5 gap-1 px-2 text-[10px]"
                  >
                    Migration SQL
                    {result.migration.warnings.length > 0 && (
                      <span className="rounded-full bg-amber-500/15 px-1.5 py-px text-[9px] font-semibold leading-none text-amber-600">
                        !{result.migration.warnings.length}
                      </span>
                    )}
                  </TabsTrigger>
                </TabsList>
                {activeTab === "migration" && (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={handleCopySql}
                      title="Copy SQL"
                    >
                      {copied ? (
                        <Check className="size-3 text-emerald-500" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={handleDownloadSql}
                      title="Download .sql"
                    >
                      <Download className="size-3" />
                    </Button>
                  </div>
                )}
              </div>

              <TabsContent value="diff" className="flex-1 overflow-hidden">
                <DiffView diff={result.diff} />
              </TabsContent>

              <TabsContent value="migration" className="flex-1 overflow-hidden">
                <MigrationView migration={result.migration} />
              </TabsContent>
            </Tabs>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SchemaPicker({
  label,
  value,
  onChange,
  grouped,
  loading,
  otherId,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  grouped: { name: string; items: SchemaListItem[] }[];
  loading: boolean;
  otherId: string;
}) {
  return (
    <div className="grid gap-1">
      <label className="text-[10px] font-medium text-muted-foreground">
        {label}
      </label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v ?? "")}
        disabled={loading}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder={loading ? "Loading…" : "Pick a schema"} />
        </SelectTrigger>
        <SelectContent>
          {grouped.length === 0 ? (
            <SelectGroup>
              <SelectLabel>No schemas</SelectLabel>
            </SelectGroup>
          ) : (
            grouped.map((g) => (
              <SelectGroup key={g.name}>
                <SelectLabel>{g.name}</SelectLabel>
                {g.items.map((s) => (
                  <SelectItem
                    key={s.id}
                    value={s.id}
                    disabled={s.id === otherId}
                  >
                    {s.name}
                    <span className="ml-2 text-[10px] text-muted-foreground">
                      v{s.version}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            ))
          )}
        </SelectContent>
      </Select>
    </div>
  );
}

function ChangeCount({ diff }: { diff: SchemaDiff }) {
  const adds =
    diff.summary.tablesAdded +
    diff.summary.columnsAdded +
    diff.summary.relationsAdded;
  const dels =
    diff.summary.tablesRemoved +
    diff.summary.columnsRemoved +
    diff.summary.relationsRemoved;
  const mods = diff.summary.tablesModified + diff.summary.columnsModified;
  if (adds + dels + mods === 0) return null;
  return (
    <span className="ml-0.5 inline-flex items-center gap-0.5 text-[9px] font-semibold leading-none">
      {adds > 0 && <span className="text-emerald-500">+{adds}</span>}
      {dels > 0 && <span className="text-red-500">-{dels}</span>}
      {mods > 0 && <span className="text-amber-500">~{mods}</span>}
    </span>
  );
}

function DiffView({ diff }: { diff: SchemaDiff }) {
  if (!diff.hasChanges) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-xs text-muted-foreground">
        <Check className="size-8 text-emerald-500/50" />
        <p>No differences — schemas are identical.</p>
      </div>
    );
  }
  return (
    <ScrollArea className="h-full">
      <div className="font-mono text-xs">
        {diff.tables.length > 0 && (
          <DiffSection
            title="Tables"
            icon={<Table2 className="size-3" />}
            count={diff.tables.length}
          >
            {diff.tables.map((t, i) => (
              <DiffRow
                key={i}
                kind={t.kind}
                primary={t.tableName}
                secondary={t.details?.join(", ")}
              />
            ))}
          </DiffSection>
        )}
        {diff.columns.length > 0 && (
          <DiffSection
            title="Columns"
            icon={<Pencil className="size-3" />}
            count={diff.columns.length}
          >
            {diff.columns.map((c, i) => (
              <DiffRow
                key={i}
                kind={c.kind}
                primary={`${c.tableName}.${c.columnName}`}
                secondary={c.details?.join(", ")}
              />
            ))}
          </DiffSection>
        )}
        {diff.relations.length > 0 && (
          <DiffSection
            title="Relations"
            icon={<Link2 className="size-3" />}
            count={diff.relations.length}
          >
            {diff.relations.map((r, i) => (
              <DiffRow key={i} kind={r.kind} primary={r.description} />
            ))}
          </DiffSection>
        )}
      </div>
    </ScrollArea>
  );
}

function DiffSection({
  title,
  icon,
  count,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5">
        {icon}
        <span className="font-semibold text-foreground">{title}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{count}</span>
      </div>
      {children}
    </div>
  );
}

function DiffRow({
  kind,
  primary,
  secondary,
}: {
  kind: "added" | "removed" | "modified";
  primary: string;
  secondary?: string;
}) {
  const Icon = kind === "added" ? Plus : kind === "removed" ? Minus : Pencil;
  const color =
    kind === "added"
      ? "text-emerald-500"
      : kind === "removed"
        ? "text-red-500"
        : "text-amber-500";
  const bg =
    kind === "added"
      ? "bg-emerald-500/[0.04]"
      : kind === "removed"
        ? "bg-red-500/[0.04]"
        : "";
  return (
    <div
      className={cn(
        "flex items-start gap-2 border-b border-border/30 px-3 py-1.5",
        bg
      )}
    >
      <Icon className={cn("mt-0.5 size-3 shrink-0", color)} />
      <span className="min-w-0 flex-1 text-foreground/90">{primary}</span>
      {secondary && (
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {secondary}
        </span>
      )}
    </div>
  );
}

function MigrationView({ migration }: { migration: MigrationResult }) {
  return (
    <div className="flex h-full flex-col">
      {migration.warnings.length > 0 && (
        <div className="shrink-0 border-b bg-amber-500/[0.06] px-3 py-2">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-3" />
            {migration.warnings.length} warning
            {migration.warnings.length === 1 ? "" : "s"}
          </div>
          <ul className="space-y-0.5 pl-4 text-[10px] text-amber-700/90 dark:text-amber-400/90">
            {migration.warnings.map((w, i) => (
              <li key={i} className="list-disc">
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
      <ScrollArea className="flex-1">
        <pre className="p-3 font-mono text-xs leading-relaxed">
          <code>{highlightSql(migration.sql)}</code>
        </pre>
      </ScrollArea>
    </div>
  );
}
