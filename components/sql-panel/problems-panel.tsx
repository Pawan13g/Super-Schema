"use client";

import { useMemo, useState } from "react";
import { useSchema } from "@/lib/schema-store";
import { lintSchema, summarizeIssues, type LintIssue, type LintSeverity } from "@/lib/schema-lint";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertTriangle,
  CircleAlert,
  Info,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SEVERITY_CONFIG: Record<
  LintSeverity,
  { icon: typeof CircleAlert; color: string; bg: string; label: string }
> = {
  error: {
    icon: CircleAlert,
    color: "text-red-500",
    bg: "bg-red-500/10",
    label: "Error",
  },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    label: "Warning",
  },
  info: {
    icon: Info,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    label: "Info",
  },
};

export function ProblemsPanel() {
  const { schema, setSelectedTableId } = useSchema();
  const issues = useMemo(() => lintSchema(schema), [schema]);
  const summary = summarizeIssues(issues);
  const [filterSeverity, setFilterSeverity] = useState<LintSeverity | "all">("all");
  const [collapsedTables, setCollapsedTables] = useState<Set<string>>(new Set());

  const filteredIssues =
    filterSeverity === "all"
      ? issues
      : issues.filter((i) => i.severity === filterSeverity);

  // Group issues by table
  const grouped = useMemo(() => {
    const map = new Map<string, { tableName: string; issues: LintIssue[] }>();
    const general: LintIssue[] = [];

    for (const issue of filteredIssues) {
      if (!issue.tableId) {
        general.push(issue);
        continue;
      }
      const table = schema.tables.find((t) => t.id === issue.tableId);
      const key = issue.tableId;
      if (!map.has(key)) {
        map.set(key, { tableName: table?.name ?? "Unknown", issues: [] });
      }
      map.get(key)!.issues.push(issue);
    }

    return { byTable: map, general };
  }, [filteredIssues, schema.tables]);

  const toggleTable = (tableId: string) => {
    setCollapsedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableId)) next.delete(tableId);
      else next.add(tableId);
      return next;
    });
  };

  if (schema.tables.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-xs text-muted-foreground">No tables in schema</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Status bar */}
      <div className="flex items-center gap-2 border-b px-3 py-1.5">
        <div className="flex items-center gap-2 text-[11px]">
          {issues.length === 0 ? (
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-3.5" />
              No problems detected
            </span>
          ) : (
            <>
              {summary.error > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterSeverity(filterSeverity === "error" ? "all" : "error")}
                  className={cn(
                    "flex items-center gap-1 rounded px-1.5 py-0.5 font-medium transition-colors",
                    filterSeverity === "error"
                      ? "bg-red-500/15 text-red-600"
                      : "text-red-500 hover:bg-red-500/10"
                  )}
                >
                  <CircleAlert className="size-3" />
                  {summary.error}
                </button>
              )}
              {summary.warning > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterSeverity(filterSeverity === "warning" ? "all" : "warning")}
                  className={cn(
                    "flex items-center gap-1 rounded px-1.5 py-0.5 font-medium transition-colors",
                    filterSeverity === "warning"
                      ? "bg-amber-500/15 text-amber-600"
                      : "text-amber-500 hover:bg-amber-500/10"
                  )}
                >
                  <AlertTriangle className="size-3" />
                  {summary.warning}
                </button>
              )}
              {summary.info > 0 && (
                <button
                  type="button"
                  onClick={() => setFilterSeverity(filterSeverity === "info" ? "all" : "info")}
                  className={cn(
                    "flex items-center gap-1 rounded px-1.5 py-0.5 font-medium transition-colors",
                    filterSeverity === "info"
                      ? "bg-blue-500/15 text-blue-600"
                      : "text-blue-500 hover:bg-blue-500/10"
                  )}
                >
                  <Info className="size-3" />
                  {summary.info}
                </button>
              )}
              {filterSeverity !== "all" && (
                <button
                  type="button"
                  onClick={() => setFilterSeverity("all")}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground hover:bg-muted"
                >
                  <Filter className="size-3" />
                  Clear
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Issues list */}
      <ScrollArea className="flex-1">
        <div className="font-mono text-xs">
          {/* General issues (no table) */}
          {grouped.general.map((issue) => (
            <IssueRow key={issue.id} issue={issue} />
          ))}

          {/* Grouped by table */}
          {Array.from(grouped.byTable.entries()).map(([tableId, group]) => {
            const isCollapsed = collapsedTables.has(tableId);
            const errorCount = group.issues.filter((i) => i.severity === "error").length;
            const warnCount = group.issues.filter((i) => i.severity === "warning").length;
            const infoCount = group.issues.filter((i) => i.severity === "info").length;

            return (
              <div key={tableId}>
                <button
                  type="button"
                  onClick={() => toggleTable(tableId)}
                  className="flex w-full items-center gap-1.5 bg-muted/30 px-3 py-1 text-left hover:bg-muted/60"
                >
                  {isCollapsed ? (
                    <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="size-3 shrink-0 text-muted-foreground" />
                  )}
                  <span className="font-semibold text-foreground">{group.tableName}</span>
                  <span className="ml-auto flex items-center gap-1.5">
                    {errorCount > 0 && (
                      <span className="flex items-center gap-0.5 text-red-500">
                        <CircleAlert className="size-2.5" />
                        {errorCount}
                      </span>
                    )}
                    {warnCount > 0 && (
                      <span className="flex items-center gap-0.5 text-amber-500">
                        <AlertTriangle className="size-2.5" />
                        {warnCount}
                      </span>
                    )}
                    {infoCount > 0 && (
                      <span className="flex items-center gap-0.5 text-blue-500">
                        <Info className="size-2.5" />
                        {infoCount}
                      </span>
                    )}
                  </span>
                </button>
                {!isCollapsed &&
                  group.issues.map((issue) => (
                    <IssueRow
                      key={issue.id}
                      issue={issue}
                      onNavigate={() => setSelectedTableId(issue.tableId ?? null)}
                    />
                  ))}
              </div>
            );
          })}

          {filteredIssues.length === 0 && issues.length > 0 && (
            <div className="px-3 py-6 text-center text-muted-foreground">
              No {filterSeverity} issues
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function IssueRow({
  issue,
  onNavigate,
}: {
  issue: LintIssue;
  onNavigate?: () => void;
}) {
  const config = SEVERITY_CONFIG[issue.severity];
  const Icon = config.icon;

  return (
    <button
      type="button"
      onClick={onNavigate}
      disabled={!onNavigate}
      className="flex w-full items-start gap-2 border-b border-border/40 px-3 py-1.5 text-left hover:bg-muted/40 disabled:cursor-default disabled:hover:bg-transparent"
    >
      <Icon className={cn("mt-0.5 size-3 shrink-0", config.color)} />
      <span className="min-w-0 flex-1 text-foreground/90">{issue.message}</span>
      <span className="shrink-0 text-[10px] text-muted-foreground">{issue.rule}</span>
    </button>
  );
}
