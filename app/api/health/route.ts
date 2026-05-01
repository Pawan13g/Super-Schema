import { prisma } from "@/lib/db";

// Liveness + readiness probe. Pings the database to confirm the deployment
// can serve real requests. Used by Docker / Kubernetes / load balancers.
export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({
      ok: true,
      db: "ok",
      latencyMs: Date.now() - startedAt,
      uptime: process.uptime(),
      version: process.env.npm_package_version ?? null,
    });
  } catch (err) {
    return Response.json(
      {
        ok: false,
        db: "down",
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
