import { buildOAuthCallbacks, resolveOrigin } from "@/lib/oauth-callbacks";

// GET /api/auth/debug
// Diagnostic for OAuth redirect_uri_mismatch errors. Shows exactly what
// origin / callback URL the server will hand to each provider, plus the
// env vars that influence resolution. Compare the `callbackUrl` field
// against the redirect URI you registered in the provider's console — they
// must match byte-for-byte.
export async function GET(req: Request) {
  const info = buildOAuthCallbacks(req);
  return Response.json({
    resolvedOrigin: info.origin,
    note:
      "Register the EXACT callbackUrl below in your provider console — same scheme, host, port, path, no trailing slash.",
    headers: {
      host: req.headers.get("host"),
      "x-forwarded-host": req.headers.get("x-forwarded-host"),
      "x-forwarded-proto": req.headers.get("x-forwarded-proto"),
    },
    env: {
      NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? null,
      AUTH_URL: process.env.AUTH_URL ?? null,
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL ?? null,
      AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST ?? null,
      AUTH_SECRET_set: !!process.env.AUTH_SECRET,
    },
    callbacks: info.callbacks.map((c) => ({
      provider: c.provider,
      label: c.label,
      callbackUrl: c.callbackUrl,
      enabled: c.enabled,
      consoleUrl: c.consoleUrl,
    })),
    troubleshooting: [
      "Copy the callbackUrl above and paste it into the provider's 'Authorized redirect URIs' field exactly. Casing, port, and trailing slash all matter.",
      "If `resolvedOrigin` doesn't match the URL in your browser bar, set NEXTAUTH_URL in .env to the exact origin (e.g. http://localhost:3000 — no trailing slash).",
      "After updating .env you MUST restart `npm run dev` — Next does not hot-reload server env vars.",
      "Google Console: register the bare origin under 'Authorized JavaScript origins' AND the full callbackUrl under 'Authorized redirect URIs'.",
      "127.0.0.1 ≠ localhost. Pick one and use it consistently.",
    ],
  });
}
