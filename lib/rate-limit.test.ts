import { describe, it, expect } from "vitest";
import { checkRateLimit } from "./rate-limit";

describe("rate-limit", () => {
  it("allows up to max in a window then blocks", () => {
    const key = `test:${Math.random()}`;
    const opts = { windowMs: 60_000, max: 3 };
    expect(checkRateLimit(key, opts).ok).toBe(true);
    expect(checkRateLimit(key, opts).ok).toBe(true);
    expect(checkRateLimit(key, opts).ok).toBe(true);
    const blocked = checkRateLimit(key, opts);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("scopes buckets by key", () => {
    const opts = { windowMs: 60_000, max: 1 };
    const a = `test-a:${Math.random()}`;
    const b = `test-b:${Math.random()}`;
    expect(checkRateLimit(a, opts).ok).toBe(true);
    expect(checkRateLimit(b, opts).ok).toBe(true);
    expect(checkRateLimit(a, opts).ok).toBe(false);
  });
});
