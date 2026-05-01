import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  checkRateLimit,
  rateLimitResponse,
} from "@/lib/rate-limit";
import { getDecryptedKey } from "@/lib/user-settings";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatMistralAI } from "@langchain/mistralai";
import { ChatBedrockConverse } from "@langchain/aws";
import {
  DEFAULT_MODELS,
  type AiProvider,
} from "@/lib/ai-providers";

const RATE_OPTS = { windowMs: 60_000, max: 6 };

const bodySchema = z.object({
  apiKey: z.string().min(1).max(500).optional(),
  apiSecret: z.string().min(1).max(500).optional(),
  region: z.string().min(1).max(40).optional(),
  provider: z
    .enum([
      "google",
      "openai",
      "anthropic",
      "mistral",
      "openrouter",
      "grok",
      "bedrock",
    ])
    .optional(),
  model: z.string().min(1).max(120).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = checkRateLimit(`vkey:${session.user.id}`, RATE_OPTS);
  if (!limit.ok) return rateLimitResponse(limit);

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  let provider: AiProvider | null = parsed.data.provider ?? null;
  let apiKey = parsed.data.apiKey ?? null;
  let apiSecret = parsed.data.apiSecret ?? null;
  let region = parsed.data.region ?? null;
  let model = parsed.data.model ?? null;

  // Fill in from saved settings when caller didn't pass them.
  const saved = await getDecryptedKey(session.user.id);
  apiKey ??= saved.apiKey;
  apiSecret ??= saved.apiSecret;
  region ??= saved.region;
  provider ??= saved.provider;
  model ??= saved.model;

  if (!provider || !apiKey) {
    return Response.json(
      { ok: false, error: "Provider or API key missing" },
      { status: 400 }
    );
  }
  if (provider === "bedrock" && (!apiSecret || !region)) {
    return Response.json(
      {
        ok: false,
        error: "AWS Bedrock requires a secret access key and a region.",
      },
      { status: 400 }
    );
  }

  const startedAt = Date.now();
  const finalModel = model ?? DEFAULT_MODELS[provider];

  try {
    const llm = makeMinimalLlm(provider, {
      apiKey,
      apiSecret,
      region,
      model: finalModel,
    });
    await llm.invoke("ping");
    return Response.json({
      ok: true,
      latencyMs: Date.now() - startedAt,
      provider,
      model: finalModel,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      {
        ok: false,
        error: friendlyKeyError(message),
        latencyMs: Date.now() - startedAt,
      },
      { status: 200 }
    );
  }
}

function makeMinimalLlm(
  provider: AiProvider,
  opts: {
    apiKey: string;
    apiSecret: string | null;
    region: string | null;
    model: string;
  }
) {
  const { apiKey, apiSecret, region, model } = opts;
  switch (provider) {
    case "openai":
      return new ChatOpenAI({ model, apiKey, maxTokens: 1, temperature: 0 });
    case "anthropic":
      return new ChatAnthropic({ model, apiKey, maxTokens: 1, temperature: 0 });
    case "mistral":
      return new ChatMistralAI({
        model,
        apiKey,
        maxTokens: 1,
        temperature: 0,
      });
    case "openrouter":
      return new ChatOpenAI({
        model,
        apiKey,
        maxTokens: 1,
        temperature: 0,
        configuration: { baseURL: "https://openrouter.ai/api/v1" },
      });
    case "grok":
      return new ChatOpenAI({
        model,
        apiKey,
        maxTokens: 1,
        temperature: 0,
        configuration: { baseURL: "https://api.x.ai/v1" },
      });
    case "bedrock":
      return new ChatBedrockConverse({
        model,
        region: region!,
        temperature: 0,
        credentials: {
          accessKeyId: apiKey,
          secretAccessKey: apiSecret!,
        },
      });
    case "google":
    default:
      return new ChatGoogleGenerativeAI({
        model,
        apiKey,
        maxOutputTokens: 1,
        temperature: 0,
      });
  }
}

function friendlyKeyError(raw: string): string {
  const lower = raw.toLowerCase();
  if (
    lower.includes("401") ||
    lower.includes("unauthorized") ||
    lower.includes("api key not valid") ||
    lower.includes("invalid api key") ||
    lower.includes("invalid token")
  )
    return "API key was rejected by the provider. Double-check it.";
  if (lower.includes("403"))
    return "Access denied. The key may lack permission for this model.";
  if (lower.includes("429") || lower.includes("rate"))
    return "Provider rate-limited the test call. Try again in a moment.";
  if (lower.includes("model") && lower.includes("not"))
    return "Provider doesn't recognize the model name. Use the default or pick a valid one.";
  if (lower.includes("region") || lower.includes("could not load credentials"))
    return "AWS credentials or region rejected. Verify access key, secret, and region.";
  return raw.slice(0, 200);
}
