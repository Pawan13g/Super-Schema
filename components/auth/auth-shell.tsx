"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";

interface AuthShellProps {
  children: ReactNode;
  // Subhead under the brand name, shown only inside the image panel.
  tagline?: ReactNode;
  // Big pull quote rendered at the bottom of the image panel. Optional.
  quote?: { text: string; author: string };
  // Hue tweak. "indigo" matches the sign-in screenshot, "rose" the verify
  // screenshot. Background gradient adapts.
  accent?: "indigo" | "rose";
}

// Card-style auth layout. Left half is a striking image panel with the
// Super Schema mark on top; right half hosts the form. Stacks on mobile.
export function AuthShell({
  children,
  tagline,
  quote,
  accent = "indigo",
}: AuthShellProps) {
  return (
    <div
      className={
        accent === "rose"
          ? "flex min-h-screen items-center justify-center bg-gradient-to-br from-rose-950 via-rose-900 to-violet-950"
          : "flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900"
      }
    >
      <div className="grid w-full w-full h-screen overflow-hidden bg-card shadow-2xl ring-1 ring-foreground/10 lg:grid-cols-2">
        <ImagePanel tagline={tagline} quote={quote} accent={accent} />
        <div className="flex flex-col justify-center p-6 sm:p-10 lg:p-12">
          {children}
        </div>
      </div>
    </div>
  );
}

function ImagePanel({
  tagline,
  quote,
  accent,
}: {
  tagline?: ReactNode;
  quote?: { text: string; author: string };
  accent: "indigo" | "rose";
}) {
  return (
    <div
      className={
        accent === "rose"
          ? "relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-rose-600 via-fuchsia-700 to-violet-900 p-8 text-white lg:flex lg:p-10"
          : "relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 p-8 text-white lg:flex lg:p-10"
      }
    >
      {/* Atmospheric blobs */}
      <div className="pointer-events-none absolute -top-32 -left-24 size-[420px] rounded-full bg-white/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 size-[360px] rounded-full bg-fuchsia-400/20 blur-3xl" />
      <svg
        className="pointer-events-none absolute inset-0 size-full opacity-[0.08]"
        viewBox="0 0 800 800"
        preserveAspectRatio="none"
        aria-hidden
      >
        <defs>
          <radialGradient id="auth-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="400" cy="400" r="320" fill="url(#auth-glow)" />
      </svg>

      {/* Logo */}
      <Link
        href="/landing"
        className="relative z-10 inline-flex items-center gap-2.5"
      >
        <Logo size={36} className="size-9" />
        <span className="text-base font-semibold tracking-tight">
          Super Schema
        </span>
      </Link>

      {/* Centered hero copy */}
      <div className="relative z-10 my-12 max-w-sm">
        <h2 className="text-3xl font-bold leading-tight">
          Design databases visually,
          <br />
          ship schemas faster.
        </h2>
        {tagline && (
          <p className="mt-3 text-sm leading-relaxed text-white/70">
            {tagline}
          </p>
        )}
      </div>

      {/* Pull quote */}
      {quote && (
        <div className="relative z-10 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
          <p className="text-sm italic leading-relaxed text-white/85">
            &ldquo;{quote.text}&rdquo;
          </p>
          <p className="mt-2 text-xs font-medium text-white/60">
            — {quote.author}
          </p>
        </div>
      )}
    </div>
  );
}

