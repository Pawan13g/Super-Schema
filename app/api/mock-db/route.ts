import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { runMockQuery } from "@/lib/mock-db";
import {
  checkRateLimit,
  clientKey,
  rateLimitResponse,
} from "@/lib/rate-limit";
import type { Schema } from "@/lib/types";

// 30 mock-query executions / minute / IP — enough for interactive use,
// blocks burst abuse against the in-memory SQLite sandbox.
const RATE_OPTS = { windowMs: 60_000, max: 30 };

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = checkRateLimit(
    `mock:${session.user.id}:${clientKey(request, "ip")}`,
    RATE_OPTS
  );
  if (!limit.ok) return rateLimitResponse(limit);

  try {
    const body = await request.json();
    const { schema, query, rowsPerTable = 10 } = body as {
      schema: Schema;
      query: string;
      rowsPerTable?: number;
    };

    if (!schema || !query) {
      return Response.json(
        { error: "Missing schema or query" },
        { status: 400 }
      );
    }
    if (typeof query !== "string" || query.length > 50_000) {
      return Response.json({ error: "Query too long" }, { status: 400 });
    }
    if (!Array.isArray(schema.tables) || schema.tables.length === 0) {
      return Response.json({ error: "No tables in schema" }, { status: 400 });
    }
    if (schema.tables.length > 200) {
      return Response.json({ error: "Schema too large" }, { status: 400 });
    }

    const rows = Math.min(Math.max(rowsPerTable, 1), 100);
    const result = await runMockQuery(schema, query, rows);
    return Response.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
