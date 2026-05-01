// Build the canonical OAuth callback URLs that providers must whitelist.
// Resolves against the request when called from a route handler, so URLs
// stay correct on every deployment without hard-coding the origin.

const PROVIDER_IDS = {
  google: "google",
  github: "github",
  microsoft: "microsoft-entra-id",
} as const;

export type SupportedOAuthProvider = keyof typeof PROVIDER_IDS;

export interface CallbackEntry {
  provider: SupportedOAuthProvider;
  label: string;
  callbackUrl: string;
  consoleUrl: string;
  envVars: string[];
  enabled: boolean;
  notes?: string;
}

export interface CallbackInfo {
  origin: string;
  callbacks: CallbackEntry[];
}

const PROVIDER_LABEL: Record<SupportedOAuthProvider, string> = {
  google: "Google",
  github: "GitHub",
  microsoft: "Microsoft Entra ID",
};

const PROVIDER_CONSOLE: Record<SupportedOAuthProvider, string> = {
  google: "https://console.cloud.google.com/apis/credentials",
  github: "https://github.com/settings/developers",
  microsoft: "https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps",
};

const PROVIDER_ENV_VARS: Record<SupportedOAuthProvider, string[]> = {
  google: ["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"],
  github: ["AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"],
  microsoft: [
    "AUTH_MICROSOFT_ID",
    "AUTH_MICROSOFT_SECRET",
    "AUTH_MICROSOFT_TENANT (optional, defaults to common)",
  ],
};

const PROVIDER_NOTES: Partial<Record<SupportedOAuthProvider, string>> = {
  google:
    "Add the callback URL under 'Authorized redirect URIs'. Add the bare origin (no path) under 'Authorized JavaScript origins'.",
  github:
    "Set 'Homepage URL' to the origin and 'Authorization callback URL' to the URL on the right.",
  microsoft:
    "Register a Web platform redirect URI matching the URL on the right. Use tenant 'common' for multi-tenant, or your tenant GUID.",
};

/**
 * Resolve the public origin from the active request, falling back to the
 * NEXTAUTH_URL / NEXT_PUBLIC_SITE_URL envs, then localhost.
 */
export function resolveOrigin(req?: Request): string {
  if (req) {
    const fwdProto = req.headers.get("x-forwarded-proto");
    const fwdHost = req.headers.get("x-forwarded-host");
    const host = fwdHost ?? req.headers.get("host");
    if (host) {
      const proto = fwdProto ?? (host.startsWith("localhost") ? "http" : "https");
      return `${proto}://${host}`.replace(/\/$/, "");
    }
  }
  // NextAuth v5 reads AUTH_URL first, then NEXTAUTH_URL. Honor both so the
  // surfaced callback matches whatever NextAuth actually uses.
  return (
    process.env.AUTH_URL?.replace(/\/$/, "") ??
    process.env.NEXTAUTH_URL?.replace(/\/$/, "") ??
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
    "http://localhost:3000"
  );
}

export function buildOAuthCallbacks(req?: Request): CallbackInfo {
  const origin = resolveOrigin(req);
  const callbacks: CallbackEntry[] = (
    Object.keys(PROVIDER_IDS) as SupportedOAuthProvider[]
  ).map((provider) => {
    const id = PROVIDER_IDS[provider];
    const enabled =
      provider === "google"
        ? !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET)
        : provider === "github"
          ? !!(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET)
          : !!(
              process.env.AUTH_MICROSOFT_ID && process.env.AUTH_MICROSOFT_SECRET
            );
    return {
      provider,
      label: PROVIDER_LABEL[provider],
      callbackUrl: `${origin}/api/auth/callback/${id}`,
      consoleUrl: PROVIDER_CONSOLE[provider],
      envVars: PROVIDER_ENV_VARS[provider],
      enabled,
      notes: PROVIDER_NOTES[provider],
    };
  });
  return { origin, callbacks };
}
