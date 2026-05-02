"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  ChevronRight,
  Code2,
  Compass,
  Database,
  Download,
  FileText,
  Fingerprint,
  HelpCircle,
  Home,
  KeyRound,
  Layers,
  PlayCircle,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Moon,
  Workflow,
  Wrench,
  Zap,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";
import { cn } from "@/lib/utils";

type IconType = React.ComponentType<{ className?: string }>;

interface NavItem {
  id: string;
  label: string;
  icon?: IconType;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV: NavGroup[] = [
  {
    title: "",
    items: [
      { id: "overview", label: "Home", icon: Home },
      { id: "getting-started", label: "Getting started", icon: PlayCircle },
      { id: "concepts", label: "Concepts", icon: Layers },
    ],
  },
  {
    title: "Core",
    items: [
      { id: "canvas", label: "Visual canvas" },
      { id: "schemas", label: "Workspaces & schemas" },
      { id: "linter", label: "Schema linter" },
      { id: "shortcuts", label: "Shortcuts & palette" },
    ],
  },
  {
    title: "Workflow",
    items: [
      { id: "templates", label: "Templates library" },
      { id: "csv-import", label: "CSV → table" },
      { id: "doc-gen", label: "AI doc-gen" },
      { id: "index-advisor", label: "Index advisor" },
      { id: "compare", label: "Compare schemas" },
      { id: "migration", label: "Migration SQL" },
      { id: "share", label: "Read-only share links" },
      { id: "comments", label: "Comments" },
      { id: "auto-arrange", label: "Auto-arrange" },
    ],
  },
  {
    title: "AI Assistant",
    items: [
      { id: "ai", label: "Bring your own key" },
      { id: "ai-providers", label: "Providers" },
      { id: "ai-capabilities", label: "Capabilities" },
    ],
  },
  {
    title: "SQL & Models",
    items: [
      { id: "sql", label: "SQL dialects" },
      { id: "models", label: "ORM models" },
      { id: "import-export", label: "Import & export" },
      { id: "mock-db", label: "Mock execution" },
    ],
  },
  {
    title: "Auth",
    items: [
      { id: "auth", label: "Email & OAuth" },
      { id: "auth-redirect", label: "Redirect URIs" },
      { id: "auth-troubleshoot", label: "Troubleshooting" },
    ],
  },
  {
    title: "Reference",
    items: [
      { id: "settings", label: "Settings" },
      { id: "security", label: "Security & privacy" },
      { id: "deployment", label: "Deployment" },
      { id: "faq", label: "FAQ", icon: HelpCircle },
    ],
  },
];

const QUICKSTART_CARDS = [
  {
    id: "getting-started",
    title: "Quickstart",
    description:
      "End-to-end guide: create an account, drop your first table, generate SQL, and connect AI in minutes.",
    icon: PlayCircle,
  },
  {
    id: "ai",
    title: "AI assistant",
    description:
      "Bring your own key for Google, OpenAI, Claude, Mistral, Grok, OpenRouter, or AWS Bedrock and design schemas in plain English.",
    icon: Sparkles,
  },
  {
    id: "auth",
    title: "Auth & OAuth",
    description:
      "Set up email + password, enable Google / GitHub / Microsoft sign-in, and whitelist the redirect URIs.",
    icon: KeyRound,
  },
  {
    id: "deployment",
    title: "Deploy",
    description:
      "Vercel, Docker, Compose, or self-hosted. Includes health check endpoint, hardening checklist, and migration commands.",
    icon: Workflow,
  },
];

const TOPIC_CARDS = [
  { id: "canvas", title: "Visual canvas", icon: Compass, blurb: "Drag-and-drop tables, relations, and indexes." },
  { id: "ai-providers", title: "AI providers", icon: Sparkles, blurb: "Seven supported providers, all BYOK." },
  { id: "sql", title: "SQL dialects", icon: Database, blurb: "PostgreSQL, MySQL, SQLite output." },
  { id: "models", title: "ORM models", icon: Boxes, blurb: "Prisma + Sequelize codegen." },
  { id: "import-export", title: "Import / export", icon: Download, blurb: "Paste DDL or upload .sql to rebuild the canvas." },
  { id: "linter", title: "Schema linter", icon: Fingerprint, blurb: "Real-time issues for missing PKs, FKs, naming." },
];

export default function DocsPage() {
  const { resolvedTheme, setTheme } = useTheme();
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [activeId, setActiveId] = useState<string>("overview");

  // Scroll-spy: highlight the sidebar entry whose section is currently
  // top-most in the viewport.
  useEffect(() => {
    const ids = NAV.flatMap((g) => g.items.map((i) => i.id));
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (sections.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        // Pick whichever section is closest to the top with positive y.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target?.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );
    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, []);

  const filteredNav = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV;
    return NAV.map((group) => ({
      ...group,
      items: group.items.filter((i) =>
        i.label.toLowerCase().includes(q)
      ),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  const dark = resolvedTheme === "dark";

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar — fixed on desktop */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-64 shrink-0 border-r bg-card md:flex md:flex-col"
        aria-label="Documentation navigation"
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <Link
            href="/"
            aria-label="Back to app"
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <Link href="/" className="flex items-center gap-2">
            <BrandMark />
            <span className="text-sm font-bold tracking-tight">
              Super Schema
            </span>
          </Link>
          <span className="ml-auto rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
            Docs
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {filteredNav.map((group, gi) => (
            <div key={gi} className={gi > 0 ? "mt-5" : ""}>
              {group.title ? (
                <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeId === item.id;
                  return (
                    <li key={item.id}>
                      <a
                        href={`#${item.id}`}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] transition-colors",
                          active
                            ? "bg-accent font-medium text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                        )}
                      >
                        {Icon ? (
                          <Icon
                            className={cn(
                              "size-4 shrink-0",
                              active ? "text-foreground" : "text-muted-foreground"
                            )}
                          />
                        ) : (
                          <span className="size-1 shrink-0 rounded-full bg-current opacity-40" />
                        )}
                        <span className="truncate">{item.label}</span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {filteredNav.length === 0 && (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              No matches.
            </p>
          )}
        </nav>
      </aside>

      {/* Main rail */}
      <div className="md:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
          <Link
            href="/"
            aria-label="Back"
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
          >
            <ArrowLeft className="size-4" />
          </Link>

          <label className="relative flex max-w-2xl flex-1 items-center">
            <Search className="pointer-events-none absolute left-3 size-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              type="search"
              placeholder="Search documentation"
              className="h-9 w-full rounded-lg border bg-card pl-9 pr-12 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground/30"
            />
            <kbd className="pointer-events-none absolute right-3 hidden rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline">
              ⌘K
            </kbd>
          </label>

          <button
            type="button"
            onClick={() => setTheme(dark ? "light" : "dark")}
            aria-label="Toggle theme"
            className="inline-flex size-9 items-center justify-center rounded-lg border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>

          {session?.user ? (
            <Link
              href="/projects"
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-foreground px-3 text-xs font-medium text-background hover:opacity-90"
            >
              Open app
              <ChevronRight className="size-3.5" />
            </Link>
          ) : (
            <Link
              href="/sign-in"
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-foreground px-3 text-xs font-medium text-background hover:opacity-90"
            >
              Sign in
              <ChevronRight className="size-3.5" />
            </Link>
          )}
        </header>

        {/* Content */}
        <main className="mx-auto w-full max-w-5xl px-5 pb-24 pt-10 sm:px-8">
          {/* Hero */}
          <section id="overview" className="scroll-mt-20">
            <p className="text-sm font-medium text-muted-foreground">
              Get setup
            </p>
            <h1 className="mt-1.5 text-4xl font-bold tracking-tight sm:text-5xl">
              Introducing the new Super Schema documentation
            </h1>
            <p className="mt-3 max-w-3xl text-base text-muted-foreground">
              Find the guides, references, and recipes you need to design
              databases visually, generate multi-dialect SQL, and ship
              schemas backed by your own AI provider.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {QUICKSTART_CARDS.map((card) => (
                <a
                  key={card.id}
                  href={`#${card.id}`}
                  className="group rounded-xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-sm"
                >
                  <div className="mb-3 flex size-10 items-center justify-center rounded-lg border bg-muted">
                    <card.icon className="size-4.5 text-foreground" />
                  </div>
                  <p className="text-sm font-semibold">{card.title}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {card.description}
                  </p>
                </a>
              ))}
            </div>
          </section>

          {/* Topics */}
          <section className="mt-16">
            <h2 className="text-2xl font-bold tracking-tight">
              Explore by topic
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Dive into the area you care about right now.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {TOPIC_CARDS.map((card) => (
                <a
                  key={card.id}
                  href={`#${card.id}`}
                  className="group flex items-start gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-foreground/20 hover:bg-accent/40"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <card.icon className="size-4 text-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{card.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {card.blurb}
                    </p>
                  </div>
                  <ChevronRight className="mt-1 size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </a>
              ))}
            </div>
          </section>

          {/* Long-form sections */}
          <div className="mt-16 space-y-16">
            <Section id="getting-started" eyebrow="Quickstart" title="Getting started" icon={PlayCircle}>
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed">
                <li>
                  Create an account at <code>/sign-up</code> (email + password) or
                  continue with Google, GitHub, or Microsoft if your admin enabled
                  them.
                </li>
                <li>A default <i>Workspace → Project → Schema</i> is seeded for you.</li>
                <li>
                  Open the canvas. Click <b>Edit → Add table</b>, or right-click
                  the canvas to add tables and relations.
                </li>
                <li>
                  Pick a SQL dialect in the bottom panel. The SQL updates live as
                  you edit.
                </li>
                <li>
                  To unlock AI features, open <Link href="/settings#ai" className="text-primary hover:underline">Settings → AI</Link> and add your provider + API key.
                </li>
              </ol>
            </Section>

            <Section id="concepts" eyebrow="Concepts" title="Workspaces, projects, schemas" icon={Layers}>
              <DefList
                items={[
                  { term: "Workspace", desc: "Top-level container. Each user starts with one. Use multiple workspaces to separate teams or apps." },
                  { term: "Project", desc: "A folder for related schemas inside a workspace (e.g. Billing, CRM)." },
                  { term: "Schema", desc: "A canvas of tables, columns, indexes, and relations. Auto-saves as you edit." },
                ]}
              />
            </Section>

            <Section id="canvas" eyebrow="Canvas" title="Visual canvas" icon={Workflow}>
              <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                <li><b>Drag</b> tables to reposition them. Position auto-saves.</li>
                <li><b>Drag handles</b> on a column to draw a relation to another table&apos;s column.</li>
                <li><b>Right-click</b> a node, edge, or empty space for contextual actions.</li>
                <li><b>Auto-arrange</b> button (bottom-left controls) lays out tables by FK depth.</li>
                <li><b>Mini-map</b> on desktop helps navigate large schemas.</li>
                <li><b>Export PNG</b> from <i>File → Export canvas as PNG</i>.</li>
                <li><b>Undo / Redo</b> with <Kbd>⌘</Kbd>+<Kbd>Z</Kbd> / <Kbd>⌘</Kbd>+<Kbd>⇧</Kbd>+<Kbd>Z</Kbd>.</li>
              </ul>
            </Section>

            <Section id="schemas" eyebrow="Persistence" title="Workspaces & schemas" icon={FileText}>
              <p className="text-sm leading-relaxed">
                Every edit triggers a debounced auto-save with optimistic
                locking. If two tabs edit at once, the older save returns 409
                and the canvas refreshes to the latest version.
              </p>
              <p className="mt-2 text-sm leading-relaxed">
                Switch the active schema from the sidebar dropdown — the
                canvas state is replaced and the previous schema&apos;s
                pending save is cancelled cleanly.
              </p>
            </Section>

            <Section id="linter" eyebrow="Quality" title="Schema linter" icon={Fingerprint}>
              <p className="text-sm leading-relaxed">
                The sidebar lint panel runs on every edit and surfaces:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>Tables without a primary key</li>
                <li>Columns without a type or name</li>
                <li>Foreign keys pointing at missing tables / columns</li>
                <li>Duplicate table or column names</li>
                <li>Orphan tables (no relations)</li>
                <li>Snake_case violations and SQL reserved-word names</li>
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Click any issue to focus the offending table on the canvas.
              </p>
            </Section>

            <Section id="templates" eyebrow="Workflow" title="Templates library" icon={Layers}>
              <p className="text-sm leading-relaxed">
                Bundled starter schemas: <b>E-commerce</b>, <b>SaaS / Multi-tenant</b>,
                <b> Blog / CMS</b>, <b>Auth (NextAuth-style)</b>, <b>Inventory</b>.
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                <li>Open <b>File → Templates library…</b></li>
                <li>Pick a template — preview shows tables, columns, comments.</li>
                <li>Click <b>Load template</b>. Loading replaces the current canvas (confirmation prompt if not empty).</li>
              </ol>
            </Section>

            <Section id="csv-import" eyebrow="Workflow" title="CSV → table" icon={FileText}>
              <p className="text-sm leading-relaxed">
                Drop a CSV; the app proposes a table by sampling the first 200
                rows. Open <b>File → Import CSV as table…</b>.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>Auto-detected delimiter (<code>,</code> / <code>;</code> / tab / <code>|</code>) and RFC 4180 quoting.</li>
                <li>Type inference: <code>BOOLEAN</code>, <code>INT</code>/<code>BIGINT</code>, <code>DOUBLE</code>, <code>UUID</code>, <code>TIMESTAMP</code>, <code>DATE</code>, <code>TIME</code>, <code>VARCHAR</code>/<code>TEXT</code>.</li>
                <li>Detects nullable + unique columns from the sample.</li>
                <li>Override any column type or pick the primary-key column before adding.</li>
                <li>Max file size: 10 MB.</li>
              </ul>
            </Section>

            <Section id="doc-gen" eyebrow="AI" title="AI doc-gen" icon={Sparkles}>
              <p className="text-sm leading-relaxed">
                Auto-generates table and column comments using your configured
                AI provider. Open <b>Schema → AI doc-gen…</b>.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>Per-table and per-column suggestions with checkboxes — apply only what you want.</li>
                <li><b>Overwrite existing</b> toggle preserves your current comments by default.</li>
                <li>Comments are short, plain-English (under 100 chars), focused on <i>why</i> rather than restating the name.</li>
                <li>Requires an AI key — see <a href="#ai" className="text-primary hover:underline">Bring your own key</a>.</li>
              </ul>
            </Section>

            <Section id="index-advisor" eyebrow="Performance" title="Index advisor" icon={Zap}>
              <p className="text-sm leading-relaxed">
                Suggests indexes for join and lookup performance. Open{" "}
                <b>Schema → Index advisor…</b>.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li><b>Rule-based candidates</b> (always on): every FK source column, common lookup names (<code>email</code>, <code>slug</code>, <code>status</code>…), timestamp columns.</li>
                <li><b>Ask AI</b> button augments with deeper, ranked suggestions including compound indexes.</li>
                <li>Skips columns already covered by a PRIMARY KEY, UNIQUE constraint, or existing index.</li>
                <li>Pick which to apply — adds them to the schema with sensible names.</li>
              </ul>
            </Section>

            <Section id="compare" eyebrow="Workflow" title="Compare schemas" icon={Compass}>
              <p className="text-sm leading-relaxed">
                Diff two schemas across any of your projects. Open{" "}
                <b>Schema → Compare schemas…</b>.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>Pick a <b>From (old)</b> and <b>To (new)</b> schema; swap with the arrow button.</li>
                <li><b>Changes</b> tab lists added / removed / modified tables, columns, and relations.</li>
                <li><b>Migration SQL</b> tab generates the corresponding ALTER statements (see below).</li>
              </ul>
            </Section>

            <Section id="migration" eyebrow="Workflow" title="Migration SQL generator" icon={Database}>
              <p className="text-sm leading-relaxed">
                The compare dialog&apos;s second tab outputs migration SQL for
                PostgreSQL, MySQL, or SQLite.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li><code>CREATE TABLE</code> for added tables (with FK constraints inline).</li>
                <li><code>DROP TABLE … CASCADE</code> for removed tables.</li>
                <li>
                  <code>ALTER TABLE … ADD / DROP / MODIFY COLUMN</code>,{" "}
                  <code>ALTER COLUMN TYPE</code>, <code>SET / DROP NOT NULL</code>, default changes.
                </li>
                <li>FK add/drop on existing tables, with dialect-correct syntax.</li>
                <li>Inline warnings when a change can lose data or fail (e.g. NOT NULL on an existing table).</li>
                <li>SQLite limitations are flagged as comments where ALTER isn&apos;t supported.</li>
              </ul>
            </Section>

            <Section id="share" eyebrow="Collaboration" title="Read-only share links" icon={KeyRound}>
              <p className="text-sm leading-relaxed">
                Generate a public URL anyone can view — no sign-in required.
                Open <b>Schema → Share read-only…</b>.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>One active link per schema; reusing the action returns the existing token.</li>
                <li>Viewers see the canvas with all tables, relations, and comments — but cannot edit, save, or run queries.</li>
                <li><b>Revoke link</b> soft-disables it instantly.</li>
                <li>Pages are marked <code>noindex</code> so search engines don&apos;t crawl them.</li>
              </ul>
            </Section>

            <Section id="comments" eyebrow="Documentation" title="Comments on tables & columns" icon={FileText}>
              <p className="text-sm leading-relaxed">
                Comments surface as hover popovers on the canvas. A filled cyan
                speech-bubble means a comment exists; hover an empty row to see
                a faded &quot;add comment&quot; affordance.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>Click the bubble → inline-editable popover.</li>
                <li>Auto-saves on blur, <Kbd>⌘</Kbd>+<Kbd>↵</Kbd>, or <i>Done</i>. <Kbd>Esc</Kbd> discards.</li>
                <li>Trash icon clears the comment.</li>
                <li>PostgreSQL exports comments as <code>COMMENT ON</code> statements; MySQL as inline <code>COMMENT</code> clauses.</li>
              </ul>
            </Section>

            <Section id="auto-arrange" eyebrow="Canvas" title="Auto-arrange" icon={Workflow}>
              <p className="text-sm leading-relaxed">
                The bottom-left auto-arrange button uses a Sugiyama-style
                layered layout with virtual-node insertion so edges spanning
                multiple layers don&apos;t cross through other tables.
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li>Splits the schema into connected components; orphans grid below.</li>
                <li>Reverses back-edges to flatten cycles into a left-to-right DAG.</li>
                <li>Multi-pass barycentric crossing reduction.</li>
                <li>Centroid pull + collision sweep so siblings line up with their parent rows.</li>
              </ul>
            </Section>

            <Section id="shortcuts" eyebrow="Productivity" title="Shortcuts & command palette" icon={Zap}>
              <ul className="grid gap-2 sm:grid-cols-2">
                <ShortcutRow keys={["?"]} desc="Open the keyboard shortcuts overlay" />
                <ShortcutRow keys={["⌘", "K"]} desc="Command palette — jump to any table or page" />
                <ShortcutRow keys={["⌘", "Z"]} desc="Undo canvas edit" />
                <ShortcutRow keys={["⌘", "⇧", "Z"]} desc="Redo canvas edit" />
                <ShortcutRow keys={["⌘", "T"]} desc="Add table" />
                <ShortcutRow keys={["⌘", "N"]} desc="New schema" />
                <ShortcutRow keys={["Esc"]} desc="Close menus and dialogs" />
              </ul>
            </Section>

            <Section id="ai" eyebrow="AI assistant" title="Bring your own key" icon={Sparkles}>
              <p className="text-sm leading-relaxed">
                The AI assistant calls your chosen provider with{" "}
                <b>your</b> API key. Keys are encrypted at rest with
                AES-256-GCM (key derived from <code>AUTH_SECRET</code> via
                SHA-256) and only decrypted server-side per request — never
                returned to the client.
              </p>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
                <li>Open <Link href="/settings#ai" className="text-primary hover:underline">Settings → AI</Link>.</li>
                <li>Pick a provider from the list.</li>
                <li>(Optional) Override the default model name.</li>
                <li>Paste your key and click <b>Save AI settings</b>. Save automatically validates the key with a 1-token test call.</li>
                <li>Toggle <b>Enable AI features</b> off to fully disable the assistant without losing the key.</li>
              </ol>
            </Section>

            <Section id="ai-providers" eyebrow="AI assistant" title="Supported providers" icon={Sparkles}>
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Provider</th>
                      <th className="px-3 py-2 text-left font-medium">Default model</th>
                      <th className="px-3 py-2 text-left font-medium">Auth</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    <ProviderRow name="Google Gemini" model="gemini-2.5-flash" auth="API key" />
                    <ProviderRow name="OpenAI" model="gpt-4o-mini" auth="API key" />
                    <ProviderRow name="Anthropic Claude" model="claude-sonnet-4-6" auth="API key" />
                    <ProviderRow name="Mistral AI" model="mistral-large-latest" auth="API key" />
                    <ProviderRow name="OpenRouter" model="openai/gpt-4o-mini" auth="API key" />
                    <ProviderRow name="xAI Grok" model="grok-2-latest" auth="API key" />
                    <ProviderRow name="AWS Bedrock" model="anthropic.claude-3-5-sonnet-20240620-v1:0" auth="Access key + secret + region" />
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                OpenRouter and Grok ride on the OpenAI-compatible REST API
                with custom <code>baseURL</code>s. Bedrock requires AWS
                credentials with <code>bedrock:InvokeModel</code> permission
                for the chosen foundation model.
              </p>
            </Section>

            <Section id="ai-capabilities" eyebrow="AI assistant" title="Capabilities" icon={Compass}>
              <ul className="grid gap-2 sm:grid-cols-2">
                <Capability title="Generate schema" desc="Plain-English description → normalized tables and FK relations." />
                <Capability title="Explain schema" desc="Human-readable narrative of your current canvas." />
                <Capability title="Fix schema" desc="Detect bad design, propose a refactored schema." />
                <Capability title="Generate query" desc="Natural-language question → ready-to-run SQL." />
                <Capability title="Optimize query" desc="Rewrite SQL for index use and selectivity." />
                <Capability title="Explain query" desc="Step-by-step explanation of an existing query." />
              </ul>
            </Section>

            <Section id="sql" eyebrow="Output" title="SQL dialects" icon={Database}>
              <p className="text-sm leading-relaxed">
                The SQL panel renders <code>CREATE TABLE</code>, indexes,
                and FK constraints for the active schema. Switch the
                dialect tab to retarget output:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li><b>PostgreSQL</b> — <code>SERIAL</code>, <code>BOOLEAN</code>, <code>TIMESTAMP</code>.</li>
                <li><b>MySQL</b> — <code>AUTO_INCREMENT</code>, <code>DATETIME</code>.</li>
                <li><b>SQLite</b> — <code>INTEGER PRIMARY KEY AUTOINCREMENT</code>.</li>
              </ul>
              <p className="mt-3 text-sm">
                Use <i>Copy</i> or <i>Download .sql</i> to export.
              </p>
            </Section>

            <Section id="models" eyebrow="Codegen" title="ORM models" icon={Boxes}>
              <p className="text-sm leading-relaxed">
                The Models tab generates type-safe model files:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li><b>Prisma</b> — <code>schema.prisma</code> with field types, relations, and indexes.</li>
                <li><b>Sequelize</b> — TypeScript model classes with associations.</li>
              </ul>
            </Section>

            <Section id="import-export" eyebrow="Round-trip" title="Import & export" icon={Download}>
              <h3 className="mt-0 text-base font-semibold">Import</h3>
              <p className="text-sm">
                Paste DDL or upload a <code>.sql</code> file in the SQL Import tab. Auto-detects PostgreSQL, MySQL, or SQLite, or specify the dialect explicitly. Files up to 5 MB.
              </p>
              <h3 className="mt-4 text-base font-semibold">Export</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                <li><b>SQL</b> — <code>.sql</code> file in the active dialect.</li>
                <li><b>JSON</b> — full schema as JSON.</li>
                <li><b>Models</b> — Prisma or Sequelize source.</li>
                <li><b>PNG</b> — current canvas snapshot.</li>
              </ul>
            </Section>

            <Section id="mock-db" eyebrow="Run" title="Mock query execution" icon={Code2}>
              <p className="text-sm leading-relaxed">
                The query builder ships generated SQL to an in-browser{" "}
                <code>sql.js</code> sandbox seeded with realistic fake
                data via <code>@faker-js/faker</code>. Results render in a
                table with column types and execution time.
              </p>
              <p className="mt-2 text-sm leading-relaxed">
                <code>DROP</code>, <code>DELETE</code>, and{" "}
                <code>TRUNCATE</code> are rejected by the safety layer.
              </p>
            </Section>

            <Section id="auth" eyebrow="Accounts" title="Email & OAuth" icon={KeyRound}>
              <p className="text-sm leading-relaxed">
                Email/password is always available. Optional OAuth via
                Google, GitHub, and Microsoft. Each provider activates
                only when its env vars are set; new OAuth users are
                auto-seeded with a workspace, project, and schema on
                first sign-in.
              </p>
              <h3 className="mt-4 text-base font-semibold">Required env vars</h3>
              <CodeBlock>{`AUTH_SECRET=...               # 32+ random bytes (run: make auth-secret)
NEXTAUTH_URL=https://your.host  # exact public origin, no trailing slash

# Google — https://console.cloud.google.com/apis/credentials
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...

# GitHub — https://github.com/settings/developers
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...

# Microsoft Entra ID — https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps
AUTH_MICROSOFT_ID=...
AUTH_MICROSOFT_SECRET=...
AUTH_MICROSOFT_TENANT=common  # or your tenant GUID`}</CodeBlock>
            </Section>

            <Section id="auth-redirect" eyebrow="Auth" title="OAuth redirect URIs" icon={Compass}>
              <p className="text-sm leading-relaxed">
                Visit{" "}
                <Link href="/settings#connections" className="text-primary hover:underline">
                  Settings → Connections
                </Link>
                {" "}to copy the live URLs derived from your origin. Pattern:
              </p>
              <CodeBlock>{`<NEXTAUTH_URL>/api/auth/callback/google
<NEXTAUTH_URL>/api/auth/callback/github
<NEXTAUTH_URL>/api/auth/callback/microsoft-entra-id`}</CodeBlock>
              <h3 className="mt-4 text-base font-semibold">Per-provider quirks</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li><b>Google</b>: also add the bare origin under "Authorized JavaScript origins".</li>
                <li><b>GitHub</b>: set both "Homepage URL" and "Authorization callback URL".</li>
                <li><b>Microsoft</b>: register a Web platform redirect URI. Tenant <code>common</code> = multi-tenant; use a tenant GUID for single-tenant apps.</li>
              </ul>
            </Section>

            <Section id="auth-troubleshoot" eyebrow="Auth" title="Troubleshooting" icon={Wrench}>
              <DefList
                items={[
                  {
                    term: "redirect_uri_mismatch",
                    desc: "Hit /api/auth/debug to see the exact callbackUrl the server hands to the provider. Paste it byte-for-byte into the provider console.",
                  },
                  {
                    term: "Login bounces back to /sign-in",
                    desc: "Check AUTH_SECRET is set in env, and NEXTAUTH_URL matches the browser origin (no trailing slash, http vs https). Restart dev / redeploy after any env change.",
                  },
                  {
                    term: "Can't reach database server",
                    desc: "DATABASE_URL is malformed. Format: postgresql://user:pass@host:5432/dbname. Check /api/health to see the parsed dbHost.",
                  },
                ]}
              />
            </Section>

            <Section id="settings" eyebrow="Reference" title="Settings" icon={Settings}>
              <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                <li><b>Account</b> — name, email (read-only), avatar URL.</li>
                <li><b>AI</b> — provider, model override, encrypted API key, master enable/disable, manual test connection.</li>
                <li><b>Appearance</b> — theme: light, dark, system.</li>
                <li><b>Connections</b> — linked OAuth providers + live redirect URIs to whitelist.</li>
              </ul>
            </Section>

            <Section id="security" eyebrow="Reference" title="Security & privacy" icon={ShieldCheck}>
              <ul className="list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                <li>API keys encrypted with AES-256-GCM. Only a masked preview (first 4 / last 4) ever returns to the client.</li>
                <li>Passwords hashed with bcrypt (cost 10).</li>
                <li>Mock query execution runs in an in-browser SQLite sandbox; <code>DROP</code> / <code>DELETE</code> / <code>TRUNCATE</code> rejected.</li>
                <li>Sessions are JWT-based; the Prisma adapter persists OAuth accounts + user records.</li>
                <li>Per-route rate limits on /api/ai (20/min/user), /api/sign-up (5/h/IP), /api/mock-db (30/min/user), /api/settings/validate-key (6/min/user).</li>
                <li>Honeypot field on sign-up; OAuth account-linking-by-email disabled.</li>
              </ul>
            </Section>

            <Section id="deployment" eyebrow="Reference" title="Deployment" icon={Workflow}>
              <p className="text-sm leading-relaxed">
                Three supported paths — all in <code>DEPLOY.md</code>:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                <li><b>Vercel</b> — push the repo, set env vars, optionally chain <code>prisma migrate deploy</code> in the build command.</li>
                <li><b>Docker</b> — multi-stage <code>Dockerfile</code> built from <code>node:20-alpine</code>; runs as non-root, exposes <code>/api/health</code>.</li>
                <li><b>Compose</b> — <code>docker-compose.yml</code> bundles app + Postgres 16 with healthchecks and named volume.</li>
              </ul>
            </Section>

            <Section id="faq" eyebrow="FAQ" title="Frequently asked questions" icon={HelpCircle}>
              <DefList
                items={[
                  { term: "Do you train on my schemas?", desc: "No. Schemas live in your own Postgres. AI calls go directly to your provider with your key." },
                  { term: "Can I self-host?", desc: "Yes. Clone the repo, set env vars, run make setup, then make dev." },
                  { term: "Which model should I use?", desc: "Default gemini-2.5-flash is fast + cheap. Use larger models for stronger reasoning on complex domains." },
                  { term: "How do I delete my account?", desc: "Account deletion isn't self-serve yet. Email support to request removal." },
                ]}
              />
            </Section>
          </div>

          <footer className="mt-20 border-t pt-6 text-xs text-muted-foreground">
            <p>
              Last updated: 2026-05. Found a doc bug?{" "}
              <Link href="/settings" className="text-primary hover:underline">
                Report from settings
              </Link>
              .
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}

// ---- helpers --------------------------------------------------------------

function BrandMark() {
  return (
    <div className="flex size-7 items-center justify-center rounded-lg bg-primary/15">
      <svg viewBox="0 0 120 120" className="size-5" aria-hidden>
        <rect x="10" y="50" width="12" height="55" rx="6" fill="#a78bfa" />
        <rect x="30" y="30" width="12" height="75" rx="6" fill="#8b5cf6" />
        <rect x="50" y="15" width="12" height="90" rx="6" fill="#7c3aed" />
        <rect x="70" y="35" width="12" height="70" rx="6" fill="#8b5cf6" />
        <rect x="90" y="55" width="12" height="50" rx="6" fill="#a78bfa" />
      </svg>
    </div>
  );
}

function Section({
  id,
  eyebrow,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  eyebrow?: string;
  title: string;
  icon: IconType;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24">
      {eyebrow && (
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {eyebrow}
        </p>
      )}
      <div className="mb-4 flex items-center gap-2.5">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-4" />
        </div>
        <h2 className="m-0 text-2xl font-bold tracking-tight">{title}</h2>
      </div>
      <div className="text-sm leading-relaxed text-foreground/90">{children}</div>
    </section>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex min-w-5 items-center justify-center rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground">
      {children}
    </kbd>
  );
}

function ShortcutRow({ keys, desc }: { keys: string[]; desc: string }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border bg-card px-3 py-2 text-xs">
      <span>{desc}</span>
      <span className="flex items-center gap-1">
        {keys.map((k, i) => (
          <span key={i} className="flex items-center gap-1">
            {i > 0 && <span className="text-muted-foreground">+</span>}
            <Kbd>{k}</Kbd>
          </span>
        ))}
      </span>
    </li>
  );
}

function DefList({
  items,
}: {
  items: { term: string; desc: string }[];
}) {
  return (
    <dl className="divide-y rounded-xl border bg-card">
      {items.map((it) => (
        <div key={it.term} className="grid gap-1 px-4 py-3 sm:grid-cols-[180px_1fr] sm:gap-4">
          <dt className="text-sm font-semibold">{it.term}</dt>
          <dd className="text-sm text-muted-foreground">{it.desc}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProviderRow({
  name,
  model,
  auth,
}: {
  name: string;
  model: string;
  auth: string;
}) {
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-3 py-2 font-medium">{name}</td>
      <td className="px-3 py-2 font-mono text-[12px] text-muted-foreground">{model}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{auth}</td>
    </tr>
  );
}

function Capability({ title, desc }: { title: string; desc: string }) {
  return (
    <li className="rounded-lg border bg-card p-3 text-sm">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
    </li>
  );
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed">
      <code>{children}</code>
    </pre>
  );
}
