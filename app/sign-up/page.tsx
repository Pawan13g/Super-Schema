"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ui/loader";
import { AuthShell } from "@/components/auth/auth-shell";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface OAuthAvailability {
  google: boolean;
  github: boolean;
  microsoft: boolean;
}

const pillInputClass =
  "h-12 w-full rounded-full border border-input bg-background px-5 text-sm outline-none transition-colors placeholder:text-muted-foreground/70 hover:border-foreground/40 focus-visible:border-foreground focus-visible:ring-2 focus-visible:ring-foreground/10 disabled:cursor-not-allowed disabled:opacity-50";

export default function SignUpPage() {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  // Honeypot — hidden, real users leave blank, bots fill all fields.
  const [hpCompany, setHpCompany] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [availability, setAvailability] = useState<OAuthAvailability>({
    google: false,
    github: false,
    microsoft: false,
  });

  useEffect(() => {
    fetch("/api/auth/providers")
      .then((r) => r.json())
      .then(setAvailability)
      .catch(() => {});
  }, []);

  const anyOAuth =
    availability.google || availability.github || availability.microsoft;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!agreed) {
      setError("Please agree to the Terms & Privacy Policy.");
      return;
    }
    setLoading(true);

    const fullName = `${first.trim()} ${last.trim()}`.trim() || first.trim();
    const res = await fetch("/api/sign-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fullName,
        email: email.trim().toLowerCase(),
        password,
        hp_company: hpCompany,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Sign-up failed.");
      toast.error(data.error ?? "Sign-up failed.");
      setLoading(false);
      return;
    }

    toast.success("Account created — signing you in…");
    if (typeof window !== "undefined") {
      sessionStorage.setItem("super-schema:welcome-toast", "1");
    }
    const dashboard =
      (process.env.NEXT_PUBLIC_DEFAULT_DASHBOARD ?? "").startsWith("/")
        ? (process.env.NEXT_PUBLIC_DEFAULT_DASHBOARD as string)
        : "/projects";
    await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      remember: "1",
      redirect: true,
      callbackUrl: dashboard,
    });
    sessionStorage.removeItem("super-schema:welcome-toast");
    setLoading(false);
  };

  return (
    <AuthShell
      tagline="Free forever for individual use. Create your workspace in one click."
      quote={{
        text: "I replaced my entire Lucidchart + dbdiagram workflow with Super Schema in one afternoon.",
        author: "Full-stack Developer",
      }}
    >
      <div className="mx-auto w-full max-w-md">
        <Link
          href="/landing"
          className="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Back"
        >
          <ArrowLeft className="size-4" />
        </Link>

        <div className="mt-6 space-y-1.5">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Create an Account
          </h1>
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/sign-in"
              className="font-semibold text-foreground underline underline-offset-4 hover:opacity-80"
            >
              Log in
            </Link>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          {/* Honeypot */}
          <div
            aria-hidden
            className="pointer-events-none absolute -left-[9999px] h-0 w-0 overflow-hidden"
          >
            <label>
              Company (leave blank)
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={hpCompany}
                onChange={(e) => setHpCompany(e.target.value)}
              />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <label
                htmlFor="first"
                className="px-1 text-sm font-medium text-foreground"
              >
                First Name
              </label>
              <input
                id="first"
                required
                placeholder="John"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                disabled={loading}
                className={pillInputClass}
                autoComplete="given-name"
              />
            </div>
            <div className="grid gap-1.5">
              <label
                htmlFor="last"
                className="px-1 text-sm font-medium text-foreground"
              >
                Last Name
              </label>
              <input
                id="last"
                placeholder="Last Name"
                value={last}
                onChange={(e) => setLast(e.target.value)}
                disabled={loading}
                className={pillInputClass}
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <label
              htmlFor="email"
              className="px-1 text-sm font-medium text-foreground"
            >
              Email Address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="Email Address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className={pillInputClass}
            />
          </div>

          <div className="grid gap-1.5">
            <label
              htmlFor="password"
              className="px-1 text-sm font-medium text-foreground"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className={cn(pillInputClass, "pr-12")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                tabIndex={-1}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-4" />
                ) : (
                  <Eye className="size-4" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            className="h-12 w-full rounded-full bg-foreground text-base font-semibold text-background hover:bg-foreground/90"
          >
            {loading ? <Loader size="sm" /> : "Create Account"}
          </Button>

          <label className="flex cursor-pointer items-start gap-2 px-1 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={loading}
              className="mt-0.5 size-4 cursor-pointer accent-foreground"
            />
            <span>
              I agree to the{" "}
              <Link
                href="/terms"
                className="font-semibold text-foreground underline underline-offset-2 hover:opacity-80"
              >
                Terms &amp; Conditions
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy"
                className="font-semibold text-foreground underline underline-offset-2 hover:opacity-80"
              >
                Privacy Policy
              </Link>
              .
            </span>
          </label>
        </form>

        {anyOAuth && (
          <>
            <div className="my-6 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <SocialButtons availability={availability} />
          </>
        )}
      </div>
    </AuthShell>
  );
}

function SocialButtons({ availability }: { availability: OAuthAvailability }) {
  const [pending, setPending] = useState<string | null>(null);
  const click = async (
    provider: "google" | "github" | "microsoft-entra-id"
  ) => {
    setPending(provider);
    try {
      await signIn(provider, { callbackUrl: "/projects" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
      setPending(null);
    }
  };
  type SocialKey = "google" | "github" | "microsoft-entra-id";
  const buttons = (
    [
      {
        key: "google" as SocialKey,
        show: availability.google,
        label: "Google",
        icon: <GoogleIcon className="size-4" />,
      },
      {
        key: "github" as SocialKey,
        show: availability.github,
        label: "GitHub",
        icon: <GitHubIcon className="size-4" />,
      },
      {
        key: "microsoft-entra-id" as SocialKey,
        show: availability.microsoft,
        label: "Microsoft",
        icon: <MicrosoftIcon className="size-4" />,
      },
    ] as const
  ).filter((b) => b.show);

  return (
    <div
      className={cn(
        "grid gap-2",
        buttons.length === 1
          ? "grid-cols-1"
          : buttons.length === 2
            ? "sm:grid-cols-2"
            : "sm:grid-cols-3"
      )}
    >
      {buttons.map((b) => (
        <button
          key={b.key}
          type="button"
          onClick={() => click(b.key)}
          disabled={pending !== null}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-input bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending === b.key ? <Loader size="sm" /> : b.icon}
          Continue with {b.label}
        </button>
      ))}
    </div>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden fill="currentColor">
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.2c-3.3.7-4-1.4-4-1.4-.5-1.4-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.7-2.8 5.7-5.5 6 .4.3.8 1 .8 2v3c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
    </svg>
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
