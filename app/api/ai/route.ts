import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { getDecryptedKey } from "@/lib/user-settings";
import { checkRateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { requireJsonContentType } from "@/lib/csrf";
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

// Hard caps applied at the API boundary. lib/langchain/ai.ts also clamps
// per-field, but rejecting oversized payloads here keeps the request body
// small and avoids parsing megabytes of attacker-controlled text.
const MAX_FREE_TEXT_LEN = 8_000;
const MAX_SCHEMA_JSON_LEN = 200_000;

const ACTIONS = [
  "generate_schema",
  "explain_schema",
  "fix_schema",
  "generate_query",
  "optimize_query",
  "explain_query",
  "document_schema",
  "advise_indexes",
] as const;

// Per-action input shape. Validation rejects garbage / oversized fields
// before any LLM cost is incurred. Each field is required by at least one
// action; we model them as optional here and let the action handler pick
// what it needs.
const payloadSchema = z
  .object({
    description: z.string().max(MAX_FREE_TEXT_LEN).optional(),
    schema: z.string().max(MAX_SCHEMA_JSON_LEN).optional(),
    question: z.string().max(MAX_FREE_TEXT_LEN).optional(),
    query: z.string().max(MAX_FREE_TEXT_LEN).optional(),
  })
  .strict();

const bodySchema = z.object({
  action: z.enum(ACTIONS),
  payload: payloadSchema,
});

export async function POST(request: NextRequest) {
  try {
    const csrfBlock = requireJsonContentType(request);
    if (csrfBlock) return csrfBlock;
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

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parsedBody = bodySchema.safeParse(raw);
    if (!parsedBody.success) {
      return Response.json(
        {
          error:
            "Invalid request. Action must be a known string and each field must be under its size limit.",
        },
        { status: 400 }
      );
    }
    const { action, payload } = parsedBody.data;

    const required = (
      field: "description" | "schema" | "question" | "query"
    ): string | null => {
      const v = payload[field];
      if (typeof v !== "string" || v.trim().length === 0) {
        return null;
      }
      return v;
    };
    const missing = (field: string) =>
      Response.json(
        { error: `Missing required field: ${field}` },
        { status: 400 }
      );

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
        const description = required("description");
        if (description == null) return missing("description");
        const schema = await generateSchema(creds, description);
        return wrap(schema);
      }
      case "explain_schema": {
        const schemaStr = required("schema");
        if (schemaStr == null) return missing("schema");
        const explanation = await explainSchema(creds, schemaStr);
        return wrap(explanation);
      }
      case "fix_schema": {
        const schemaStr = required("schema");
        if (schemaStr == null) return missing("schema");
        const fixed = await fixSchema(creds, schemaStr);
        return wrap(fixed);
      }
      case "generate_query": {
        const schemaStr = required("schema");
        const question = required("question");
        if (schemaStr == null) return missing("schema");
        if (question == null) return missing("question");
        const query = await generateQuery(creds, schemaStr, question);
        return wrap(query);
      }
      case "optimize_query": {
        const schemaStr = required("schema");
        const queryStr = required("query");
        if (schemaStr == null) return missing("schema");
        if (queryStr == null) return missing("query");
        const optimized = await optimizeQuery(creds, schemaStr, queryStr);
        return wrap(optimized);
      }
      case "explain_query": {
        const schemaStr = required("schema");
        const queryStr = required("query");
        if (schemaStr == null) return missing("schema");
        if (queryStr == null) return missing("query");
        const explanation = await explainQuery(creds, schemaStr, queryStr);
        return wrap(explanation);
      }
      case "document_schema": {
        const schemaStr = required("schema");
        if (schemaStr == null) return missing("schema");
        const docs = await documentSchema(creds, schemaStr);
        return wrap(docs);
      }
      case "advise_indexes": {
        const schemaStr = required("schema");
        if (schemaStr == null) return missing("schema");
        const suggestions = await adviseIndexes(creds, schemaStr);
        return wrap(suggestions);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
