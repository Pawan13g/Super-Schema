import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { getDecryptedKey } from "@/lib/user-settings";
import {
  checkRateLimit,
  clientKey,
  rateLimitResponse,
} from "@/lib/rate-limit";
import {
  generateSchema,
  explainSchema,
  fixSchema,
  generateQuery,
  optimizeQuery,
  explainQuery,
  documentSchema,
  adviseIndexes,
  type LlmCreds,
} from "@/lib/langchain/ai";

// 20 AI calls / minute / user — guard against accidentally burning their
// own provider key in a runaway loop.
const RATE_OPTS = { windowMs: 60_000, max: 20 };

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const limit = checkRateLimit(`ai:${session.user.id}`, RATE_OPTS);
    if (!limit.ok)
      return rateLimitResponse(
        limit,
        "Too many AI requests. Slow down for a minute."
      );

    const settings = await getDecryptedKey(session.user.id);
    if (!settings.configured) {
      return Response.json(
        {
          error:
            "No AI provider configured. Open Settings to choose a provider and enter your API key.",
          code: "NO_KEY",
        },
        { status: 400 }
      );
    }
    if (!settings.enabled) {
      return Response.json(
        { error: "AI features are disabled in your settings." },
        { status: 403 }
      );
    }
    // Ollama runs locally without an API key; treat key as optional there.
    const keyOptional = settings.provider === "ollama";
    if (!settings.provider || (!settings.apiKey && !keyOptional)) {
      return Response.json(
        {
          error:
            "No AI provider configured. Open Settings to choose a provider and enter your API key.",
          code: "NO_KEY",
        },
        { status: 400 }
      );
    }

    const creds: LlmCreds = {
      provider: settings.provider,
      apiKey: settings.apiKey ?? "",
      apiSecret: settings.apiSecret,
      region: settings.region,
      model: settings.model,
    };

    const body = await request.json();
    const { action, payload } = body as {
      action: string;
      payload: Record<string, string>;
    };

    const startedAt = Date.now();
    const wrap = (result: unknown) =>
      Response.json({
        result,
        meta: {
          latencyMs: Date.now() - startedAt,
          provider: settings.provider,
          model: settings.model ?? null,
        },
      });

    switch (action) {
      case "generate_schema": {
        const schema = await generateSchema(creds, payload.description);
        return wrap(schema);
      }
      case "explain_schema": {
        const explanation = await explainSchema(creds, payload.schema);
        return wrap(explanation);
      }
      case "fix_schema": {
        const fixed = await fixSchema(creds, payload.schema);
        return wrap(fixed);
      }
      case "generate_query": {
        const query = await generateQuery(creds, payload.schema, payload.question);
        return wrap(query);
      }
      case "optimize_query": {
        const optimized = await optimizeQuery(creds, payload.schema, payload.query);
        return wrap(optimized);
      }
      case "explain_query": {
        const explanation = await explainQuery(creds, payload.schema, payload.query);
        return wrap(explanation);
      }
      case "document_schema": {
        const docs = await documentSchema(creds, payload.schema);
        return wrap(docs);
      }
      case "advise_indexes": {
        const suggestions = await adviseIndexes(creds, payload.schema);
        return wrap(suggestions);
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
