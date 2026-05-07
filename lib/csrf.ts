import type { NextRequest } from "next/server";

// Lightweight CSRF guard for state-mutating routes.
//
// NextAuth session cookies are SameSite=Lax by default, which already blocks
// most cross-origin POSTs from succeeding with credentials attached. This
// guard adds a second layer for the residual case where a same-site
// malicious page submits a `<form>` against our API: HTML forms can only
// produce three Content-Types
//   - application/x-www-form-urlencoded
//   - multipart/form-data
//   - text/plain
// none of which we accept. By requiring `application/json` on every
// mutating request, we force the caller to use `fetch` with an explicit
// header — which a cross-origin attacker can't do without a preflight, and
// preflight requires a CORS allow we don't grant.
//
// Returns a `Response` to short-circuit with, or `null` to proceed.
export function requireJsonContentType(req: NextRequest): Response | null {
  const method = req.method.toUpperCase();
  // Only enforce on methods that can mutate state.
  if (method !== "POST" && method !== "PATCH" && method !== "PUT" && method !== "DELETE") {
    return null;
  }
  // DELETE typically has no body; allow either an explicit JSON content-type
  // or no body at all.
  const ct = req.headers.get("content-type") ?? "";
  if (method === "DELETE") {
    const cl = req.headers.get("content-length");
    if (!ct && (!cl || cl === "0")) return null;
  }
  if (ct.toLowerCase().includes("application/json")) return null;
  return Response.json(
    {
      error:
        "This endpoint only accepts application/json. Use fetch with explicit JSON headers.",
      code: "INVALID_CONTENT_TYPE",
    },
    { status: 415 }
  );
}
