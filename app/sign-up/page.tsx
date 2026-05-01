"use client";

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
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
            Start designing schemas<br />in minutes, not hours.
          </h2>
          <p className="mt-3 text-sm text-violet-200/80">
            Free forever for individual use. Create your workspace in one click and start building.
          </p>
        </div>
        <ul className="space-y-3">
          {[
            { icon: Layers, text: "Unlimited schemas and tables" },
            { icon: Sparkles, text: "AI assistant included — no extra charge" },
            { icon: Zap, text: "Export to any SQL dialect instantly" },
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
          &ldquo;I replaced my entire Lucidchart + dbdiagram workflow with Super Schema in one afternoon.&rdquo;
        </p>
        <p className="mt-2 text-xs font-medium text-violet-300">— Full-stack Developer</p>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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

  const anyOAuth = availability.google || availability.github || availability.microsoft;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/sign-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
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
    // Default landing destination configurable via NEXT_PUBLIC_DEFAULT_DASHBOARD.
    const dashboard =
      (process.env.NEXT_PUBLIC_DEFAULT_DASHBOARD ?? "").startsWith("/")
        ? (process.env.NEXT_PUBLIC_DEFAULT_DASHBOARD as string)
        : "/projects";
    // Use NextAuth's redirect flow — server response carries both the
    // session cookie and the redirect, avoiding the cookie/middleware race.
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
    <div className="flex min-h-screen">
      <BrandPanel />

      <div className="flex flex-1 flex-col items-center justify-center bg-background px-6 py-12">
        <div className="mb-8 flex items-center gap-2.5 lg:hidden">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
            <Database className="size-4 text-primary" />
          </div>
          <span className="text-base font-bold">Super Schema</span>
        </div>

        <div className="w-full max-w-sm space-y-7">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
            <p className="text-sm text-muted-foreground">
              Get started free — no credit card required.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Honeypot — visually hidden, off-screen, no autocomplete. */}
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
            <div className="space-y-1.5">
              <Label htmlFor="name">Full name</Label>
              <Input
                id="name"
                required
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={loading}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="jane@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="h-10"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                placeholder="Min. 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="h-10"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="h-10 w-full">
              {loading ? <Loader size="sm" /> : "Create free account"}
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
                    Or sign up with
                  </span>
                </div>
              </div>
              <OAuthButtons callbackUrl="/" availability={availability} />
            </>
          )}

          <p className="text-center text-xs text-muted-foreground">
            By signing up you agree to our{" "}
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
            Already have an account?{" "}
            <Link href="/sign-in" className="font-medium text-primary hover:underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
