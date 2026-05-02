import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { ReadOnlyCanvas } from "@/components/canvas/readonly-canvas";
import { ThemeToggle } from "@/components/theme-toggle";
import type { Schema } from "@/lib/types";
import { Eye } from "lucide-react";

interface ShareData {
  schema: {
    name: string;
    projectName: string;
    schemaJson: Schema;
    updatedAt: string;
  };
}

async function fetchShare(token: string): Promise<ShareData | null> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const res = await fetch(`${proto}://${host}/api/share/${token}`, {
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as ShareData;
}

export const dynamic = "force-dynamic";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await fetchShare(token);
  if (!data) notFound();

  const { schema } = data;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-background">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-card/60 px-3 backdrop-blur-sm">
        <Link href="/landing" className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-primary/15">
            <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
              <rect x="2" y="10" width="2.5" height="11" rx="1" fill="#a78bfa" />
              <rect x="6" y="6" width="2.5" height="15" rx="1" fill="#8b5cf6" />
              <rect x="10" y="3" width="2.5" height="18" rx="1" fill="#7c3aed" />
              <rect x="14" y="7" width="2.5" height="14" rx="1" fill="#8b5cf6" />
              <rect x="18" y="11" width="2.5" height="10" rx="1" fill="#a78bfa" />
            </svg>
          </div>
          <span className="text-sm font-bold tracking-tight">Super Schema</span>
        </Link>

        <div className="ml-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            <Eye className="mr-1 inline size-3 -translate-y-px" />
            read-only
          </span>
          <span className="hidden truncate text-foreground sm:inline">
            {schema.projectName} / {schema.name}
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/landing"
            className="rounded-md border bg-background px-2.5 py-1 text-[11px] font-medium hover:bg-muted"
          >
            Build your own
          </Link>
        </div>
      </header>

      <div className="flex-1">
        <ReadOnlyCanvas schema={schema.schemaJson} />
      </div>
    </div>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await fetchShare(token);
  if (!data) return { title: "Shared schema not found" };
  return {
    title: `${data.schema.name} — shared schema`,
    description: `Read-only view of ${data.schema.name} (${data.schema.projectName}).`,
    robots: { index: false, follow: false },
  };
}
