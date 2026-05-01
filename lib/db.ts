import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function maskPassword(url: string): string {
  // postgresql://user:PASSWORD@host:5432/db → postgresql://user:****@host:5432/db
  return url.replace(/(:\/\/[^:@/]+:)[^@]+(@)/, "$1****$2");
}

// Strip wrapping junk that occasionally sneaks through .env (matched
// quotes, leading/trailing whitespace, terminator semicolons). Idempotent.
function sanitizeUrl(raw: string): string {
  let s = raw.trim();
  // Drop trailing semicolon — sometimes copy-pasted from psql output.
  if (s.endsWith(";")) s = s.slice(0, -1).trim();
  // Repeatedly strip matching wrapping quotes (handles double-wraps).
  for (let i = 0; i < 3; i++) {
    if (
      (s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'")) ||
      (s.startsWith("`") && s.endsWith("`")) ||
      (s.startsWith("“") && s.endsWith("”")) || // smart double-quotes
      (s.startsWith("‘") && s.endsWith("’")) // smart single-quotes
    ) {
      s = s.slice(1, -1).trim();
      continue;
    }
    break;
  }
  return s;
}

function describeDatabaseUrl(url: string | undefined): string | null {
  if (!url || url.trim() === "") {
    return (
      "DATABASE_URL is not set. Add it to .env (or your deploy provider's env config). " +
      "Example: postgresql://user:password@host:5432/dbname?schema=public"
    );
  }
  const masked = maskPassword(url);
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== "postgresql:" &&
      parsed.protocol !== "postgres:"
    ) {
      return `DATABASE_URL must start with postgresql:// or postgres:// — got "${parsed.protocol}//…". Current value: ${masked}`;
    }
    if (!parsed.hostname) {
      return `DATABASE_URL is missing a host. Current value: ${masked}. Expected: postgresql://user:password@host:5432/dbname`;
    }
    if (parsed.hostname === "base") {
      return `DATABASE_URL host is the literal string "base" — almost certainly a placeholder you forgot to replace. Current value: ${masked}. Expected: postgresql://user:password@<real-host>:5432/dbname`;
    }
    if (!parsed.pathname || parsed.pathname === "/" || parsed.pathname === "") {
      return `DATABASE_URL is missing a database name (the path after the host). Current value: ${masked}. Expected: postgresql://user:password@host:5432/<dbname>`;
    }
  } catch {
    return `DATABASE_URL is malformed. Current value (password masked): ${masked}. Expected: postgresql://user:password@host:5432/dbname`;
  }
  return null;
}

function createClient(): PrismaClient {
  const raw = process.env.DATABASE_URL ?? "";
  const cleaned = sanitizeUrl(raw);

  // If the env value had surrounding quotes / whitespace / a trailing
  // semicolon, sanitize silently here AND tell the user how to fix the
  // .env so the next loader sees a clean string.
  if (cleaned !== raw && raw.length > 0) {
    console.warn(
      `[db] DATABASE_URL had wrapping quotes / whitespace / trailing punctuation — auto-stripped. Update your .env so the value is unquoted: DATABASE_URL=${maskPassword(cleaned)}`
    );
  }

  // Don't throw at import time — Next.js bundles this module during build,
  // and a missing/bad URL would fail the build before we ever reach
  // runtime. Instead, log a clear warning and let the actual query throw
  // a useful error from the adapter.
  const warning = describeDatabaseUrl(cleaned);
  if (warning) {
    if (typeof console !== "undefined") {
      console.warn(`[db] ${warning}`);
    }
  }

  const adapter = new PrismaPg({ connectionString: cleaned });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Re-export for diagnostics so /api/health can show why the DB is down.
export { describeDatabaseUrl };
