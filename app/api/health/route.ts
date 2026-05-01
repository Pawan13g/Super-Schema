import { prisma } from "@/lib/db";

// Liveness + readiness probe. Pings the database to confirm the deployment
// can serve real requests. Used by Docker / Kubernetes / load balancers.
export async function GET() {
  const startedAt = Date.now();
  // Surface the DATABASE_URL host (not credentials) so it's obvious when a
  // misconfigured connection string is the root cause.
  const dbHost = (() => {
    try {
      if (!process.env.DATABASE_URL) return null;
      const u = new URL(process.env.DATABASE_URL);
      return `${u.protocol}//${u.hostname}${u.port ? `:${u.port}` : ""}${u.pathname}`;
    } catch {
      return "<malformed>";
    }
  })();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({
      ok: true,
      db: "ok",
      dbHost,
      latencyMs: Date.now() - startedAt,
      uptime: process.uptime(),
      version: process.env.npm_package_version ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      {
        ok: false,
        db: "down",
        dbHost,
        error: message,
        hint:
          message.includes("Can't reach database server") ||
          message.includes("ECONNREFUSED") ||
          message.includes("ENOTFOUND")
            ? "DATABASE_URL host is wrong or the DB is unreachable. Verify the connection string format: postgresql://user:password@host:5432/dbname"
            : null,
      },
      { status: 503 }
    );
  }
}
