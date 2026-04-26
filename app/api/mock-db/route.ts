import { NextRequest } from "next/server";
import { runMockQuery } from "@/lib/mock-db";
import type { Schema } from "@/lib/types";

export async function POST(request: NextRequest) {
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

    if (schema.tables.length === 0) {
      return Response.json(
        { error: "No tables in schema" },
        { status: 400 }
      );
    }

    // Clamp rows per table
    const rows = Math.min(Math.max(rowsPerTable, 1), 100);

    const result = await runMockQuery(schema, query, rows);
    return Response.json({ result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
