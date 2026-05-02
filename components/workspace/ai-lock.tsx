"use client";

import Link from "next/link";
import { useAiStatus } from "@/lib/ai-status-context";
import { Lock, Sparkles } from "lucide-react";
import { Tip } from "@/components/ui/tip";
import { cn } from "@/lib/utils";

interface AiLockBadgeProps {
  className?: string;
}

// Small badge shown next to AI-only feature triggers. Hides when configured.
export function AiLockBadge({ className }: AiLockBadgeProps) {
  const { configured, enabled, loading } = useAiStatus();
  if (loading) return null;
  if (configured && enabled) return null;
  const reason = !configured
    ? "AI not configured — open Settings → AI to add a provider key."
    : "AI is disabled in Settings.";
  return (
    <Tip label={reason}>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400",
          className
        )}
      >
        <Lock className="size-2.5" />
        locked
      </span>
    </Tip>
  );
}

// Inline notice for AI dialogs when not configured. Shows a CTA to Settings.
export function AiNotConfiguredNotice() {
  const { configured, enabled, loading } = useAiStatus();
  if (loading || (configured && enabled)) return null;
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/[0.06] p-3 text-[12px] text-amber-700 dark:text-amber-400">
      <Sparkles className="mt-0.5 size-3.5 shrink-0" />
      <div className="flex-1">
        <p className="font-semibold">
          {configured ? "AI is disabled" : "AI provider not configured"}
        </p>
        <p className="mt-0.5 text-[11px] opacity-90">
          {configured
            ? "Re-enable AI in Settings to use this feature."
            : "Add a provider and API key in Settings to use this feature."}
        </p>
        <Link
          href="/settings#ai"
          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold underline-offset-2 hover:underline"
        >
          Open Settings →
        </Link>
      </div>
    </div>
  );
}
