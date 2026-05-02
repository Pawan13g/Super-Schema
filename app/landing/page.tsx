import Link from "next/link";
import {
  Database,
  Sparkles,
  Code2,
  Braces,
  Play,
  Check,
  Keyboard,
  FileCode2,
  GitBranch,
  Layers,
  LayoutGrid,
  Command,
  CircleDot,
} from "lucide-react";
import { Navbar } from "./navbar-client";
import { FaqAccordion } from "./faq-client";

/* ═══════════════════════════════════════════════════════════════════════════
   HERO — split layout: text left, app screenshot right
   ═══════════════════════════════════════════════════════════════════════════ */

function Hero() {
  return (
    <section className="relative overflow-hidden pt-14">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(120,80,255,0.18),transparent_70%)]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 pb-16 pt-20 sm:px-6 sm:pt-28 lg:px-8 lg:pt-32">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left — text */}
          <div>
            {/* Announcement pill */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/[0.07] px-1 py-1 pr-4 text-sm backdrop-blur-sm">
              <span className="flex items-center gap-1.5 rounded-full bg-violet-600/30 px-2.5 py-0.5 text-xs font-semibold text-violet-300">
                <Sparkles className="size-3" />
                New Update
              </span>
              <span className="text-zinc-400">
                Introducing Super Schema v2 — Try It
              </span>
            </div>

            <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-[3.5rem]">
              Visual Tools to Build{" "}
              <span className="text-zinc-400">Smarter Databases</span>
            </h1>

            <p className="mt-6 max-w-lg text-base leading-relaxed text-zinc-400 sm:text-lg">
              Transform ideas into scalable schemas through a visual and
              developer-friendly builder
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/sign-up"
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-violet-600 px-5 text-sm font-semibold text-white shadow-xl shadow-violet-600/25 transition-all hover:bg-violet-500 hover:-translate-y-0.5"
              >
                Get Started Free
                <Play className="size-3 fill-current" />
              </Link>
              <Link
                href="/docs"
                className="inline-flex h-10 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-5 text-sm font-medium text-white transition-all hover:border-white/20 hover:bg-white/[0.08]"
              >
                Watch Demo
              </Link>
            </div>

            {/* Integration icons */}
            <div className="mt-14">
              <p className="mb-4 text-xs font-medium tracking-widest text-zinc-500">
                Support 100+ Database Integrations
              </p>
              <div className="flex items-center gap-3">
                {[Database, Braces, Code2, Layers, GitBranch, FileCode2].map(
                  (Icon, i) => (
                    <div
                      key={i}
                      className="flex size-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] transition-colors hover:border-white/[0.15] hover:bg-white/[0.06]"
                    >
                      <Icon className="size-4 text-zinc-400" />
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Right — app screenshot mockup */}
          <div className="relative">
            <div className="absolute -inset-8 rounded-3xl bg-gradient-to-b from-violet-500/10 via-transparent to-transparent blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0c22]/90 shadow-2xl shadow-violet-950/40">
              {/* Browser chrome */}
              <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-2.5">
                <div className="flex gap-1.5">
                  <div className="size-2.5 rounded-full bg-white/10" />
                  <div className="size-2.5 rounded-full bg-white/10" />
                  <div className="size-2.5 rounded-full bg-white/10" />
                </div>
                <div className="mx-auto flex h-5 w-56 items-center justify-center rounded bg-white/[0.04] text-[10px] text-zinc-500">
                  superschema.app
                </div>
              </div>
              {/* Code / schema preview */}
              <div className="p-5">
                <AppPreview />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── App preview inside hero ─────────────────────────────────────────────── */

function AppPreview() {
  return (
    <div className="space-y-3 font-mono text-[11px] leading-relaxed">
      <div className="flex items-center gap-2 text-zinc-500">
        <span className="text-violet-400">--</span> Untitled Database
        <span className="ml-auto rounded bg-white/[0.06] px-1.5 py-0.5 text-[9px] text-zinc-500">
          Unsaved
        </span>
      </div>
      <div>
        <span className="text-zinc-500">1</span>
        {"  "}
        <span className="text-zinc-500">{"////"}</span>
        <span className="text-zinc-400"> → Adding column settings</span>
      </div>
      <div>
        <span className="text-zinc-500">2</span>
        {"  "}
        <span className="text-violet-400">Table</span>{" "}
        <span className="text-emerald-400">order_items</span>
        <span className="text-zinc-400"> {"{"}</span>
      </div>
      <div>
        <span className="text-zinc-500">3</span>
        {"    "}
        <span className="text-cyan-400">order_id</span>{" "}
        <span className="text-amber-400">int</span>{" "}
        <span className="text-zinc-500">[ref: &gt; orders.id]</span>{" "}
        <span className="text-zinc-600">{"// foreign key"}</span>
      </div>
      <div>
        <span className="text-zinc-500">4</span>
        {"    "}
        <span className="text-cyan-400">product_id</span>{" "}
        <span className="text-amber-400">int</span>
      </div>
      <div>
        <span className="text-zinc-500">5</span>
        {"    "}
        <span className="text-cyan-400">quantity</span>{" "}
        <span className="text-amber-400">int</span>{" "}
        <span className="text-zinc-500">[default: 1]</span>{" "}
        <span className="text-zinc-600">{"// default quantity"}</span>
      </div>
      <div>
        <span className="text-zinc-500">6</span>
        {"  "}
        <span className="text-zinc-400">{"}"}</span>
      </div>
      <div className="mt-1">
        <span className="text-zinc-500">7</span>
        {"  "}
        <span className="text-violet-400">Ref:</span>{" "}
        <span className="text-zinc-400">
          order_items.product_id &gt; products.id
        </span>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[9px] text-zinc-400">
          Compile
        </span>
        <span className="flex items-center gap-1 rounded bg-white/[0.06] px-2 py-0.5 text-[9px] text-zinc-400">
          <Command className="size-2.5" /> K
        </span>
        <span className="ml-auto rounded bg-violet-600 px-3 py-1 text-[10px] font-semibold text-white">
          EXECUTE
        </span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SOCIAL PROOF — logo marquee
   ═══════════════════════════════════════════════════════════════════════════ */

function SocialProof() {
  const logos = [
    "Alexun",
    "Journey",
    "GrowthView",
    "AIVA",
    "coinbase",
    "Wation",
    "zoom",
  ];
  return (
    <section className="border-y border-white/[0.04] bg-[#08081a]/60 py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p className="mb-6 text-center text-xs font-medium tracking-widest text-zinc-500">
          Powering teams from early-stage to unicorns
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
          {logos.map((l) => (
            <span
              key={l}
              className="rounded-lg border border-white/[0.05] bg-white/[0.02] px-5 py-2 text-sm font-semibold text-zinc-500/80"
            >
              {l}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CLARITY SECTION — "Build Databases With Clarity and Confidence"
   ═══════════════════════════════════════════════════════════════════════════ */

function ClaritySection() {
  return (
    <section className="relative py-24">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
          Build Databases With Clarity
          <br />
          and Confidence
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base text-zinc-400 sm:text-lg">
          From planning to execution, Super Schema ensures your workflow stays
          clear, secure, and reliable.
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CORE TECHNOLOGY — split: text left, visual right
   ═══════════════════════════════════════════════════════════════════════════ */

function CoreTechnology() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_30%_50%,rgba(120,80,255,0.06),transparent_60%)]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Left — text */}
          <div>
            <div className="mb-6 inline-flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-violet-600/20 px-3 py-1 text-xs font-semibold text-violet-400">
                <Sparkles className="size-3" />
                Super Schema
              </span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-zinc-400">
                Core Technology
              </span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              The Core of Smarter
              <br />
              Database Building
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-zinc-400">
              Built on a foundation of precision and performance, Super Schema
              gives you the stability to scale and the simplicity to create
              without limits.
            </p>
            <Link
              href="#features"
              className="mt-8 inline-flex h-9 items-center gap-1.5 rounded-lg bg-violet-600 px-5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition-all hover:bg-violet-500"
            >
              Explore Features
            </Link>
          </div>

          {/* Right — visual */}
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(120,80,255,0.08),transparent_60%)]" />
            {/* Chip-like visual */}
            <div className="relative">
              {/* Glow */}
              <div className="absolute -inset-16 rounded-full bg-violet-600/5 blur-3xl" />
              {/* Grid lines radiating out */}
              <div
                className="absolute -inset-20 opacity-[0.06]"
                style={{
                  backgroundImage:
                    "linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />
              {/* Central chip */}
              <div className="relative flex size-36 items-center justify-center rounded-2xl border border-white/[0.1] bg-[#0e0e28]/80 shadow-2xl backdrop-blur-sm sm:size-44">
                <div className="flex size-20 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600/30 to-indigo-600/20 ring-1 ring-violet-500/20 sm:size-24">
                  <Database className="size-10 text-violet-400 sm:size-12" />
                </div>
                {/* Corner dots */}
                {[
                  "-top-1 -left-1",
                  "-top-1 -right-1",
                  "-bottom-1 -left-1",
                  "-bottom-1 -right-1",
                ].map((pos) => (
                  <div
                    key={pos}
                    className={`absolute ${pos} size-2 rounded-full border border-white/20 bg-[#0e0e28]`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EFFICIENCY — split: keyboard visual left, text right
   ═══════════════════════════════════════════════════════════════════════════ */

function EfficiencySection() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Left — keyboard visual */}
          <div className="relative flex items-center justify-center">
            <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0c0c22]/90 p-8">
              {/* Corner resize handles */}
              {[
                "top-2 left-2",
                "top-2 right-2",
                "bottom-2 left-2",
                "bottom-2 right-2",
              ].map((pos) => (
                <div
                  key={pos}
                  className={`absolute ${pos} size-1.5 rounded-sm border border-white/20`}
                />
              ))}
              {/* Keyboard keys */}
              <div className="grid grid-cols-2 gap-2">
                {["A", "S", "Z", "X"].map((key) => (
                  <div
                    key={key}
                    className="flex size-14 items-center justify-center rounded-lg border border-white/[0.1] bg-white/[0.04] text-lg font-semibold text-zinc-300 shadow-inner sm:size-16"
                  >
                    {key}
                  </div>
                ))}
              </div>
              {/* Bottom bar */}
              <div className="mt-4 flex gap-2">
                <div className="h-3 flex-1 rounded-full bg-white/[0.06]" />
                <div className="h-3 w-8 rounded-full bg-white/[0.06]" />
              </div>
              {/* Resize icon */}
              <div className="absolute bottom-3 right-3 text-zinc-600">
                <LayoutGrid className="size-3.5" />
              </div>
            </div>
          </div>

          {/* Right — text */}
          <div>
            <div className="mb-6 inline-flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-full bg-violet-600/20 px-3 py-1 text-xs font-semibold text-violet-400">
                <Sparkles className="size-3" />
                Super Schema
              </span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-zinc-400">
                Faster Workflows
              </span>
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              Efficiency Built Into
              <br />
              Every Step You Take
            </h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-zinc-400">
              From shortcuts to smart workflows, Super Schema keeps your focus
              on building, not struggling with complexity.
            </p>
            <Link
              href="#features"
              className="mt-8 inline-flex h-9 items-center gap-1.5 rounded-lg bg-violet-600 px-5 text-sm font-semibold text-white shadow-lg shadow-violet-600/25 transition-all hover:bg-violet-500"
            >
              Explore Features
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   BENTO FEATURES — 3 top + 2 bottom cards with mockups
   ═══════════════════════════════════════════════════════════════════════════ */

function BentoFeatures() {
  return (
    <section id="features" className="relative py-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,rgba(120,80,255,0.06),transparent_60%)]" />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
            Everything You Need To
            <br />
            Build Smarter Databases
          </h2>
          <p className="mt-5 text-base text-zinc-400 sm:text-lg">
            A complete platform that transforms the way teams create, organize,
            and grow their data structures.
          </p>
        </div>

        {/* Top row: 3 cards */}
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* Card 1: Connect With Your Favorite Tools */}
          <div className="group overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-all hover:border-white/[0.12]">
            <div className="flex items-center justify-center px-6 pt-8 pb-4">
              <div className="grid grid-cols-3 gap-3">
                {[
                  Database,
                  Braces,
                  Code2,
                  Layers,
                  CircleDot,
                  GitBranch,
                  FileCode2,
                  Keyboard,
                  Database,
                ].map((Icon, i) => (
                  <div
                    key={i}
                    className={`flex size-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.03] ${i === 4 ? "bg-violet-600/20 ring-2 ring-violet-500/30" : ""}`}
                  >
                    <Icon
                      className={`size-5 ${i === 4 ? "text-violet-400" : "text-zinc-500"}`}
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 pb-6">
              <h3 className="text-[15px] font-semibold text-white">
                Connect With Your Favorite Tools
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Super Schema integrates with PostgreSQL, MySQL, SQLite, and more
                built for your workflow.
              </p>
            </div>
          </div>

          {/* Card 2: Smart File and Status Management */}
          <div className="group overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-all hover:border-white/[0.12]">
            <div className="px-6 pt-8 pb-4">
              <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#0c0c22]">
                <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
                  <span className="rounded bg-violet-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                    SET STATUS
                  </span>
                </div>
                <div className="p-3">
                  <div className="mb-2 h-2 w-full rounded-full bg-white/[0.06]">
                    <div className="h-2 w-3/4 rounded-full bg-violet-600/60" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-white">
                        ECOMMERCE.SQL
                      </p>
                      <p className="text-[10px] text-zinc-500">16 Jan 2025</p>
                    </div>
                    <span className="flex items-center gap-1.5 text-[10px]">
                      <span className="size-1.5 rounded-full bg-emerald-400" />
                      <span className="text-emerald-400">In progress</span>
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6">
              <h3 className="text-[15px] font-semibold text-white">
                Smart File and Status Management
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Organize schema files, update progress, and never lose track.
              </p>
            </div>
          </div>

          {/* Card 3: Multi-Database Compatibility */}
          <div className="group overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-all hover:border-white/[0.12]">
            <div className="px-6 pt-8 pb-4">
              <div className="space-y-3">
                {[
                  { name: "MySQL", pct: 90.73 },
                  { name: "PostgreSQL", pct: 16.09 },
                  { name: "SQL Server", pct: 40.92 },
                ].map((db) => (
                  <div key={db.name} className="flex items-center gap-3">
                    <span className="w-20 text-xs font-medium text-zinc-400">
                      {db.name}
                    </span>
                    <div className="flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div
                        className="h-2 rounded-full bg-violet-600/70"
                        style={{ width: `${db.pct}%` }}
                      />
                    </div>
                    <span className="w-14 text-right text-xs text-zinc-500">
                      {db.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-6 pb-6">
              <h3 className="text-[15px] font-semibold text-white">
                Multi-Database Compatibility
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Design schemas that work across MySQL, PostgreSQL, SQLite,
                and more.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom row: 2 wide cards */}
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {/* Card 4: Code-First Schema Design */}
          <div className="group overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-all hover:border-white/[0.12]">
            <div className="px-6 pt-8 pb-4">
              <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#0c0c22] p-4 font-mono text-[11px]">
                <div className="flex items-center justify-between text-zinc-500">
                  <span>
                    <span className="text-violet-400">|</span> Untitled Database
                  </span>
                  <span className="text-[10px]">Unsaved</span>
                </div>
                <div className="mt-3 space-y-1">
                  <div>
                    <span className="text-zinc-600">1</span>{"  "}
                    <span className="text-zinc-500">{"////"}</span>
                    <span className="text-zinc-400">
                      {" "}→ Adding column settings
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-600">2</span>{"  "}
                    <span className="text-rose-400">Table</span>{" "}
                    <span className="text-emerald-400">order_items</span>{" "}
                    <span className="text-zinc-400">{"{"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-600">3</span>{"    "}
                    <span className="text-cyan-400">order_id</span>{" "}
                    <span className="text-amber-400">int</span>{" "}
                    <span className="text-zinc-500">
                      [ref: &gt; orders.id]
                    </span>{" "}
                    <span className="text-zinc-600">{"// foreign key"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-600">4</span>{"    "}
                    <span className="text-cyan-400">product_id</span>{" "}
                    <span className="text-amber-400">int</span>
                  </div>
                  <div>
                    <span className="text-zinc-600">5</span>{"    "}
                    <span className="text-cyan-400">quantity</span>{" "}
                    <span className="text-amber-400">int</span>{" "}
                    <span className="text-zinc-500">[default: 1]</span>{" "}
                    <span className="text-zinc-600">{"// default quantity"}</span>
                  </div>
                  <div>
                    <span className="text-zinc-600">6</span>{"  "}
                    <span className="text-zinc-400">{"}"}</span>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <span className="rounded bg-white/[0.06] px-2 py-0.5 text-[9px] text-zinc-400">
                    Compile
                  </span>
                  <span className="flex items-center gap-1 rounded bg-white/[0.06] px-2 py-0.5 text-[9px] text-zinc-400">
                    cmd <span className="rounded bg-white/[0.1] px-1">K</span>
                  </span>
                  <span className="ml-auto rounded bg-violet-600 px-3 py-0.5 text-[9px] font-semibold text-white">
                    EXECUTE
                  </span>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6">
              <h3 className="text-[15px] font-semibold text-white">
                Code-First Schema Design
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Write, edit, and execute database schemas directly in Super
                Schema with powerful SQL support to keep your workflow fast and
                reliable.
              </p>
            </div>
          </div>

          {/* Card 5: Collaborate With Full Control */}
          <div className="group overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.02] transition-all hover:border-white/[0.12]">
            <div className="px-6 pt-8 pb-4">
              <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-[#0c0c22]">
                <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2.5">
                  <span className="text-xs font-semibold text-white">
                    Share This Database
                  </span>
                  <span className="rounded bg-violet-600 px-2.5 py-0.5 text-[10px] font-semibold text-white">
                    View Only ↓
                  </span>
                </div>
                <div className="p-4">
                  <p className="mb-3 text-[11px] text-zinc-400">
                    Secure sharing with full control over access.
                  </p>
                  <div className="space-y-2.5">
                    {[
                      { name: "Marcus Phospo", role: "Developer", access: "Can Edit" },
                      { name: "Sophia Iconify", role: "Back End", access: "Can Edit" },
                      { name: "Alexander Nucleo", role: "Back End", access: "Can Edit" },
                    ].map((u) => (
                      <div
                        key={u.name}
                        className="flex items-center gap-3 text-[11px]"
                      >
                        <div className="flex size-6 items-center justify-center rounded-full bg-violet-600/20 text-[9px] font-bold text-violet-400">
                          {u.name.charAt(0)}
                        </div>
                        <span className="flex-1 text-zinc-300">{u.name}</span>
                        <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[9px] font-medium text-violet-400">
                          {u.role}
                        </span>
                        <span className="rounded bg-violet-600 px-2 py-0.5 text-[9px] text-white">
                          {u.access}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-6 pb-6">
              <h3 className="text-[15px] font-semibold text-white">
                Collaborate With Full Control
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                Invite teammates, assign roles, and manage permissions to keep
                your database secure and productive.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   TESTIMONIALS — masonry grid with @handles
   ═══════════════════════════════════════════════════════════════════════════ */

const TESTIMONIALS = [
  { handle: "ethkaren", text: "The UI is clean, well-structured, and actually enjoyable to use. Everything feels intentional." },
  { handle: "btcbrenda", text: "Managing multiple schemas used to be messy — Super Schema makes it organized and easy to maintain." },
  { handle: "codetheblock", text: "Everything feels thoughtfully designed, from the UI to the smallest interactions." },
  { handle: "devtraderjoe", text: "I love how Super Schema helps me visualize my database relationships instead of guessing them" },
  { handle: "altcoinrookie", text: "The visual schema builder alone makes Super Schema worth it. It's fast, clear, and flexible" },
  { handle: "fifi_rfqh", text: "Super Schema helps me move from idea to implementation much faster, especially for MVPs." },
  { handle: "blockdanny", text: "Designing database schemas is much cleaner with Super Schema. I focus on structure without getting lost in configuration." },
  { handle: "noimnode", text: "Super Schema saves me hours every week. The workflow is simple, predictable, and reliable" },
  { handle: "uxonchain", text: "Super Schema fits perfectly into my local development workflow. No unnecessary complexity." },
  { handle: "eth_eli", text: "Super Schema makes local development far less painful. Switching between databases is fast and incredibly smooth." },
  { handle: "signalhunter", text: "I love how easy it is to design schemas and integrate them into my projects." },
  { handle: "lunalurker", text: "This is the kind of tool you don't realize you need until you start using it." },
];

function Testimonials() {
  return (
    <section id="testimonials" className="relative py-24 overflow-hidden">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            What Our Users Say
          </h2>
          <p className="mt-4 text-base text-zinc-400">
            Stories from people using Super Schema to build and manage databases
            with clarity.
          </p>
        </div>

        <div className="mt-14 columns-1 gap-4 sm:columns-2 lg:columns-3 xl:columns-4">
          {TESTIMONIALS.map((t) => (
            <div
              key={t.handle}
              className="mb-4 break-inside-avoid overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
            >
              <div className="mb-3 flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-full bg-violet-600/15 text-xs font-bold text-violet-400">
                  {t.handle.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm font-medium text-zinc-300">
                  @{t.handle}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-zinc-400">{t.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRICING — 3 columns
   ═══════════════════════════════════════════════════════════════════════════ */

const PLANS = [
  {
    name: "Starter",
    price: "Free",
    description: "Perfect for individuals and small projects getting started with schema design.",
    features: [
      "Create up to 5 schemas",
      "Up to 3 collaborators",
      "Visual schema builder",
      "Export to SQL & JSON",
      "Basic templates library",
      "Auto-save versions",
      "Email support",
      "Single project workspace",
    ],
    cta: "Get Started Free",
    highlighted: false,
  },
  {
    name: "Team",
    price: "$29",
    description: "Built for small teams collaborating on multiple databases and environments.",
    features: [
      "Create up to 25 schemas",
      "Up to 10 collaborators",
      "Advanced visual schema builder",
      "Export to SQL, JSON & migrations",
      "Shared templates library",
      "Version history & rollback",
      "Priority email support",
      "Multiple project workspaces",
    ],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    name: "Enterprise",
    price: "$99",
    description: "Designed for organizations with advanced security, scale, and deployment needs.",
    features: [
      "Unlimited schemas",
      "Unlimited collaborators",
      "Custom schema workflows",
      "Advanced export & integrations",
      "Role-based access control",
      "Audit logs & activity tracking",
      "Dedicated support & onboarding",
      "SSO & advanced security",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

function Pricing() {
  return (
    <section id="pricing" className="relative py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Flexible Pricing That Scales
            <br />
            With Growth
          </h2>
          <p className="mt-4 text-base text-zinc-400">
            From startups to enterprises, Super Schema offers pricing built to
            match your journey.
          </p>
        </div>

        <div className="mt-14 grid gap-4 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative overflow-hidden rounded-2xl border p-6 sm:p-8 ${
                plan.highlighted
                  ? "border-violet-500/30 bg-violet-500/[0.04]"
                  : "border-white/[0.06] bg-white/[0.02]"
              }`}
            >
              <h3 className="text-lg font-semibold text-white">{plan.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-white">
                  {plan.price}
                </span>
                {plan.price !== "Free" && (
                  <span className="text-sm text-zinc-500">/month</span>
                )}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                {plan.description}
              </p>

              <div className="mt-6">
                <p className="mb-3 text-xs font-semibold text-zinc-300">
                  Features Included:
                </p>
                <ul className="space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-400">
                      <Check className="mt-0.5 size-3.5 shrink-0 text-violet-400" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>

              <Link
                href="/sign-up"
                className={`mt-8 flex h-10 w-full items-center justify-center rounded-lg text-sm font-semibold transition-all ${
                  plan.highlighted
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/25 hover:bg-violet-500"
                    : "border border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FAQ — accordion
   ═══════════════════════════════════════════════════════════════════════════ */

const FAQ_ITEMS = [
  {
    q: "What is Super Schema and how does it work?",
    a: "Super Schema is a visual database design tool that lets you create schemas by dragging and dropping tables on an infinite canvas. Connect columns to create relationships, use AI to generate schemas from plain English, and export production-ready SQL for PostgreSQL, MySQL, or SQLite.",
  },
  {
    q: "Can I use Super Schema for free before upgrading?",
    a: "Yes, you can start using Super Schema for free with the Starter plan. It gives you access to core features so you can design and manage schemas right away. When your projects grow or you need advanced tools, you can easily upgrade to a paid plan anytime.",
  },
  {
    q: "Which databases are supported by Super Schema?",
    a: "Super Schema supports PostgreSQL, MySQL, and SQLite for SQL generation. You can also export to Prisma and Sequelize ORM models. Import existing SQL DDL to reverse-engineer schemas onto the canvas.",
  },
  {
    q: "How does AI schema generation work?",
    a: "Describe your application in plain English — like 'I need a SaaS with tenants, users, roles, and billing' — and the AI generates a normalized, production-ready schema with proper foreign keys, indexes, and constraints. You can then refine it visually on the canvas.",
  },
  {
    q: "Can I export my schema to SQL or other formats?",
    a: "Absolutely. Super Schema exports to PostgreSQL, MySQL, and SQLite SQL files, JSON schema format, Prisma schema files, and Sequelize TypeScript models. You can also export the canvas as a PNG image.",
  },
];

function Faq() {
  return (
    <section id="resources" className="relative py-24">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Frequently Asked
            <br />
            Questions
          </h2>
          <p className="mt-4 text-base text-zinc-400">
            Got a question? Here&apos;s everything you need to know before
            getting started.
          </p>
        </div>

        <div className="mt-12">
          <FaqAccordion items={FAQ_ITEMS} />
        </div>

        <p className="mt-8 text-center text-sm text-zinc-500">
          Are you still experiencing difficulties? Please submit your questions
          through{" "}
          <Link href="/docs" className="font-medium text-white underline underline-offset-4">
            Contact Us
          </Link>
        </p>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FINAL CTA
   ═══════════════════════════════════════════════════════════════════════════ */

function FinalCta() {
  return (
    <section className="relative py-24 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_50%,rgba(120,80,255,0.1),transparent_70%)]" />
      {/* Grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <h2 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Ready to Take Control of
          <br />
          Your Backend?
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-base text-zinc-400 sm:text-lg">
          Build and manage databases that power real products and workflows.
        </p>
        <Link
          href="/sign-up"
          className="mt-10 inline-flex h-11 items-center gap-2 rounded-lg bg-violet-600 px-7 text-sm font-semibold text-white shadow-xl shadow-violet-600/30 transition-all hover:bg-violet-500 hover:-translate-y-0.5"
        >
          Get Started Free
        </Link>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   FOOTER
   ═══════════════════════════════════════════════════════════════════════════ */

function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-[#06061a]/80 py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/landing" className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-violet-600/20 ring-1 ring-violet-500/30">
                <Database className="size-4 text-violet-400" />
              </div>
              <span className="text-[15px] font-bold text-white">
                Super Schema
              </span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-zinc-500">
              AI-powered visual database designer. Design, generate, and ship
              schemas faster.
            </p>
          </div>
          {[
            {
              title: "Product",
              links: [
                { label: "Features", href: "#features" },
                { label: "Pricing", href: "#pricing" },
                { label: "Documentation", href: "/docs" },
              ],
            },
            {
              title: "Resources",
              links: [
                { label: "FAQ", href: "#resources" },
                { label: "Testimonials", href: "#testimonials" },
                { label: "Get Started", href: "/sign-up" },
              ],
            },
            {
              title: "Legal",
              links: [
                { label: "Privacy Policy", href: "/privacy" },
                { label: "Terms of Service", href: "/terms" },
              ],
            },
          ].map((section) => (
            <div key={section.title}>
              <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-400">
                {section.title}
              </h4>
              <ul className="space-y-2 text-sm text-zinc-500">
                {section.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="transition-colors hover:text-white"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 border-t border-white/[0.06] pt-6 text-center text-xs text-zinc-600">
          &copy; {new Date().getFullYear()} Super Schema. All rights reserved.
        </div>
      </div>
    </footer>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#08081a] text-white antialiased">
      <Navbar />
      <Hero />
      <SocialProof />
      <ClaritySection />
      <CoreTechnology />
      <EfficiencySection />
      <BentoFeatures />
      <Testimonials />
      <Pricing />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}
