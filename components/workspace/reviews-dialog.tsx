"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader } from "@/components/ui/loader";
import { useWorkspace } from "@/lib/workspace-context";
import { useSchema } from "@/lib/schema-store";
import { diffSchemas } from "@/lib/schema-diff";
import type { Schema } from "@/lib/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Check,
  Clock,
  GitPullRequest,
  Minus,
  Pencil,
  Plus,
  Send,
  X,
} from "lucide-react";

interface ReviewsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ReviewSummary {
  id: string;
  title: string;
  description: string | null;
  authorName: string | null;
  baseVersion: number;
  status: "open" | "approved" | "rejected";
  decidedAt: string | null;
  createdAt: string;
}

interface ReviewDetail {
  review: ReviewSummary & { proposedJson: Schema; schemaId: string };
  schema: { id: string; name: string; version: number; schemaJson: Schema };
}

export function ReviewsDialog({ open, onOpenChange }: ReviewsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-h-[80vh] w-[calc(100%-2rem)] flex-col gap-3 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitPullRequest className="size-4" />
            Schema reviews
          </DialogTitle>
          <DialogDescription>
            PR-style approval flow. Open a review with your proposed changes,
            teammates approve or reject, approval merges into the live schema.
          </DialogDescription>
        </DialogHeader>
        {open && <ReviewsBody onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

type View = "list" | "create" | "detail";

function ReviewsBody({ onClose }: { onClose: () => void }) {
  const { activeSchemaId } = useWorkspace();
  const { schema: canvasSchema, replaceSchema } = useSchema();

  const [view, setView] = useState<View>("list");
  const [statusFilter, setStatusFilter] = useState<"all" | "open" | "decided">(
    "open"
  );
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeReviewId, setActiveReviewId] = useState<string | null>(null);

  const refresh = async () => {
    if (!activeSchemaId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/schemas/${activeSchemaId}/reviews`);
      if (!res.ok) {
        toast.error("Failed to load reviews");
        return;
      }
      const data = (await res.json()) as { reviews: ReviewSummary[] };
      setReviews(data.reviews);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // setState calls happen inside async refresh(); reload on schema change
    // is intentional and refresh's identity isn't a meaningful trigger.
    /* eslint-disable react-hooks/set-state-in-effect */
    void refresh();
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSchemaId]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return reviews;
    if (statusFilter === "open")
      return reviews.filter((r) => r.status === "open");
    return reviews.filter((r) => r.status !== "open");
  }, [reviews, statusFilter]);

  if (!activeSchemaId) {
    return (
      <p className="py-12 text-center text-xs text-muted-foreground">
        No active schema.
      </p>
    );
  }

  if (view === "create") {
    return (
      <CreateReview
        schemaId={activeSchemaId}
        canvasSchema={canvasSchema}
        onCancel={() => setView("list")}
        onCreated={async () => {
          await refresh();
          setView("list");
        }}
      />
    );
  }

  if (view === "detail" && activeReviewId) {
    return (
      <ReviewDetailView
        reviewId={activeReviewId}
        onBack={() => {
          setActiveReviewId(null);
          setView("list");
        }}
        onDecided={async () => {
          await refresh();
        }}
        onApprovedAndPull={(merged) => {
          // After approval, sync the live canvas to the merged state so the
          // user doesn't keep editing a stale fork.
          replaceSchema(merged);
        }}
      />
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b pb-2">
        <Tabs
          value={statusFilter}
          onValueChange={(v) =>
            setStatusFilter((v ?? "all") as "all" | "open" | "decided")
          }
        >
          <TabsList className="h-7">
            <TabsTrigger value="open" className="h-5 px-2 text-[11px]">
              Open
              <span className="ml-1 rounded bg-foreground/10 px-1 py-px text-[9px] font-bold">
                {reviews.filter((r) => r.status === "open").length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="decided" className="h-5 px-2 text-[11px]">
              Decided
            </TabsTrigger>
            <TabsTrigger value="all" className="h-5 px-2 text-[11px]">
              All
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button size="sm" onClick={() => setView("create")}>
          <Plus className="size-3.5" />
          New review
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {loading && reviews.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-12 text-xs text-muted-foreground">
            <GitPullRequest className="size-8 text-muted-foreground/30" />
            <p>No reviews here.</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setView("create")}
            >
              Open one
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {filtered.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => {
                    setActiveReviewId(r.id);
                    setView("detail");
                  }}
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted/40"
                >
                  <StatusPill status={r.status} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {r.title}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span>v{r.baseVersion}</span>
                      <span>·</span>
                      <span>{r.authorName ?? "unknown"}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock className="size-2.5" />
                        {new Date(r.createdAt).toLocaleString([], {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>

      <div className="flex justify-end border-t pt-2">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: ReviewSummary["status"] }) {
  if (status === "open") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
        <GitPullRequest className="size-2.5" />
        open
      </span>
    );
  }
  if (status === "approved") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-400">
        <Check className="size-2.5" />
        merged
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400">
      <X className="size-2.5" />
      rejected
    </span>
  );
}

// ─── Create flow ────────────────────────────────────────────────────────

function CreateReview({
  schemaId,
  canvasSchema,
  onCancel,
  onCreated,
}: {
  schemaId: string;
  canvasSchema: Schema;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [baseSchema, setBaseSchema] = useState<Schema | null>(null);

  // Pull the live (server-side) schema as the base for the diff. The canvas
  // copy may be ahead of saved state — but the review is "this canvas vs
  // current saved state" semantically.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/schemas/${schemaId}`);
      if (!res.ok) return;
      const data = (await res.json()) as { schema: { schemaJson: Schema } };
      if (!cancelled) setBaseSchema(data.schema.schemaJson);
    })();
    return () => {
      cancelled = true;
    };
  }, [schemaId]);

  const diff = useMemo(
    () => (baseSchema ? diffSchemas(baseSchema, canvasSchema) : null),
    [baseSchema, canvasSchema]
  );

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/schemas/${schemaId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: desc.trim() || undefined,
          proposedJson: canvasSchema,
        }),
      });
      if (!res.ok) {
        toast.error("Failed to open review");
        return;
      }
      toast.success("Review opened");
      onCreated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex items-center gap-2 border-b pb-2">
        <Button variant="ghost" size="icon-sm" onClick={onCancel}>
          <ArrowLeft className="size-3.5" />
        </Button>
        <span className="text-sm font-semibold">New review</span>
      </div>

      <div className="grid gap-2">
        <div className="grid gap-1">
          <Label className="text-xs">Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Add invoices table"
            autoFocus
          />
        </div>
        <div className="grid gap-1">
          <Label className="text-xs">Description (optional)</Label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="What changed and why?"
            className="min-h-[72px] w-full resize-none rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>
      </div>

      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="border-b bg-muted/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Diff vs. saved
        </div>
        <ScrollArea className="flex-1">
          {!diff ? (
            <div className="flex items-center justify-center py-6">
              <Loader />
            </div>
          ) : !diff.hasChanges ? (
            <p className="p-4 text-center text-xs text-muted-foreground">
              No changes — canvas matches saved state.
            </p>
          ) : (
            <DiffView diff={diff} />
          )}
        </ScrollArea>
      </div>

      <div className="flex items-center justify-end gap-2 border-t pt-2">
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={busy || !title.trim() || !diff?.hasChanges}
        >
          {busy ? <Loader size="xs" /> : <Send className="size-3.5" />}
          Open review
        </Button>
      </div>
    </div>
  );
}

