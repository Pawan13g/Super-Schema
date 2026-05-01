import "server-only";

// Simple per-process token-bucket / fixed-window rate limiter.
// Persists in module memory — survives between requests on the same Node
// process. Not safe for multi-instance deployments; swap for Redis when scaling.

interface Bucket {
  count: number;
  resetAt: number; // epoch ms
}

const store = new Map<string, Bucket>();

// Garbage-collect expired buckets every minute. Bounded to keep memory tidy.
let gcTimer: ReturnType<typeof setInterval> | null = null;
function ensureGc() {
  if (gcTimer) return;
  gcTimer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of store.entries()) {
      if (v.resetAt <= now) store.delete(k);
    }
  }, 60_000);
  // Don't keep the process alive just for cleanup
  if (typeof gcTimer === "object" && gcTimer && "unref" in gcTimer) {
    (gcTimer as unknown as { unref: () => void }).unref();
  }
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
}

export interface RateLimitOptions {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max requests allowed per key per window. */
  max: number;
}

export function checkRateLimit(
  key: string,
  opts: RateLimitOptions
): RateLimitResult {
  ensureGc();
  const now = Date.now();
  const existing = store.get(key);
  if (!existing || existing.resetAt <= now) {
    const resetAt = now + opts.windowMs;
    store.set(key, { count: 1, resetAt });
    return {
      ok: true,
      remaining: opts.max - 1,
      resetAt,
      retryAfterSec: Math.ceil(opts.windowMs / 1000),
    };
  }
  existing.count += 1;
  const ok = existing.count <= opts.max;
  return {
    ok,
    remaining: Math.max(0, opts.max - existing.count),
    resetAt: existing.resetAt,
    retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  };
}

/**
 * Pull a stable client identifier from the request headers. Falls back to
 * a constant so the limiter still applies in dev / behind a proxy that
 * strips the IP. Combine with a per-route prefix to namespace buckets.
 */
export function clientKey(req: Request, prefix: string): string {
  const fwd = req.headers.get("x-forwarded-for");
  const ip =
    (fwd ? fwd.split(",")[0]?.trim() : null) ??
    req.headers.get("x-real-ip") ??
    req.headers.get("cf-connecting-ip") ??
    "anon";
  return `${prefix}:${ip}`;
}

export function rateLimitResponse(result: RateLimitResult, message = "Too many requests") {
  return Response.json(
    { error: message, retryAfter: result.retryAfterSec },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSec),
        "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
      },
    }
  );
}
