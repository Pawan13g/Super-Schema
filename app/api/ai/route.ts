import { NextRequest } from "next/server";
import {
  generateSchema,
  explainSchema,
  fixSchema,
  generateQuery,
  optimizeQuery,
  explainQuery,
} from "@/lib/langchain/ai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, payload } = body as {
      action: string;
      payload: Record<string, string>;
    };

    if (!process.env.GOOGLE_API_KEY) {
      return Response.json(
        { error: "GOOGLE_API_KEY is not configured. Add it to your .env.local file." },
        { status: 500 }
      );
    }

    switch (action) {
      case "generate_schema": {
        const schema = await generateSchema(payload.description);
        return Response.json({ result: schema });
      }
      case "explain_schema": {
        const explanation = await explainSchema(payload.schema);
        return Response.json({ result: explanation });
      }
      case "fix_schema": {
        const fixed = await fixSchema(payload.schema);
        return Response.json({ result: fixed });
      }
      case "generate_query": {
        const query = await generateQuery(payload.schema, payload.question);
        return Response.json({ result: query });
      }
      case "optimize_query": {
        const optimized = await optimizeQuery(payload.schema, payload.query);
        return Response.json({ result: optimized });
      }
      case "explain_query": {
        const explanation = await explainQuery(payload.schema, payload.query);
        return Response.json({ result: explanation });
      }
      default:
        return Response.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