// ─── Detail flow ────────────────────────────────────────────────────────

function ReviewDetailView({
  reviewId,
  onBack,
  onDecided,
  onApprovedAndPull,
}: {
  reviewId: string;
  onBack: () => void;
  onDecided: () => void;
  onApprovedAndPull: (mergedSchema: Schema) => void;
}) {
  const [data, setData] = useState<ReviewDetail | null>(null);
  const [busy, setBusy] = useState<"approve" | "reject" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/reviews/${reviewId}`);
      if (!res.ok) return;
      const d = (await res.json()) as ReviewDetail;
      if (!cancelled) setData(d);
    })();
    return () => {
      cancelled = true;
    };
  }, [reviewId]);

  const diff = useMemo(() => {
    if (!data) return null;
    return diffSchemas(data.schema.schemaJson, data.review.proposedJson);
  }, [data]);

  const decide = async (decision: "approve" | "reject") => {
    setBusy(decision);
    try {
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        toast.error("Failed to record decision");
        return;
      }
      toast.success(decision === "approve" ? "Approved + merged" : "Rejected");
      if (decision === "approve" && data) {
        onApprovedAndPull(data.review.proposedJson);
      }
      await onDecided();
      onBack();
    } finally {
      setBusy(null);
    }
  };

  if (!data) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex items-center gap-2 border-b pb-2">
        <Button variant="ghost" size="icon-sm" onClick={onBack}>
          <ArrowLeft className="size-3.5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{data.review.title}</p>
          <p className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <StatusPill status={data.review.status} />
            <span>v{data.review.baseVersion} → v{data.schema.version}</span>
            <span>·</span>
            <span>{data.review.authorName ?? "unknown"}</span>
          </p>
        </div>
      </div>

      {data.review.description && (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-foreground/80">
          {data.review.description}
        </p>
      )}

      <div className="flex flex-1 flex-col overflow-hidden rounded-lg border">
        <div className="border-b bg-muted/30 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Live → Proposed
        </div>
        <ScrollArea className="flex-1">
          {!diff?.hasChanges ? (
            <p className="p-4 text-center text-xs text-muted-foreground">
              No changes.
            </p>
          ) : (
            <DiffView diff={diff} />
          )}
        </ScrollArea>
      </div>

      {data.review.status === "open" ? (
        <div className="flex items-center justify-end gap-2 border-t pt-2">
          <Button
            variant="outline"
            onClick={() => decide("reject")}
            disabled={busy !== null}
          >
            {busy === "reject" ? <Loader size="xs" /> : <X className="size-3.5" />}
            Reject
          </Button>
          <Button onClick={() => decide("approve")} disabled={busy !== null}>
            {busy === "approve" ? (
              <Loader size="xs" />
            ) : (
              <Check className="size-3.5" />
            )}
            Approve + merge
          </Button>
        </div>
      ) : (
        <div className="flex justify-end border-t pt-2">
          <Button variant="outline" onClick={onBack}>
            Close
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Diff view (shared) ─────────────────────────────────────────────────

function DiffView({ diff }: { diff: ReturnType<typeof diffSchemas> }) {
  return (
    <div className="font-mono text-xs">
      {diff.tables.length > 0 && (
        <DiffSection title="Tables" count={diff.tables.length}>
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
        <DiffSection title="Columns" count={diff.columns.length}>
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
        <DiffSection title="Relations" count={diff.relations.length}>
          {diff.relations.map((r, i) => (
            <DiffRow key={i} kind={r.kind} primary={r.description} />
          ))}
        </DiffSection>
      )}
    </div>
  );
}

function DiffSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 bg-muted/30 px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider">
          {title}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {count}
        </span>
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
  const bg =
    kind === "added"
      ? "bg-emerald-500/[0.04]"
      : kind === "removed"
        ? "bg-red-500/[0.04]"
        : "";
  const fg =
    kind === "added"
      ? "text-emerald-500"
      : kind === "removed"
        ? "text-red-500"
        : "text-amber-500";
  return (
    <div
      className={cn(
        "flex items-start gap-2 border-b border-border/30 px-3 py-1.5",
        bg
      )}
    >
      <Icon className={cn("mt-0.5 size-3 shrink-0", fg)} />
      <span className="min-w-0 flex-1 text-foreground/90">{primary}</span>
      {secondary && (
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {secondary}
        </span>
      )}
    </div>
  );
}
