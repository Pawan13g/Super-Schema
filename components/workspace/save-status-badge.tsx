"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/lib/workspace-context";
import { Cloud, CloudOff, Loader2, Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function formatRelative(ms: number): string {
  if (ms < 5_000) return "just now";
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  return `${Math.floor(ms / 3_600_000)}h ago`;
}

export function SaveStatusBadge() {
  const { saveStatus, lastSavedAt, saveNow } = useWorkspace();
  const [now, setNow] = useState(() => Date.now());

  // Tick every 15s so the relative time stays fresh.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  let icon = <Cloud className="size-3" />;
  let label = "synced";
  let cls = "text-muted-foreground";

  if (saveStatus === "saving") {
    icon = <Loader2 className="size-3 animate-spin" />;
    label = "saving";
    cls = "text-amber-600 dark:text-amber-400";
  } else if (saveStatus === "error") {
    icon = <CloudOff className="size-3" />;
    label = "save failed";
    cls = "text-red-600 dark:text-red-400";
  } else if (saveStatus === "saved") {
    icon = <Check className="size-3" />;
    label = "saved";
    cls = "text-emerald-600 dark:text-emerald-400";
  } else if (lastSavedAt) {
    icon = <Cloud className="size-3" />;
    label = `saved ${formatRelative(now - lastSavedAt)}`;
    cls = "text-muted-foreground";
  } else {
    icon = <AlertCircle className="size-3" />;
    label = "unsaved";
    cls = "text-muted-foreground";
  }

  return (
    <button
      type="button"
      onClick={() => void saveNow()}
      title={
        lastSavedAt
          ? `Last saved ${new Date(lastSavedAt).toLocaleTimeString()} — click to save now`
          : "Click to save now"
      }
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border border-transparent bg-transparent px-2 text-[11px] font-medium transition-colors hover:border-border hover:bg-muted",
        cls
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
