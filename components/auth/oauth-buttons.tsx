"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { toast } from "sonner";

export interface OAuthAvailability {
  google: boolean;
  github: boolean;
  microsoft: boolean;
}

interface OAuthButtonsProps {
  callbackUrl?: string;
  availability: OAuthAvailability;
}

const DEFAULT_DASHBOARD =
  (process.env.NEXT_PUBLIC_DEFAULT_DASHBOARD ?? "").startsWith("/")
    ? (process.env.NEXT_PUBLIC_DEFAULT_DASHBOARD as string)
    : "/";

export function OAuthButtons({
  callbackUrl = DEFAULT_DASHBOARD,
  availability,
}: OAuthButtonsProps) {
  const [pending, setPending] = useState<string | null>(null);

  const click = async (provider: "google" | "github" | "microsoft-entra-id") => {
    setPending(provider);
    try {
      await signIn(provider, { callbackUrl });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
      setPending(null);
    }
  };

  const anyEnabled =
    availability.google || availability.github || availability.microsoft;
  if (!anyEnabled) return null;

  return (
    <div className="flex flex-col gap-2">
      {availability.google && (
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full gap-2"
          disabled={pending !== null}
          onClick={() => click("google")}
        >
          {pending === "google" ? (
            <Loader size="sm" />
          ) : (
            <GoogleIcon className="size-4" />
          )}
          Continue with Google
        </Button>
      )}
      {availability.github && (
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full gap-2"
          disabled={pending !== null}
          onClick={() => click("github")}
        >
          {pending === "github" ? (
            <Loader size="sm" />
          ) : (
            <GitHubIcon className="size-4" />
          )}
          Continue with GitHub
        </Button>
      )}
      {availability.microsoft && (
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full gap-2"
          disabled={pending !== null}
          onClick={() => click("microsoft-entra-id")}
        >
          {pending === "microsoft-entra-id" ? (
            <Loader size="sm" />
          ) : (
            <MicrosoftIcon className="size-4" />
          )}
          Continue with Microsoft
        </Button>
      )}
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 3l5.7-5.7C34 6.4 29.3 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5 44.5 36.3 44.5 25c0-1.5-.2-3-.5-4.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 13 24 13c3 0 5.7 1.1 7.8 3l5.7-5.7C34 6.4 29.3 4.5 24 4.5 16.3 4.5 9.6 8.7 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 45.5c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 36.4 26.8 37 24 37c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.4 41 16.2 45.5 24 45.5z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.2 4.3-4.1 5.7l6.2 5.2C40.7 37 44.5 31.5 44.5 25c0-1.5-.2-3-.9-4.5z"
      />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.7-2.8 5.7-5.5 6 .4.3.8 1 .8 2v3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
    </svg>
  );
}

function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#F25022" d="M1 1h10v10H1z" />
      <path fill="#7FBA00" d="M13 1h10v10H13z" />
      <path fill="#00A4EF" d="M1 13h10v10H1z" />
      <path fill="#FFB900" d="M13 13h10v10H13z" />
    </svg>
  );
}
