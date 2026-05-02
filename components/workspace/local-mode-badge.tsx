"use client";

import { useAiStatus } from "@/lib/ai-status-context";
import { Tip } from "@/components/ui/tip";
import { Cpu } from "lucide-react";

// Tiny badge that surfaces when the user is on a fully-local AI provider
// (Ollama). Tells them they're offline-capable for AI features.
export function LocalModeBadge() {
  const { provider, configured, enabled, loading } = useAiStatus();
  if (loading) return null;
  if (provider !== "ollama" || !configured || !enabled) return null;
  return (
    <Tip label="AI runs locally via Ollama. No data leaves your machine.">
      <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
        <Cpu className="size-3" />
        <span className="hidden sm:inline">Local</span>
      </span>
    </Tip>
  );
}
