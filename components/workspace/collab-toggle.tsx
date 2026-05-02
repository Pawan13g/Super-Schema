"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { useSchema } from "@/lib/schema-store";
import { useWorkspace } from "@/lib/workspace-context";
import { useCollab } from "@/lib/use-collab";
import { useStoredState } from "@/lib/use-stored-state";
import { Tip } from "@/components/ui/tip";
import { Loader } from "@/components/ui/loader";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Copy,
  LogOut,
  MicOff,
  Power,
  Share2,
  Users,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CollabToggleProps {
  className?: string;
}

// Header pill that toggles real-time collaboration for the active schema.
// Shows status + a stack of peer avatars while connected.
export function CollabToggle({ className }: CollabToggleProps) {
  const { data: session } = useSession();
  const { activeSchemaId } = useWorkspace();
  const { schema, replaceSchema } = useSchema();
  const [enabled, setEnabled] = useStoredState<boolean>(
    "super-schema:collab-enabled",
    false,
    { validate: (v): v is boolean => typeof v === "boolean" }
  );
  // Mount-gate so SSR snapshot stays inert and we only spin up the WebRTC
  // provider client-side after hydration.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const identity = {
    name: session?.user?.name ?? session?.user?.email ?? "Guest",
  };

  const collab = useCollab({
    roomId: mounted && enabled && activeSchemaId ? activeSchemaId : null,
    enabled: mounted && enabled,
    identity,
    schema,
    onRemoteSchema: (next) => replaceSchema(next),
  });

  const peerCount = collab.peers.length;
  const [muted, setMuted] = useStoredState<boolean>(
    "super-schema:collab-muted",
    false,
    { validate: (v): v is boolean => typeof v === "boolean" }
  );

  const inviteUrl =
    typeof window !== "undefined" && activeSchemaId
      ? `${window.location.origin}/?room=${activeSchemaId}`
      : "";

  const copyInvite = async () => {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Invite link copied", {
        description: "Share with anyone who can sign in to this workspace.",
      });
    } catch {
      toast.error("Could not copy");
    }
  };

  const shareInvite = async () => {
    if (!inviteUrl) return;
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "Collaborate on this schema",
          url: inviteUrl,
        });
        return;
      } catch {
        /* fall through */
      }
    }
    void copyInvite();
  };

  if (!activeSchemaId) return null;

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <Tip
        label={
          enabled
            ? collab.status === "connecting"
              ? "Connecting"
              : peerCount > 0
                ? `${peerCount} other peer${peerCount === 1 ? "" : "s"} connected`
                : "Live — waiting for peers"
            : "Enable real-time collaboration"
        }
      >
        <button
          type="button"
          onClick={() => setEnabled(!enabled)}
          aria-pressed={enabled}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition-all",
            enabled
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
          )}
        >
          {enabled && collab.status === "connecting" ? (
            <Loader size="xs" />
          ) : (
            <Users
              className={cn(
                "size-3.5",
                enabled ? "text-emerald-500" : "text-muted-foreground"
              )}
            />
          )}
          {enabled && (
            <span
              className={cn(
                "size-1.5 rounded-full",
                collab.status === "connected"
                  ? "bg-emerald-500"
                  : "bg-amber-500 animate-pulse"
              )}
            />
          )}
          <span className="hidden sm:inline">
            {enabled ? "Live" : "Collab"}
          </span>
        </button>
      </Tip>

      {enabled && peerCount > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label="Show peers and collab options"
                className="flex -space-x-1.5 outline-none"
              >
                {collab.peers.slice(0, 4).map((p) => (
                  <span
                    key={p.id}
                    title={p.name}
                    className="inline-flex size-6 items-center justify-center rounded-full border-2 border-background text-[10px] font-bold text-white shadow-sm"
                    style={{ backgroundColor: p.color }}
                  >
                    {initials(p.name)}
                  </span>
                ))}
                {peerCount > 4 && (
                  <span className="inline-flex size-6 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold text-muted-foreground shadow-sm">
                    +{peerCount - 4}
                  </span>
                )}
              </button>
            }
          />
          <DropdownMenuContent align="end" sideOffset={6} className="min-w-[240px]">
            <DropdownMenuLabel>
              {peerCount} peer{peerCount === 1 ? "" : "s"} online
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="max-h-[180px] overflow-y-auto py-1">
              {collab.peers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 px-2 py-1.5 text-sm"
                >
                  <span
                    className="inline-flex size-5 items-center justify-center rounded-full text-[9px] font-bold text-white"
                    style={{ backgroundColor: p.color }}
                  >
                    {initials(p.name)}
                  </span>
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                </div>
              ))}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={copyInvite}>
              <Copy />
              Copy invite link
            </DropdownMenuItem>
            <DropdownMenuItem onClick={shareInvite}>
              <Share2 />
              Share schema
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setMuted(!muted)}>
              {muted ? <Volume2 /> : <MicOff />}
              {muted ? "Unmute presence pings" : "Mute presence pings"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem destructive onClick={() => setEnabled(false)}>
              <LogOut />
              Leave session
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {enabled && peerCount === 0 && (
        <Tip label="Copy invite link">
          <button
            type="button"
            onClick={copyInvite}
            aria-label="Copy invite link"
            className="inline-flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-primary"
          >
            <Share2 className="size-3.5" />
          </button>
        </Tip>
      )}

      {enabled && (
        <Tip label="End collab session">
          <button
            type="button"
            onClick={() => setEnabled(false)}
            aria-label="End collab"
            className="inline-flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:border-destructive/40 hover:text-destructive"
          >
            <Power className="size-3.5" />
          </button>
        </Tip>
      )}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
