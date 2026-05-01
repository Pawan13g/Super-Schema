"use client";

import { useMemo } from "react";
import { useSchema } from "@/lib/schema-store";
import { lintSchema, summarizeIssues, type LintIssue } from "@/lib/schema-lint";
import {
  AlertTriangle,
  CheckCircle2,
  CircleAlert,
  Info,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function LintPanel() {
  const { schema, setSelectedTableId } = useSchema();
  const issues = useMemo(() => lintSchema(schema), [schema]);
  const summary = summarizeIssues(issues);

  if (schema.tables.length === 0) return null;

  if (issues.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
        <ShieldCheck className="size-3.5" />
        <span className="font-medium">Schema looks clean</span>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <CircleAlert className="size-3" />
        Lint
        <span className="ml-auto flex gap-1">
          {summary.error > 0 && (
            <Badge color="destructive">{summary.error} err</Badge>
          )}
          {summary.warning > 0 && (
            <Badge color="warning">{summary.warning} warn</Badge>
          )}
          {summary.info > 0 && (
            <Badge color="info">{summary.info} info</Badge>
          )}
        </span>
      </div>
      <ul className="space-y-1">
        {issues.map((issue) => (
          <Issue
            key={issue.id}
            issue={issue}
            onPick={(id) => setSelectedTableId(id)}
          />
        ))}
      </ul>
    </div>
  );
}

function Issue({
  issue,
  onPick,
}: {
  issue: LintIssue;
  onPick: (tableId: string) => void;
}) {
  const Icon =
    issue.severity === "error"
      ? CircleAlert
      : issue.severity === "warning"
        ? AlertTriangle
        : Info;
  const color =
    issue.severity === "error"
      ? "text-destructive"
      : issue.severity === "warning"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";

  return (
    <li>
      <button
        type="button"
        onClick={() => issue.tableId && onPick(issue.tableId)}
        disabled={!issue.tableId}
        className="flex w-full items-start gap-2 rounded-md border bg-card px-2 py-1.5 text-left text-[11px] hover:bg-accent disabled:cursor-default disabled:hover:bg-card"
      >
        <Icon className={cn("mt-0.5 size-3 shrink-0", color)} />
        <div className="min-w-0 flex-1">
          <p className="leading-snug">{issue.message}</p>
          <p className="text-[10px] text-muted-foreground">{issue.rule}</p>
        </div>
      </button>
    </li>
  );
}

function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: "destructive" | "warning" | "info";
}) {
  const cls =
    color === "destructive"
      ? "bg-destructive/15 text-destructive"
      : color === "warning"
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
        : "bg-muted text-muted-foreground";
  return (
    <span className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold", cls)}>
      {children}
    </span>
  );
}

export function LintBadge() {
  // Compact inline badge for showing in headers; reuses the same logic.
  const { schema } = useSchema();
  const issues = useMemo(() => lintSchema(schema), [schema]);
  const summary = summarizeIssues(issues);
  if (issues.length === 0) {
    return (
      <span
        title="No issues"
        className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:text-emerald-400"
      >
        <CheckCircle2 className="size-2.5" />
        clean
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1">
      {summary.error > 0 && (
        <span
          title={`${summary.error} errors`}
          className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[9px] font-semibold text-destructive"
        >
          {summary.error}
        </span>
      )}
      {summary.warning > 0 && (
        <span
          title={`${summary.warning} warnings`}
          className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-400"
        >
          {summary.warning}
        </span>
      )}
    </span>
  );
}
