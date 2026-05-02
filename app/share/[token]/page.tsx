import { notFound } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { ReadOnlyCanvas } from "@/components/canvas/readonly-canvas";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/brand/logo";
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
          <Logo size={24} />
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
