"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  BookOpen,
  Boxes,
  Database,
  Download,
  KeyRound,
  Layers,
  Sparkles,
  Workflow,
  ShieldCheck,
  Settings,
  PlayCircle,
  Zap,
  Wrench,
  HelpCircle,
} from "lucide-react";

const sections = [
  { id: "overview", title: "Overview", icon: BookOpen },
  { id: "getting-started", title: "Getting started", icon: PlayCircle },
  { id: "concepts", title: "Concepts", icon: Layers },
  { id: "canvas", title: "Canvas & React Flow", icon: Workflow },
  { id: "ai", title: "AI assistant (BYOK)", icon: Sparkles },
  { id: "sql", title: "SQL & dialects", icon: Database },
  { id: "models", title: "ORM models", icon: Boxes },
  { id: "import-export", title: "Import / export", icon: Download },
  { id: "auth", title: "Accounts & OAuth", icon: KeyRound },
  { id: "settings", title: "Settings", icon: Settings },
  { id: "shortcuts", title: "Shortcuts", icon: Zap },
  { id: "security", title: "Security & privacy", icon: ShieldCheck },
  { id: "troubleshooting", title: "Troubleshooting", icon: Wrench },
  { id: "faq", title: "FAQ", icon: HelpCircle },
];

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur-sm">
        <Link
          href="/"
          aria-label="Back"
          className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div className="flex items-center gap-2">
          <BookOpen className="size-4 text-primary" />
          <h1 className="text-sm font-semibold">Super Schema — Documentation</h1>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/settings"
            className="inline-flex h-7 items-center gap-1 rounded-md border bg-background px-2.5 text-xs font-medium hover:bg-muted"
          >
            <Settings className="size-3.5" />
            Settings
          </Link>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl gap-8 px-4 py-8 sm:px-6 lg:px-8">
        <aside className="sticky top-20 hidden h-fit w-56 shrink-0 lg:block">
          <nav className="rounded-xl border bg-card p-2 shadow-sm">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Contents
            </p>
            <ul className="space-y-0.5">
              {sections.map(({ id, title, icon: Icon }) => (
                <li key={id}>
                  <a
                    href={`#${id}`}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground"
                  >
                    <Icon className="size-3.5 text-muted-foreground" />
                    {title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        <main className="prose prose-sm dark:prose-invert max-w-none flex-1 space-y-12">
          <Section id="overview" title="Overview" icon={BookOpen}>
            <p>
              Super Schema is a visual database designer. You drag tables onto a
              canvas, draw relationships, and the app generates SQL, ORM models,
              and runnable queries — all in your browser. An optional AI
              assistant turns plain-English descriptions into schemas, explains
              your design, and writes queries.
            </p>
            <ul>
              <li><b>Visual canvas</b> — React Flow nodes for tables, edges for FKs.</li>
              <li><b>Multi-dialect SQL</b> — PostgreSQL, MySQL, SQLite output.</li>
              <li><b>ORM models</b> — Prisma and Sequelize generation.</li>
              <li><b>BYOK AI</b> — bring your own Google or OpenAI key.</li>
              <li><b>Workspaces / Projects / Schemas</b> — organize many designs.</li>
              <li><b>Mock execution</b> — run queries against in-memory SQLite with seeded data.</li>
            </ul>
          </Section>

          <Section id="getting-started" title="Getting started" icon={PlayCircle}>
            <ol>
              <li>
                Create an account at <code>/sign-up</code> (email + password) or
                continue with Google, GitHub, or Microsoft if your admin enabled
                them.
              </li>
              <li>
                A default <i>Workspace → Project → Schema</i> is seeded for you.
              </li>
              <li>
                Open the canvas. Click <b>Edit → Add table</b>, or right-click
                the canvas to add tables and relations.
              </li>
              <li>
                Pick a SQL dialect in the bottom panel. The SQL updates live as
                you edit the schema.
              </li>
              <li>
                To unlock AI features, open <Link href="/settings">Settings → AI</Link>{" "}
                and add your provider + API key.
              </li>
            </ol>
          </Section>

          <Section id="concepts" title="Concepts" icon={Layers}>
            <h3>Workspace</h3>
            <p>The top-level container. Each user starts with one workspace. Use multiple workspaces to separate teams or apps.</p>
            <h3>Project</h3>
            <p>A folder for related schemas inside a workspace (e.g. &ldquo;Billing&rdquo;, &ldquo;CRM&rdquo;).</p>
            <h3>Schema</h3>
            <p>A single canvas of tables, columns, indexes, and relations. Auto-saves as you edit.</p>
          </Section>

          <Section id="canvas" title="Canvas & React Flow" icon={Workflow}>
            <ul>
              <li><b>Drag</b> tables to reposition them. Position auto-saves.</li>
              <li><b>Drag handles</b> on a column to draw a relation to another table&apos;s column.</li>
              <li><b>Right-click</b> a node, edge, or empty space for contextual actions.</li>
              <li><b>Auto-arrange</b> button (bottom-left controls) lays out tables by FK depth.</li>
              <li><b>Mini-map</b> on desktop helps navigate large schemas.</li>
              <li><b>Export PNG</b> from <i>File → Export canvas as PNG</i>.</li>
            </ul>
          </Section>

          <Section id="ai" title="AI assistant (Bring Your Own Key)" icon={Sparkles}>
            <p>
              The AI assistant requires <b>your</b> API key for either Google
              Gemini or OpenAI. Keys are encrypted at rest with AES-256-GCM
              using your <code>AUTH_SECRET</code> as the master key, and only
              decrypted server-side per request.
            </p>
            <h3>Setting up</h3>
            <ol>
              <li>Open <Link href="/settings">Settings → AI</Link>.</li>
              <li>
                Pick a provider:
                <ul>
                  <li><b>Google Gemini</b> — get a key at{" "}
                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer">aistudio.google.com/app/apikey</a>
                  </li>
                  <li><b>OpenAI</b> — get a key at{" "}
                    <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">platform.openai.com/api-keys</a>
                  </li>
                </ul>
              </li>
              <li>(Optional) Override the model. Defaults: <code>gemini-2.5-flash</code>, <code>gpt-4o-mini</code>.</li>
              <li>Paste your key and click <b>Save AI settings</b>.</li>
              <li>Toggle off <b>Enable AI features</b> to fully disable the assistant.</li>
            </ol>
            <h3>Capabilities</h3>
            <ul>
              <li>Generate a schema from a description.</li>
              <li>Explain the current schema in plain English.</li>
              <li>Detect bad design and propose a fixed schema.</li>
              <li>Generate SQL queries from natural-language questions.</li>
              <li>Optimize and explain existing queries.</li>
            </ul>
          </Section>

          <Section id="sql" title="SQL & dialects" icon={Database}>
            <p>
              The SQL panel renders <code>CREATE TABLE</code>, indexes, and
              foreign-key constraints for your active schema. Switch the dialect
              tab to retarget output:
            </p>
            <ul>
              <li><b>PostgreSQL</b> — uses <code>SERIAL</code>, <code>BOOLEAN</code>, <code>TIMESTAMP</code>.</li>
              <li><b>MySQL</b> — uses <code>AUTO_INCREMENT</code>, <code>DATETIME</code>.</li>
              <li><b>SQLite</b> — minimal types, <code>INTEGER PRIMARY KEY AUTOINCREMENT</code>.</li>
            </ul>
            <p>Use <i>Copy</i> or <i>Download .sql</i> to export.</p>
          </Section>

          <Section id="models" title="ORM models" icon={Boxes}>
            <p>
              The <i>Models</i> tab generates type-safe model files:
            </p>
            <ul>
              <li><b>Prisma</b> — <code>schema.prisma</code> with field types, relations, and indexes.</li>
              <li><b>Sequelize</b> — TypeScript model classes with associations.</li>
            </ul>
          </Section>

          <Section id="import-export" title="Import / export" icon={Download}>
            <h3>Import</h3>
            <p>
              The <i>SQL Import</i> tab parses pasted DDL (PostgreSQL, MySQL,
              SQLite, or auto-detect) and rebuilds the canvas.
            </p>
            <h3>Export</h3>
            <ul>
              <li><b>SQL</b> — <code>.sql</code> file in the active dialect.</li>
              <li><b>JSON</b> — full schema as JSON.</li>
              <li><b>Models</b> — Prisma or Sequelize source.</li>
              <li><b>PNG</b> — current canvas snapshot.</li>
            </ul>
          </Section>

          <Section id="auth" title="Accounts & OAuth" icon={KeyRound}>
            <p>
              The app supports email/password plus optional OAuth via Google,
              GitHub, and Microsoft. OAuth providers are enabled by setting the
              following env vars:
            </p>
            <pre className="rounded-md border bg-muted/30 p-3 text-xs"><code>{`AUTH_SECRET=...
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_GITHUB_ID=...
AUTH_GITHUB_SECRET=...
AUTH_MICROSOFT_ID=...
AUTH_MICROSOFT_SECRET=...
AUTH_MICROSOFT_TENANT=common  # or your tenant ID`}</code></pre>
            <p>
              Each provider activates only when its pair of env vars is
              present. New OAuth users are auto-seeded with a workspace,
              project, and schema on first sign-in.
            </p>
          </Section>

          <Section id="settings" title="Settings" icon={Settings}>
            <ul>
              <li><b>Profile</b> — display name and avatar URL. Email is read-only.</li>
              <li><b>AI</b> — provider, model override, encrypted API key, master enable/disable.</li>
              <li><b>Appearance</b> — theme (light, dark, system).</li>
              <li><b>Account</b> — view linked OAuth providers and account creation date.</li>
            </ul>
          </Section>

          <Section id="shortcuts" title="Keyboard shortcuts" icon={Zap}>
            <ul>
              <li><kbd>⌘</kbd>+<kbd>N</kbd> — new schema</li>
              <li><kbd>⌘</kbd>+<kbd>T</kbd> — add table</li>
              <li>Right-click on canvas — context actions (add table, add relation)</li>
              <li>Right-click on a table or edge — table/relation actions</li>
            </ul>
          </Section>

          <Section id="security" title="Security & privacy" icon={ShieldCheck}>
            <ul>
              <li>API keys are encrypted with AES-256-GCM and never returned to the client. Only a masked preview (first 4 / last 4) is shown.</li>
              <li>Passwords are hashed with bcrypt (cost 10).</li>
              <li>Mock query execution runs in an in-memory SQLite sandbox; <code>DROP</code>, <code>DELETE</code>, and <code>TRUNCATE</code> are rejected.</li>
              <li>Sessions are JWT-based; the Prisma adapter persists OAuth accounts and user records.</li>
            </ul>
          </Section>

          <Section id="troubleshooting" title="Troubleshooting" icon={Wrench}>
            <h3>&ldquo;No AI provider configured&rdquo;</h3>
            <p>Open <Link href="/settings">Settings → AI</Link>, pick a provider, and paste your API key.</p>
            <h3>OAuth button missing</h3>
            <p>The corresponding env vars are not set. See <a href="#auth">Accounts & OAuth</a>.</p>
            <h3>Migrations</h3>
            <p>Run <code>make db-migrate</code> after pulling. <code>make help</code> lists every command.</p>
            <h3>Canvas is blank after import</h3>
            <p>Check the SQL parser warning in the Import panel. Auto-arrange the canvas (bottom-left button) if tables landed on the same coordinates.</p>
          </Section>

          <Section id="faq" title="FAQ" icon={HelpCircle}>
            <h3>Do you train on my schemas?</h3>
            <p>No. Schemas are stored in your own Postgres database. AI calls go directly to your provider with your key.</p>
            <h3>Can I self-host?</h3>
            <p>Yes. Clone the repo, set the env vars, run <code>make setup</code>, then <code>make dev</code>.</p>
            <h3>Which model should I use?</h3>
            <p>Default is <code>gemini-2.5-flash</code> — fast and cheap. Use <code>gpt-4o</code> or larger Gemini variants if you need stronger reasoning.</p>
            <h3>How do I delete my account?</h3>
            <p>Account deletion isn&apos;t self-serve yet. Email support to request removal.</p>
          </Section>

          <footer className="border-t pt-6 text-xs text-muted-foreground">
            <p>
              Last updated: 2026-05. Found a doc bug?{" "}
              <Link href="/settings" className="text-primary underline">
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

function Section({
  id,
  title,
  icon: Icon,
  children,
}: {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="mb-3 flex items-center gap-2 not-prose">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="size-3.5 text-primary" />
        </div>
        <h2 className="m-0 text-xl font-bold tracking-tight">{title}</h2>
      </div>
      <div className="leading-relaxed">{children}</div>
    </section>
  );
}
