import { buildOAuthCallbacks } from "@/lib/oauth-callbacks";

// GET /api/auth/callbacks
// Returns the exact OAuth redirect URIs to whitelist in each provider's
// console, derived from the active request origin (so it works on prod,
// preview, and localhost without env tweaks). Auth-gating not applied:
// these URLs aren't secrets — they're public per the OAuth spec.
export async function GET(req: Request) {
  return Response.json(buildOAuthCallbacks(req));
}
