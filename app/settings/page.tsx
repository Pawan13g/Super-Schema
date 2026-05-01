"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader, FullPageLoader } from "@/components/ui/loader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  BookOpen,
  Check,
  Copy,
  Database,
  ExternalLink,
  Eye,
  EyeOff,
  Code2 as Github,
  KeyRound,
  Link2,
  Mail,
  Monitor,
  Moon,
  Sparkles,
  Sun,
  Trash2,
  User as UserIcon,
} from "lucide-react";
import {
  DEFAULT_MODELS,
  PROVIDER_LABEL,
  PROVIDER_KEY_URL,
  PROVIDER_KEY_LABEL,
  PROVIDER_SECRET_LABEL,
  PROVIDER_NEEDS_SECRET,
  type AiProvider,
  type PublicSettings,
} from "@/lib/ai-providers";
import { cn } from "@/lib/utils";

interface ProfileData {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  createdAt: string;
  accounts: { provider: string }[];
}

type TabId = "account" | "ai" | "appearance" | "connections";

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "account", label: "Account", icon: UserIcon },
  { id: "ai", label: "AI Assistant", icon: Sparkles },
  { id: "appearance", label: "Appearance", icon: Sun },
  { id: "connections", label: "Connections", icon: Link2 },
];

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("account");

  useEffect(() => {
    if (status !== "authenticated") return;
    Promise.all([
      fetch("/api/profile").then((r) => r.json()),
      fetch("/api/settings").then((r) => r.json()),
    ])
      .then(([p, s]) => {
        setProfile(p);
        setSettings(s);
      })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoadingInitial(false));
  }, [status]);

  // Hash ↔ tab sync. Browser back/forward navigates between sections; deep
  // links like /settings#ai land directly on the AI tab.
  const hashToTab = (h: string): TabId | null => {
    const v = h.replace("#", "");
    if (v === "profile" || v === "account") return "account";
    if (v === "ai" || v === "appearance" || v === "connections")
      return v as TabId;
    return null;
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const initial = hashToTab(window.location.hash);
    if (initial) setActiveTab(initial);
    const onHashChange = () => {
      const t = hashToTab(window.location.hash);
      if (t) setActiveTab(t);
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  const switchTab = (id: TabId) => {
    setActiveTab(id);
    if (typeof window === "undefined") return;
    const next = `#${id}`;
    if (window.location.hash !== next) {
      // Use pushState so the back button steps through tabs.
      window.history.pushState(null, "", next);
    }
  };

  if (status === "loading" || loadingInitial) {
    return <FullPageLoader label="Loading settings…" />;
  }
  if (status !== "authenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">
          Please <Link href="/sign-in" className="underline">sign in</Link> to access settings.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex items-center gap-2 border-b px-4 py-4">
          <Link
            href="/"
            aria-label="Back to app"
            className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <span className="text-sm font-semibold">Super Schema</span>
        </div>

        <div className="flex-1 px-2 py-3">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Settings
          </p>
          <nav className="mt-1 space-y-0.5">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => switchTab(id)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors",
                  activeTab === id
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="border-t p-2">
          <Link
            href="/docs"
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <BookOpen className="size-4" />
            Documentation
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-x-hidden">
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-8 sm:py-10">
          {/* Heading */}
          <div className="mb-6 flex items-start justify-between gap-4 md:mb-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Manage your account settings and preferences
              </p>
            </div>
            <Link
              href="/"
              aria-label="Back"
              className="inline-flex size-9 items-center justify-center rounded-full border bg-card text-muted-foreground hover:bg-muted hover:text-foreground md:hidden"
            >
              <ArrowLeft className="size-4" />
            </Link>
          </div>

          {/* Pill tabs (mobile + reinforces section context) */}
          <div className="mb-6 flex flex-wrap gap-1.5 md:mb-8">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => switchTab(id)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                  activeTab === id
                    ? "bg-foreground text-background"
                    : "bg-card text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-px overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border">
            {activeTab === "account" && (
              <AccountTab profile={profile} onUpdate={setProfile} />
            )}
            {activeTab === "ai" && (
              <AiTab settings={settings} onUpdate={setSettings} />
            )}
            {activeTab === "appearance" && <AppearanceTab />}
            {activeTab === "connections" && <ConnectionsTab profile={profile} />}
          </div>
        </div>
      </main>
    </div>
  );
}

// -- Section primitives -----------------------------------------------------

function Section({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "grid grid-cols-1 gap-4 px-5 py-6 md:grid-cols-[220px_1fr] md:gap-8 md:px-8 md:py-7",
        className
      )}
    >
      <div className="md:pr-4">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        {description ? (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Divider() {
  return <div className="h-px w-full bg-border" />;
}

// -- Account tab ------------------------------------------------------------

function AccountTab({
  profile,
  onUpdate,
}: {
  profile: ProfileData | null;
  onUpdate: (p: ProfileData) => void;
}) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [image, setImage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    const parts = (profile.name ?? "").trim().split(/\s+/);
    setFirst(parts[0] ?? "");
    setLast(parts.slice(1).join(" "));
    setEmail(profile.email);
    setImage(profile.image ?? "");
  }, [profile]);

  if (!profile) return null;

  const fullName = [first.trim(), last.trim()].filter(Boolean).join(" ");
  const dirty =
    fullName !== (profile.name ?? "") || (image ?? "") !== (profile.image ?? "");
  const initials = (profile.name ?? profile.email)
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fullName || undefined,
          image: image.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      onUpdate({ ...profile, name: data.name, image: data.image });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleClearAvatar = () => setImage("");

  return (
    <>
      <Section
        title="Profile"
        description="Set your account details and how others see you."
      >
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FieldGroup label="Name" htmlFor="acc-first">
              <Input
                id="acc-first"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                placeholder="Bartosz"
              />
            </FieldGroup>
            <FieldGroup label="Surname" htmlFor="acc-last">
              <Input
                id="acc-last"
                value={last}
                onChange={(e) => setLast(e.target.value)}
                placeholder="Mcdaniel"
              />
            </FieldGroup>
          </div>
          <FieldGroup label="Email" htmlFor="acc-email">
            <Input
              id="acc-email"
              value={email}
              disabled
              className="bg-muted/40"
            />
          </FieldGroup>

          <div className="flex flex-col gap-3 rounded-xl border bg-muted/30 p-4 sm:flex-row sm:items-center">
            <Avatar className="size-16">
              {image ? <AvatarImage src={image} alt="" /> : null}
              <AvatarFallback className="bg-primary/15 text-base font-semibold text-primary">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm font-medium">Avatar</p>
              <p className="text-xs text-muted-foreground">
                Paste an image URL or leave empty to use initials.
              </p>
              <Input
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://…"
                className="mt-2 h-8 text-xs"
              />
            </div>
            <div className="flex gap-1.5 self-start sm:self-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearAvatar}
                disabled={!image}
                aria-label="Remove avatar"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>

          <div>
            <Button onClick={handleSave} disabled={!dirty || saving}>
              {saving ? <Loader size="sm" /> : "Save changes"}
            </Button>
          </div>
        </div>
      </Section>

      <Divider />

      <Section
        title="Account info"
        description="Read-only details about your account."
      >
        <dl className="grid gap-2 text-sm">
          <Row label="User ID" value={<code className="text-xs">{profile.id}</code>} />
          <Row
            label="Member since"
            value={new Date(profile.createdAt).toLocaleDateString()}
          />
          <Row
            label="Linked providers"
            value={
              profile.accounts.length
                ? profile.accounts.map((a) => a.provider).join(", ")
                : "Email + password"
            }
          />
        </dl>
      </Section>
    </>
  );
}

function FieldGroup({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs">
        {label}
      </Label>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-sm">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

// -- AI tab -----------------------------------------------------------------

function AiTab({
  settings,
  onUpdate,
}: {
  settings: PublicSettings | null;
  onUpdate: (s: PublicSettings) => void;
}) {
  const [aiEnabled, setAiEnabled] = useState(settings?.aiEnabled ?? true);
  const [provider, setProvider] = useState<AiProvider | "">(
    settings?.aiProvider ?? ""
  );
  const [model, setModel] = useState(settings?.aiModel ?? "");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [region, setRegion] = useState(settings?.region ?? "");
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);

  const needsSecret = provider ? PROVIDER_NEEDS_SECRET[provider] : false;

  const validateKey = async (opts: {
    apiKey?: string;
    apiSecret?: string;
    region?: string;
  } = {}) => {
    setValidating(true);
    try {
      const res = await fetch("/api/settings/validate-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(opts.apiKey ? { apiKey: opts.apiKey } : {}),
          ...(opts.apiSecret ? { apiSecret: opts.apiSecret } : {}),
          ...(opts.region ? { region: opts.region } : {}),
          ...(provider ? { provider } : {}),
          ...(model.trim() ? { model: model.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Connection works (${data.latencyMs} ms)`);
      } else {
        toast.error(data.error ?? "Key validation failed");
      }
      return !!data.ok;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Validation failed");
      return false;
    } finally {
      setValidating(false);
    }
  };

  useEffect(() => {
    if (!settings) return;
    setAiEnabled(settings.aiEnabled);
    setProvider(settings.aiProvider ?? "");
    setModel(settings.aiModel ?? "");
    setRegion(settings.region ?? "");
  }, [settings]);

  if (!settings) return null;

  const placeholderModel = provider ? DEFAULT_MODELS[provider as AiProvider] : "";

  const handleSave = async () => {
    setSaving(true);
    const newKey = apiKey.trim();
    const newSecret = apiSecret.trim();
    const newRegion = region.trim();
    try {
      const body: Record<string, unknown> = {
        aiEnabled,
        aiProvider: provider === "" ? null : provider,
        aiModel: model.trim() || null,
      };
      if (newKey) body.apiKey = newKey;
      if (needsSecret && newSecret) body.apiSecret = newSecret;
      if (needsSecret) body.region = newRegion || null;
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Update failed");
      onUpdate(data);
      setApiKey("");
      setApiSecret("");
      toast.success("AI settings saved");
      // Auto-validate when fresh credentials were just stored.
      if (provider && (newKey || (needsSecret && newSecret))) {
        validateKey({
          apiKey: newKey || undefined,
          apiSecret: newSecret || undefined,
          region: newRegion || undefined,
        });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleClearKey = async () => {
    if (!confirm("Clear your saved API key" + (needsSecret ? " and secret" : "") + "?"))
      return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: null, apiSecret: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onUpdate(data);
      toast.success("Credentials removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setSaving(false);
    }
  };

  const status = !aiEnabled
    ? { label: "Disabled", color: "bg-muted text-muted-foreground" }
    : settings.hasApiKey && settings.aiProvider
      ? { label: `Active — ${PROVIDER_LABEL[settings.aiProvider]}`, color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" }
      : { label: "Needs API key", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400" };

  return (
    <>
      <Section
        title="AI Assistant"
        description="Bring your own API key. Keys are encrypted at rest with AES-256-GCM."
      >
        <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-xl border bg-muted/30 p-3.5">
          <input
            type="checkbox"
            checked={aiEnabled}
            onChange={(e) => setAiEnabled(e.target.checked)}
            className="size-4 accent-primary"
          />
          <div className="flex-1">
            <p className="text-sm font-medium">Enable AI features</p>
            <p className="text-xs text-muted-foreground">
              Master switch for schema generation, explanations, and queries.
            </p>
          </div>
          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", status.color)}>
            {status.label}
          </span>
        </label>

        <div className={aiEnabled ? "" : "pointer-events-none opacity-50"}>
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldGroup label="Provider" htmlFor="ai-provider">
              <Select
                value={provider || "none"}
                onValueChange={(v) =>
                  setProvider(v === "none" ? "" : (v as AiProvider))
                }
              >
                <SelectTrigger id="ai-provider" className="w-full">
                  <SelectValue placeholder="Pick a provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No provider</SelectItem>
                  <SelectItem value="google">{PROVIDER_LABEL.google}</SelectItem>
                  <SelectItem value="openai">{PROVIDER_LABEL.openai}</SelectItem>
                  <SelectItem value="anthropic">{PROVIDER_LABEL.anthropic}</SelectItem>
                  <SelectItem value="mistral">{PROVIDER_LABEL.mistral}</SelectItem>
                  <SelectItem value="openrouter">{PROVIDER_LABEL.openrouter}</SelectItem>
                  <SelectItem value="grok">{PROVIDER_LABEL.grok}</SelectItem>
                  <SelectItem value="bedrock">{PROVIDER_LABEL.bedrock}</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup label="Model (optional)" htmlFor="ai-model">
              <Input
                id="ai-model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={placeholderModel || "e.g. gpt-4o-mini"}
              />
            </FieldGroup>
          </div>

          <div className="mt-3">
            <FieldGroup
              label={provider ? PROVIDER_KEY_LABEL[provider] : "API key"}
              htmlFor="ai-key"
            >
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="ai-key"
                    type={showKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={
                      settings.hasApiKey
                        ? `Saved: ${settings.apiKeyMask ?? "•••• ••••"} — type new key to replace`
                        : provider === "bedrock"
                          ? "AKIA…"
                          : "Paste your API key"
                    }
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showKey ? "Hide" : "Show"}
                  >
                    {showKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                {(settings.hasApiKey || settings.hasApiSecret) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClearKey}
                    disabled={saving}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </FieldGroup>
          </div>

          {needsSecret && (
            <>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <FieldGroup
                  label={PROVIDER_SECRET_LABEL[provider as AiProvider]}
                  htmlFor="ai-secret"
                >
                  <div className="relative">
                    <Input
                      id="ai-secret"
                      type={showSecret ? "text" : "password"}
                      value={apiSecret}
                      onChange={(e) => setApiSecret(e.target.value)}
                      placeholder={
                        settings.hasApiSecret
                          ? "•••• saved — type new secret to replace"
                          : "Paste secret access key"
                      }
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret((v) => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showSecret ? "Hide" : "Show"}
                    >
                      {showSecret ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </button>
                  </div>
                </FieldGroup>
                <FieldGroup label="AWS region" htmlFor="ai-region">
                  <Input
                    id="ai-region"
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="us-east-1"
                  />
                </FieldGroup>
              </div>
            </>
          )}

          <p className="mt-2 text-[11px] text-muted-foreground">
            {provider ? (
              <>
                Get credentials at{" "}
                <a
                  href={PROVIDER_KEY_URL[provider]}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline"
                >
                  {PROVIDER_KEY_URL[provider].replace(/^https?:\/\//, "")}
                </a>
                {provider === "bedrock" && (
                  <> · ensure the IAM principal has <code>bedrock:InvokeModel</code> for the chosen model.</>
                )}
                {provider === "openrouter" && (
                  <> · model strings use <code>vendor/model-id</code> (e.g. <code>anthropic/claude-sonnet-4.5</code>).</>
                )}
              </>
            ) : (
              "Pick a provider above to see where to get a key."
            )}
          </p>
        </div>

        <div className="mt-5 flex gap-2">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader size="sm" /> : "Save AI settings"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => validateKey()}
            disabled={
              validating ||
              !provider ||
              (!apiKey.trim() && !settings.hasApiKey) ||
              (needsSecret &&
                !region.trim() &&
                !settings.region)
            }
            title="Fire a 1-token test call against the provider"
          >
            {validating ? <Loader size="sm" /> : "Test connection"}
          </Button>
        </div>
      </Section>
    </>
  );
}

// -- Appearance tab ---------------------------------------------------------

function AppearanceTab() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <Section
      title="Appearance"
      description="Choose how Super Schema looks. System matches your OS preference."
    >
      <div className="grid grid-cols-3 gap-3 sm:max-w-md">
        {[
          { v: "light", label: "Light", icon: Sun, preview: "bg-white" },
          { v: "dark", label: "Dark", icon: Moon, preview: "bg-zinc-900" },
          { v: "system", label: "System", icon: Monitor, preview: "bg-gradient-to-br from-white to-zinc-900" },
        ].map(({ v, label, icon: Icon, preview }) => {
          const active = theme === v || (theme === undefined && v === "system");
          return (
            <button
              key={v}
              type="button"
              onClick={() => {
                setTheme(v);
                toast.success(`Theme: ${label}`);
              }}
              className={cn(
                "group flex flex-col items-stretch gap-2 rounded-xl border bg-card p-2 text-left transition-all",
                active
                  ? "ring-2 ring-primary"
                  : "hover:border-foreground/20"
              )}
            >
              <div className={cn("h-16 rounded-lg border", preview)} />
              <div className="flex items-center justify-between px-1">
                <span className="flex items-center gap-1.5 text-xs font-medium">
                  <Icon className="size-3.5" />
                  {label}
                </span>
                {active ? (
                  <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-primary">
                    Active
                  </span>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Currently rendering: <b className="text-foreground">{resolvedTheme ?? "—"}</b>
      </p>
    </Section>
  );
}

// -- Connections tab --------------------------------------------------------

interface CallbackEntry {
  provider: "google" | "github" | "microsoft";
  label: string;
  callbackUrl: string;
  consoleUrl: string;
  envVars: string[];
  enabled: boolean;
  notes?: string;
}

interface CallbackInfo {
  origin: string;
  callbacks: CallbackEntry[];
}

function ConnectionsTab({ profile }: { profile: ProfileData | null }) {
  const [callbackInfo, setCallbackInfo] = useState<CallbackInfo | null>(null);

  useEffect(() => {
    fetch("/api/auth/callbacks")
      .then((r) => r.json())
      .then(setCallbackInfo)
      .catch(() => {});
  }, []);

  if (!profile) return null;
  const linkedAccountProviders = new Set(profile.accounts.map((a) => a.provider));
  const items = [
    { id: "google", linkedKey: "google", label: "Google", icon: Mail },
    { id: "github", linkedKey: "github", label: "GitHub", icon: Github },
    {
      id: "microsoft",
      linkedKey: "microsoft-entra-id",
      label: "Microsoft",
      icon: KeyRound,
    },
  ];

  return (
    <>
      <Section
        title="Connections"
        description="OAuth providers linked to your account. Sign in via these providers from the sign-in page."
      >
        <ul className="grid gap-2">
          {items.map(({ id, linkedKey, label, icon: Icon }) => {
            const isLinked = linkedAccountProviders.has(linkedKey);
            const meta = callbackInfo?.callbacks.find((c) => c.provider === id);
            const isConfigured = meta?.enabled ?? false;
            return (
              <li
                key={id}
                className="flex items-center justify-between gap-3 rounded-xl border bg-muted/30 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg bg-card ring-1 ring-border">
                    <Icon className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {isLinked
                        ? "Linked to your account"
                        : isConfigured
                          ? "Available — sign in to link"
                          : "Not configured on the server"}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                    isLinked
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                      : isConfigured
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {isLinked
                    ? "Connected"
                    : isConfigured
                      ? "Available"
                      : "Not configured"}
                </span>
              </li>
            );
          })}
        </ul>
      </Section>

      <Divider />

      <Section
        title="OAuth redirect URIs"
        description="Whitelist these exact URLs in each provider's developer console. They're derived from the current origin so they stay correct on prod, preview, and localhost."
      >
        {!callbackInfo ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader size="xs" /> Loading…
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Detected origin</span>
              <code className="font-mono text-foreground">
                {callbackInfo.origin}
              </code>
            </div>
            <ul className="space-y-2">
              {callbackInfo.callbacks.map((cb) => (
                <CallbackCard key={cb.provider} cb={cb} />
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground">
              See <Link href="/docs#auth" className="text-primary hover:underline">docs / Auth</Link> for full setup steps and required env vars.
            </p>
          </div>
        )}
      </Section>
    </>
  );
}

function CallbackCard({ cb }: { cb: CallbackEntry }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cb.callbackUrl);
      setCopied(true);
      toast.success(`${cb.label} callback URL copied`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <li className="rounded-xl border bg-muted/30 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{cb.label}</p>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
              cb.enabled
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            )}
            title={cb.envVars.join(", ")}
          >
            {cb.enabled ? "Enabled" : "Env vars not set"}
          </span>
        </div>
        <a
          href={cb.consoleUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
        >
          Open console <ExternalLink className="size-3" />
        </a>
      </div>
      <div className="mt-2 flex items-stretch gap-2">
        <code className="flex-1 truncate rounded-md border bg-background px-2 py-1.5 font-mono text-[11px] text-foreground">
          {cb.callbackUrl}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          aria-label="Copy callback URL"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </Button>
      </div>
      {cb.notes && (
        <p className="mt-1.5 text-[11px] text-muted-foreground">{cb.notes}</p>
      )}
      <p className="mt-1 text-[10px] text-muted-foreground">
        Required env: <code>{cb.envVars.join(", ")}</code>
      </p>
    </li>
  );
}
