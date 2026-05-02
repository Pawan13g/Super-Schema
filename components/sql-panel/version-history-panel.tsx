"use client";

import { useCallback, useEffect, useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { useSchema } from "@/lib/schema-store";
import { diffSchemas, type SchemaDiff } from "@/lib/schema-diff";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  History,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  Plus,
  Minus,
  Pencil,
  Table2,
  Link2,
  ArrowLeft,
  Clock,
  GitCompare,
  Trash2,
  Eraser,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import type { Schema } from "@/lib/types";

interface VersionItem {
  id: string;
  version: number;
  createdAt: string;
  tableCount: number;
  relationCount: number;
}

type PanelView = "list" | "diff";

export function VersionHistoryPanel() {
  const { activeSchemaId } = useWorkspace();
  const { schema: currentSchema, replaceSchema } = useSchema();

  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [currentVersion, setCurrentVersion] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<PanelView>("list");

  // Diff state
  const [diffVersionA, setDiffVersionA] = useState<VersionItem | null>(null);
  const [diffVersionB, setDiffVersionB] = useState<VersionItem | null>(null);
  const [diff, setDiff] = useState<SchemaDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);

  // Delete confirms
  const [deleteTarget, setDeleteTarget] = useState<VersionItem | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const fetchVersions = useCallback(async () => {
    if (!activeSchemaId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/schemas/${activeSchemaId}/versions`);
      if (!res.ok) return;
      const data = await res.json();
      setVersions(data.versions);
      setCurrentVersion(data.currentVersion);
    } finally {
      setLoading(false);
    }
  }, [activeSchemaId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const handleDeleteOne = async (v: VersionItem) => {
    if (!activeSchemaId) return;
    try {
      const res = await fetch(
        `/api/schemas/${activeSchemaId}/versions/${v.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        toast.error("Failed to delete version");
        return;
      }
      toast.success(`Deleted v${v.version}`);
      await fetchVersions();
    } catch {
      toast.error("Failed to delete version");
    }
  };

  const handleClearAll = async () => {
    if (!activeSchemaId) return;
    try {
      const res = await fetch(`/api/schemas/${activeSchemaId}/versions`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Failed to clear history");
        return;
      }
      const data = (await res.json()) as { deleted?: number };
      toast.success(
        data.deleted
          ? `Cleared ${data.deleted} version${data.deleted === 1 ? "" : "s"}`
          : "History cleared"
      );
      await fetchVersions();
    } catch {
      toast.error("Failed to clear history");
    }
  };

  const handleRestore = async (v: VersionItem) => {
    if (!activeSchemaId) return;
    const confirmed = window.confirm(
      `Restore to version ${v.version}? This will replace the current schema and create a new version.`
    );
    if (!confirmed) return;

    try {
      const res = await fetch(
        `/api/schemas/${activeSchemaId}/versions/${v.id}`,
        { method: "POST" }
      );
      if (!res.ok) {
        toast.error("Failed to restore version");
        return;
      }
      // Reload the schema into canvas
      const schemaRes = await fetch(`/api/schemas/${activeSchemaId}`);
      if (schemaRes.ok) {
        const data = await schemaRes.json();
        replaceSchema(data.schema.schemaJson);
      }
      toast.success(`Restored to version ${v.version}`);
      await fetchVersions();
    } catch {
      toast.error("Failed to restore version");
    }
  };

  const handleCompare = async (a: VersionItem, b: VersionItem) => {
    if (!activeSchemaId) return;
    setDiffLoading(true);
    setDiffVersionA(a);
    setDiffVersionB(b);
    setView("diff");

    try {
      const [resA, resB] = await Promise.all([
        fetch(`/api/schemas/${activeSchemaId}/versions/${a.id}`),
        fetch(`/api/schemas/${activeSchemaId}/versions/${b.id}`),
      ]);
      if (!resA.ok || !resB.ok) {
        toast.error("Failed to load versions for comparison");
        setView("list");
        return;
      }
      const dataA = await resA.json();
      const dataB = await resB.json();
      const schemaA = dataA.version.schemaJson as Schema;
      const schemaB = dataB.version.schemaJson as Schema;
      setDiff(diffSchemas(schemaA, schemaB));
    } catch {
      toast.error("Failed to compare versions");
      setView("list");
    } finally {
      setDiffLoading(false);
    }
  };

  const handleDiffWithCurrent = async (v: VersionItem) => {
    if (!activeSchemaId) return;
    setDiffLoading(true);
    setDiffVersionA(v);
    setDiffVersionB({
      id: "current",
      version: currentVersion,
      createdAt: new Date().toISOString(),
      tableCount: currentSchema.tables.length,
      relationCount: currentSchema.relations.length,
    });
    setView("diff");

    try {
      const res = await fetch(
        `/api/schemas/${activeSchemaId}/versions/${v.id}`
      );
      if (!res.ok) {
        toast.error("Failed to load version");
        setView("list");
        return;
      }
      const data = await res.json();
      const oldSchema = data.version.schemaJson as Schema;
      setDiff(diffSchemas(oldSchema, currentSchema));
    } catch {
      toast.error("Failed to compare");
      setView("list");
    } finally {
      setDiffLoading(false);
    }
  };

  if (!activeSchemaId) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-xs text-muted-foreground">No schema selected</p>
      </div>
    );
  }

  if (view === "diff") {
    return (
      <DiffView
        versionA={diffVersionA}
        versionB={diffVersionB}
        diff={diff}
        loading={diffLoading}
        onBack={() => {
          setView("list");
          setDiff(null);
        }}
      />
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-1.5">
        <div className="flex items-center gap-2 text-[11px]">
          <History className="size-3.5 text-muted-foreground" />
          <span className="font-medium text-foreground">
            {versions.length} version{versions.length !== 1 ? "s" : ""}
          </span>
          <span className="text-muted-foreground">
            (current: v{currentVersion})
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={fetchVersions}
            disabled={loading}
            title="Refresh"
          >
            <RotateCcw className={cn("size-3", loading && "animate-spin")} />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setConfirmClearAll(true)}
            disabled={loading || versions.length === 0}
            title="Clear all history"
          >
            <Eraser className="size-3 text-muted-foreground" />
          </Button>
        </div>
      </div>

      {/* Version list */}
      <ScrollArea className="min-h-0 flex-1">
        {loading && versions.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
            Loading versions...
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
            <History className="size-8 text-muted-foreground/30" />
            <p>No version history yet</p>
            <p className="text-[10px]">Versions are created automatically on each save</p>
          </div>
        ) : (
          <div className="font-mono text-xs">
            {versions.map((v, i) => {
              const isLatest = v.version === currentVersion;
              const date = new Date(v.createdAt);
              const timeStr = date.toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              });
              const dateStr = date.toLocaleDateString([], {
                month: "short",
                day: "numeric",
              });

              return (
                <div
                  key={v.id}
                  className={cn(
                    "group flex items-center gap-3 border-b border-border/40 px-3 py-2 transition-colors hover:bg-muted/40",
                    isLatest && "bg-primary/[0.03]"
                  )}
                >
                  {/* Version indicator */}
                  <div className="flex flex-col items-center gap-0.5">
                    <div
                      className={cn(
                        "flex size-7 items-center justify-center rounded-md text-[10px] font-bold",
                        isLatest
                          ? "bg-primary/15 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      v{v.version}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground">
                        Version {v.version}
                      </span>
                      {isLatest && (
                        <span className="rounded-full bg-primary/15 px-1.5 py-px text-[9px] font-semibold text-primary">
                          current
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-2.5" />
                        {dateStr} {timeStr}
                      </span>
                      <span className="flex items-center gap-1">
                        <Table2 className="size-2.5" />
                        {v.tableCount}
                      </span>
                      <span className="flex items-center gap-1">
                        <Link2 className="size-2.5" />
                        {v.relationCount}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleDiffWithCurrent(v)}
                      title="Compare with current"
                      disabled={isLatest}
                    >
                      <GitCompare className="size-3" />
                    </Button>
                    {i < versions.length - 1 && (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleCompare(versions[i + 1], v)}
                        title={`Compare v${versions[i + 1].version} → v${v.version}`}
                      >
                        <ChevronRight className="size-3" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => handleRestore(v)}
                      title="Restore this version"
                      disabled={isLatest}
                    >
                      <RotateCcw className="size-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setDeleteTarget(v)}
                      title="Delete this version"
                      disabled={isLatest}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
        title={
          deleteTarget
            ? `Delete version v${deleteTarget.version}?`
            : "Delete version?"
        }
        description="Removes this snapshot from history. The current canvas is untouched. Cannot be undone."
        confirmLabel="Delete version"
        onConfirm={() => {
          if (deleteTarget) void handleDeleteOne(deleteTarget);
        }}
      />

      <ConfirmDialog
        open={confirmClearAll}
        onOpenChange={setConfirmClearAll}
        title="Clear all version history?"
        description={`Permanently removes ${versions.length} snapshot${versions.length === 1 ? "" : "s"} for this schema. The current canvas is untouched. Cannot be undone.`}
        confirmLabel="Clear history"
        onConfirm={() => void handleClearAll()}
      />
    </div>
  );
}

// ─── Diff View ───────────────────────────────────────────────────────────────

function DiffView({
  versionA,
  versionB,
  diff,
  loading,
  onBack,
}: {
  versionA: VersionItem | null;
  versionB: VersionItem | null;
  diff: SchemaDiff | null;
  loading: boolean;
  onBack: () => void;
}) {
  const [expandedSections, setExpandedSections] = useState({
    tables: true,
    columns: true,
    relations: true,
  });

  const toggleSection = (s: keyof typeof expandedSections) =>
    setExpandedSections((prev) => ({ ...prev, [s]: !prev[s] }));

  return (
    <div className="flex h-full flex-col">
      {/* Diff header */}
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <Button variant="ghost" size="icon-xs" onClick={onBack} title="Back">
          <ArrowLeft className="size-3" />
        </Button>
        <GitCompare className="size-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium text-foreground">
          v{versionA?.version ?? "?"} → v{versionB?.version ?? "?"}
        </span>
        {diff && !loading && (
          <span className="ml-auto flex items-center gap-2 text-[10px]">
            {diff.summary.tablesAdded + diff.summary.columnsAdded > 0 && (
              <span className="text-emerald-500">
                +{diff.summary.tablesAdded + diff.summary.columnsAdded}
              </span>
            )}
            {diff.summary.tablesRemoved + diff.summary.columnsRemoved > 0 && (
              <span className="text-red-500">
                -{diff.summary.tablesRemoved + diff.summary.columnsRemoved}
              </span>
            )}
            {diff.summary.tablesModified + diff.summary.columnsModified > 0 && (
              <span className="text-amber-500">
                ~{diff.summary.tablesModified + diff.summary.columnsModified}
              </span>
            )}
          </span>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
            Computing diff...
          </div>
        ) : !diff ? (
          <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
            No diff available
          </div>
        ) : !diff.hasChanges ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
            <GitCompare className="size-8 text-muted-foreground/30" />
            <p>No differences found</p>
          </div>
        ) : (
          <div className="font-mono text-xs">
            {/* Tables section */}
            {diff.tables.length > 0 && (
              <DiffSection
                title="Tables"
                icon={<Table2 className="size-3" />}
                count={diff.tables.length}
                expanded={expandedSections.tables}
                onToggle={() => toggleSection("tables")}
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

            {/* Columns section */}
            {diff.columns.length > 0 && (
              <DiffSection
                title="Columns"
                icon={<Pencil className="size-3" />}
                count={diff.columns.length}
                expanded={expandedSections.columns}
                onToggle={() => toggleSection("columns")}
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

            {/* Relations section */}
            {diff.relations.length > 0 && (
              <DiffSection
                title="Relations"
                icon={<Link2 className="size-3" />}
                count={diff.relations.length}
                expanded={expandedSections.relations}
                onToggle={() => toggleSection("relations")}
              >
                {diff.relations.map((r, i) => (
                  <DiffRow key={i} kind={r.kind} primary={r.description} />
                ))}
              </DiffSection>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

function DiffSection({
  title,
  icon,
  count,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 bg-muted/30 px-3 py-1.5 text-left hover:bg-muted/60"
      >
        {expanded ? (
          <ChevronDown className="size-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="size-3 text-muted-foreground" />
        )}
        {icon}
        <span className="font-semibold text-foreground">{title}</span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {count}
        </span>
      </button>
      {expanded && children}
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
      ? "bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08]"
      : kind === "removed"
        ? "bg-red-500/[0.04] hover:bg-red-500/[0.08]"
        : "hover:bg-muted/40";

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
