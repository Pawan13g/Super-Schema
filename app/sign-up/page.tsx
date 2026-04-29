"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Database } from "lucide-react";

export default function SignUpPage() {
  const router = useRouter();

  const [name, setName] = useState("Pawan Guptas");
  const [email, setEmail] = useState("pawangupta130803@gmail.com");
  const [password, setPassword] = useState("1234567890");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.SubmitEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/sign-up", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    }); 
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Sign-up failed.");
      setLoading(false);
      return;
    }

    // Auto sign-in
    const signed = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);
    if (signed?.error) {
      router.push("/sign-in");
      return;
    }
    router.push("/");
    router.refresh();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <div className="w-full max-w-sm rounded-xl border bg-card p-6 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="rounded-lg bg-violet-500/10 p-2">
            <Database className="size-6 text-violet-600 dark:text-violet-400" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            Create your account
          </h1>
          <p className="text-xs text-muted-foreground">
            Spin up your first Super Schema workspace.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="name" className="text-xs">
              Name
            </Label>
            <Input
              id="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="email" className="text-xs">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="password" className="text-xs">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <p className="text-[10px] text-muted-foreground">
              At least 8 characters.
            </p>
          </div>

          {error && (
            <p className="rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </p>
          )}

          <Button type="submit" disabled={loading} className="mt-1">
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Create account"
            )}
          </Button>
        </form>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Already have an account?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-violet-600 hover:underline dark:text-violet-400"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
