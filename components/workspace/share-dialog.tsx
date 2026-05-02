"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader } from "@/components/ui/loader";
import { useWorkspace } from "@/lib/workspace-context";
import { toast } from "sonner";
import { Copy, Check, ExternalLink, Link2, Trash2, Eye } from "lucide-react";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ShareInfo {
  id: string;
  token: string;
  createdAt: string;
}

export function ShareDialog({ open, onOpenChange }: ShareDialogProps) {
  const { activeSchemaId, schemas } = useWorkspace();
  const activeSchema = schemas.find((s) => s.id === activeSchemaId);

  const [share, setShare] = useState<ShareInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open || !activeSchemaId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/schemas/${activeSchemaId}/share`);
        if (!res.ok) return;
        const data = (await res.json()) as { share: ShareInfo | null };
        if (!cancelled) setShare(data.share);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, activeSchemaId]);

  const shareUrl = share
    ? typeof window !== "undefined"
      ? `${window.location.origin}/share/${share.token}`
      : `/share/${share.token}`
    : "";

  const handleCreate = async () => {
    if (!activeSchemaId) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/schemas/${activeSchemaId}/share`, {
        method: "POST",
      });
      if (!res.ok) {
        toast.error("Failed to create share link");
        return;
      }
      const data = (await res.json()) as { share: ShareInfo };
      setShare(data.share);
      toast.success("Share link created");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async () => {
    if (!activeSchemaId || !share) return;
    if (!window.confirm("Revoke this share link? Anyone with the link will lose access.")) {
      return;
    }
    setRevoking(true);
    try {
      const res = await fetch(`/api/schemas/${activeSchemaId}/share`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Failed to revoke");
        return;
      }
      setShare(null);
      toast.success("Share link revoked");
    } finally {
      setRevoking(false);
    }
  };

  const handleCopy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    toast.success("Link copied");
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="size-4" />
            Share schema
          </DialogTitle>
          <DialogDescription>
            Public, read-only link to{" "}
            <span className="font-medium text-foreground">
              {activeSchema?.name ?? "this schema"}
            </span>
            . Anyone with the link can view the canvas — no sign-in required.
          </DialogDescription>
        </DialogHeader>

        {!activeSchemaId ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            No schema selected.
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader />
          </div>
        ) : share ? (
          <div className="grid gap-3 py-1">
            <div className="flex gap-2">
              <Input value={shareUrl} readOnly className="flex-1 font-mono text-xs" />
              <Button onClick={handleCopy} variant="outline" size="icon-sm">
                {copied ? (
                  <Check className="size-3.5 text-emerald-500" />
                ) : (
                  <Copy className="size-3.5" />
                )}
              </Button>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400">
              <Eye className="size-3" />
              Read-only — viewers cannot edit, save, or run queries.
            </div>
            <div className="-mx-4 -mb-4 flex items-center justify-between gap-2 border-t bg-muted/50 p-3">
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRevoke}
                disabled={revoking}
              >
                <Trash2 className="size-3" />
                Revoke link
              </Button>
              <a
                href={shareUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <ExternalLink className="size-3" />
                Open in new tab
              </a>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 py-3 text-center">
            <p className="text-sm text-muted-foreground">
              No active share link for this schema.
            </p>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? <Loader size="xs" /> : <Link2 className="size-3.5" />}
              Create share link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
