import { auth } from "@/lib/auth";
import { buildOAuthCallbacks } from "@/lib/oauth-callbacks";

// GET /api/auth/debug
// Diagnostic for OAuth redirect_uri_mismatch AND post-login redirect loops.
// Returns:
//   - the resolved origin + per-provider callbackUrl (for whitelisting)
//   - whether the current request carries a recognized session cookie
//   - which env vars and headers shaped the resolution
//
// These URLs are not secrets per the OAuth spec; safe to leave reachable.
export async function GET(req: Request) {
  const info = buildOAuthCallbacks(req);

  // Pull the cookie header directly so we can list which auth-related
  // cookies the browser actually sent.
  const rawCookie = req.headers.get("cookie") ?? "";
  const cookieNames = rawCookie
    .split(";")
    .map((c) => c.trim().split("=")[0])
    .filter((n) => n.toLowerCase().includes("authjs"));

  // auth() decodes the JWT and returns the session if it's valid.
  let session: unknown = null;
  let sessionError: string | null = null;
  try {
    session = await auth();
  } catch (err) {
    sessionError = err instanceof Error ? err.message : String(err);
  }

  return Response.json({
    resolvedOrigin: info.origin,
    sessionDetected: !!session,
    sessionError,
    authCookiesPresent: cookieNames,
    note:
      "If sessionDetected is false right after a successful login, the cookie name expected by middleware doesn't match what the API route set. Verify NEXTAUTH_URL / AUTH_URL matches the browser origin.",
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
      VERCEL: process.env.VERCEL ?? null,
      VERCEL_ENV: process.env.VERCEL_ENV ?? null,
      NODE_ENV: process.env.NODE_ENV ?? null,
    },
    callbacks: info.callbacks.map((c) => ({
      provider: c.provider,
      label: c.label,
      callbackUrl: c.callbackUrl,
      enabled: c.enabled,
      consoleUrl: c.consoleUrl,
    })),
    troubleshooting: [
      "redirect_uri_mismatch (Google/GitHub/Microsoft): copy the exact callbackUrl above into the provider console. Casing, port, trailing slash all matter.",
      "Login succeeds but bounces to /sign-in: AUTH_SECRET must be identical across the route handler and the edge middleware (set as a single env var). Restart after changing.",
      "On Vercel: set NEXTAUTH_URL=https://<your-host> in env. Redeploy — env changes require a fresh deploy.",
      "If `authCookiesPresent` is empty right after login, the Set-Cookie response header was rejected. Check that NEXTAUTH_URL matches the browser origin exactly (including https/http and host).",
      "127.0.0.1 ≠ localhost. Pick one and use it consistently in NEXTAUTH_URL, your browser, and any provider console.",
    ],
  });
}
