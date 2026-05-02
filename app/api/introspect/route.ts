import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import {
  introspectDatabase,
  type IntrospectDialect,
} from "@/lib/db-introspect";

// 10 introspect calls / 5 min / user — connections are expensive and
// possibly long-running.
const RATE_OPTS = { windowMs: 5 * 60_000, max: 10 };

const bodySchema = z.object({
  dialect: z.enum(["postgresql", "mysql"]),
  connectionString: z.string().min(1).max(2000),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = checkRateLimit(`introspect:${session.user.id}`, RATE_OPTS);
  if (!limit.ok) {
    return rateLimitResponse(
      limit,
      "Too many introspection attempts. Wait a few minutes."
    );
  }

  let parsed: { dialect: IntrospectDialect; connectionString: string };
  try {
    const body = await request.json();
    const result = bodySchema.safeParse(body);
    if (!result.success) {
      return Response.json({ error: "Invalid input" }, { status: 400 });
    }
    parsed = result.data;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Block obvious internal/loopback addresses to make casual SSRF harder.
  // Users can still target their own infra; this just stops accidental probes
  // of cluster-internal services from a hosted instance.
  const lower = parsed.connectionString.toLowerCase();
  const blocked = [
    "169.254.",
    "metadata.google.internal",
    "metadata.aws.internal",
    "instance-data.",
  ];
  if (blocked.some((b) => lower.includes(b))) {
    return Response.json(
      { error: "That host is not allowed." },
      { status: 400 }
    );
  }

  try {
    const startedAt = Date.now();
    const schema = await introspectDatabase(
      parsed.dialect,
      parsed.connectionString
    );
    return Response.json({
      schema,
      meta: {
        latencyMs: Date.now() - startedAt,
        tableCount: schema.tables.length,
        relationCount: schema.relations.length,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Introspection failed";
    // Connection-time errors from pg/mysql include creds-free strings, but
    // strip the connection string defensively just in case it appears in the
    // error (e.g. "could not connect to <full DSN>").
    const safe = message.replace(parsed.connectionString, "<connection>");
    return Response.json({ error: safe }, { status: 502 });
  }
}
