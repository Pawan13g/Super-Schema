"use client";

import { useState, useEffect, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader } from "@/components/ui/loader";
import { OAuthButtons, type OAuthAvailability } from "@/components/auth/oauth-buttons";
import { Database, Layers, Sparkles, Zap } from "lucide-react";

function BrandPanel() {
  return (
    <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-violet-950 via-violet-900 to-indigo-900 p-10 lg:flex lg:w-[48%]">
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "linear-gradient(oklch(1 0 0 / 0.15) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.15) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div className="absolute -top-32 -left-32 size-[500px] rounded-full bg-violet-600/20 blur-3xl" />
      <div className="absolute -bottom-32 -right-32 size-[400px] rounded-full bg-indigo-600/20 blur-3xl" />

      <div className="relative z-10 flex items-center gap-2.5">
        <div className="flex size-9 items-center justify-center rounded-lg bg-white/10 backdrop-blur-sm ring-1 ring-white/20">
          <Database className="size-5 text-white" />
        </div>
        <span className="text-lg font-bold text-white">Super Schema</span>
      </div>

      <div className="relative z-10 space-y-6">
        <div>
          <h2 className="text-3xl font-bold leading-tight text-white">
            Design databases visually,<br />ship schemas faster.
          </h2>
          <p className="mt-3 text-sm text-violet-200/80">
            AI-powered schema design, multi-dialect SQL generation, and real-time collaboration — all in one canvas.
          </p>
        </div>
        <ul className="space-y-3">
          {[
            { icon: Layers, text: "Visual table editor with drag-and-drop" },
            { icon: Sparkles, text: "AI schema generation from plain English" },
            { icon: Zap, text: "Export SQL for PostgreSQL, MySQL & SQLite" },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center gap-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/15">
                <Icon className="size-3.5 text-violet-200" />
              </div>
              <span className="text-sm text-violet-100/90">{text}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="relative z-10 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
        <p className="text-sm italic text-violet-100/80">
          &ldquo;Super Schema saves us hours every sprint — schema design used to take days.&rdquo;
        </p>
        <p className="mt-2 text-xs font-medium text-violet-300">— Engineering Lead, Series B startup</p>
      </div>
    </div>
  );
}

// Default landing destination after a successful sign-in. Configured via
// the NEXT_PUBLIC_DEFAULT_DASHBOARD env var (must start with "/"); falls
// back to the Projects dashboard.
const DEFAULT_DASHBOARD =
  (process.env.NEXT_PUBLIC_DEFAULT_DASHBOARD ?? "").startsWith("/")
    ? (process.env.NEXT_PUBLIC_DEFAULT_DASHBOARD as string)
    : "/projects";

// Sanitize the callbackUrl coming back from the redirect chain. Only allow
// same-origin paths, never bounce back to /sign-in or /sign-up — that's
// what produced the "/sign-in?callbackUrl=/sign-in?callbackUrl=…" loop.
function safeCallback(raw: string | null): string {
  if (!raw) return DEFAULT_DASHBOARD;
  try {
    let path = raw;
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const u = new URL(raw);
      if (u.origin !== window.location.origin) return DEFAULT_DASHBOARD;
      path = u.pathname + u.search + u.hash;
    }
    if (!path.startsWith("/")) return DEFAULT_DASHBOARD;
    if (path.startsWith("/sign-in") || path.startsWith("/sign-up"))
      return DEFAULT_DASHBOARD;
    return path;
  } catch {
    return DEFAULT_DASHBOARD;
  }
}

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const rawCallback = params.get("callbackUrl");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
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

  // NextAuth redirects to /sign-in?error=... when OAuth or credentials fail.
  // Translate its error codes into a user-friendly message instead of
  // staying silent.
  useEffect(() => {
    const code = params.get("error");
    if (!code) return;
    const map: Record<string, string> = {
      CredentialsSignin: "Invalid email or password.",
      OAuthAccountNotLinked:
        "That email is already linked to another sign-in method. Use the original method, then connect this provider in Settings.",
      OAuthCallbackError:
        "OAuth provider rejected the sign-in. Check the redirect URL in your provider's console.",
      OAuthSignin: "Could not start the OAuth flow. Try again.",
      AccessDenied: "Access denied by the OAuth provider.",
      Configuration: "OAuth is misconfigured on the server.",
      Verification: "Sign-in link expired or was already used.",
    };
    const msg = map[code] ?? `Sign-in failed (${code}).`;
    setError(msg);
    toast.error(msg);
  }, [params]);

  // Surface a "welcome back" toast after the redirect from the auth callback
  // (we set this flag right before triggering signIn).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("super-schema:welcome-toast") === "1") {
      sessionStorage.removeItem("super-schema:welcome-toast");
      toast.success("Welcome back!");
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const dest = safeCallback(rawCallback);
    // Stash a flag so the destination page can pop a "welcome back" toast.
    if (typeof window !== "undefined") {
      sessionStorage.setItem("super-schema:welcome-toast", "1");
    }
    // Use NextAuth's own redirect flow. It performs a single response that
    // both Sets the session cookie and navigates to `callbackUrl` — no
    // client-side cookie race, no middleware bounce, no chained URLs.
    // On invalid credentials, NextAuth comes back to /sign-in?error=CredentialsSignin
    // which the effect above translates into a toast + inline error.
    await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      remember: remember ? "1" : "0",
      redirect: true,
      callbackUrl: dest,
    });
    // If we reach this line the redirect didn't fire (browser blocked it,
    // or NextAuth returned synchronously) — clear the flag so a stale
    // welcome toast doesn't fire on the next visit.
    sessionStorage.removeItem("super-schema:welcome-toast");
    setLoading(false);
  };

  const callbackUrl = safeCallback(rawCallback);
  const anyOAuth = availability.google || availability.github || availability.microsoft;

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
      <div className="mb-8 flex items-center gap-2.5 lg:hidden">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
          <Database className="size-4 text-primary" />
        </div>
        <span className="text-base font-bold">Super Schema</span>
      </div>

      <div className="w-full max-w-sm space-y-7">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to continue to your workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <span className="cursor-not-allowed text-xs text-muted-foreground">Forgot password?</span>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="h-10"
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              disabled={loading}
              className="size-4 cursor-pointer accent-primary"
            />
            <span>
              Remember me on this device
              <span className="ml-1 text-[10px] opacity-70">
                ({remember ? "30 days" : "1 hour"})
              </span>
            </span>
          </label>

          {error && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" disabled={loading} className="h-10 w-full">
            {loading ? <Loader size="sm" /> : "Sign in"}
          </Button>
        </form>

        {anyOAuth && (
          <>
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                <span className="bg-background px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
            <OAuthButtons callbackUrl={callbackUrl} availability={availability} />
          </>
        )}

        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link
            href="/terms"
            className="font-medium text-foreground underline underline-offset-2 hover:opacity-80"
          >
            Terms &amp; Conditions
          </Link>{" "}
          and{" "}
          <Link
            href="/privacy"
            className="font-medium text-foreground underline underline-offset-2 hover:opacity-80"
          >
            Privacy Policy
          </Link>
          .
        </p>

        <p className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{" "}
          <Link href="/sign-up" className="font-medium text-primary hover:underline underline-offset-4">
            Create one free
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="flex min-h-screen">
      <BrandPanel />
      <Suspense fallback={null}>
        <SignInForm />
      </Suspense>
    </div>
  );
}
