import { NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  getPublicSettings,
  updateUserSettings,
  type AiProvider,
} from "@/lib/user-settings";

const providerEnum = z.enum([
  "google",
  "openai",
  "anthropic",
  "mistral",
  "openrouter",
  "grok",
  "bedrock",
]);

const bodySchema = z.object({
  aiEnabled: z.boolean().optional(),
  aiProvider: providerEnum.nullable().optional(),
  aiModel: z.string().min(1).max(120).nullable().optional(),
  apiKey: z.string().max(500).nullable().optional(),
  apiSecret: z.string().max(500).nullable().optional(),
  region: z.string().max(40).nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const data = await getPublicSettings(session.user.id);
  return Response.json(data);
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid settings payload" },
      { status: 400 }
    );
  }
  await updateUserSettings(session.user.id, {
    aiEnabled: parsed.data.aiEnabled,
    aiProvider: parsed.data.aiProvider as AiProvider | null | undefined,
    aiModel: parsed.data.aiModel,
    apiKey: parsed.data.apiKey,
    apiSecret: parsed.data.apiSecret,
    region: parsed.data.region,
  });
  const data = await getPublicSettings(session.user.id);
  return Response.json(data);
}
