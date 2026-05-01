import "server-only";
import { prisma } from "./db";
import { decryptSecret, encryptSecret } from "./crypto";
import type { AiProvider, PublicSettings } from "./ai-providers";

export type { AiProvider, PublicSettings } from "./ai-providers";
export {
  DEFAULT_MODELS,
  PROVIDER_LABEL,
  PROVIDER_KEY_URL,
  PROVIDER_NEEDS_SECRET,
  PROVIDER_KEY_LABEL,
  PROVIDER_SECRET_LABEL,
} from "./ai-providers";

export async function getUserSettings(userId: string) {
  return prisma.userSettings.findUnique({ where: { userId } });
}

export async function getPublicSettings(userId: string): Promise<PublicSettings> {
  const s = await getUserSettings(userId);
  if (!s) {
    return {
      aiEnabled: true,
      aiProvider: null,
      aiModel: null,
      hasApiKey: false,
      apiKeyMask: null,
      hasApiSecret: false,
      region: null,
    };
  }
  let mask: string | null = null;
  let hasApiKey = false;
  if (s.apiKeyEnc) {
    try {
      const k = decryptSecret(s.apiKeyEnc);
      mask = `${k.slice(0, 4)}…${k.slice(-4)}`;
      hasApiKey = true;
    } catch {
      mask = null;
      hasApiKey = false;
    }
  }
  let hasApiSecret = false;
  if (s.apiSecretEnc) {
    try {
      decryptSecret(s.apiSecretEnc);
      hasApiSecret = true;
    } catch {
      hasApiSecret = false;
    }
  }
  return {
    aiEnabled: s.aiEnabled,
    aiProvider: (s.aiProvider as AiProvider | null) ?? null,
    aiModel: s.aiModel,
    hasApiKey,
    apiKeyMask: mask,
    hasApiSecret,
    region: s.region ?? null,
  };
}

export interface UpdateSettingsInput {
  aiEnabled?: boolean;
  aiProvider?: AiProvider | null;
  aiModel?: string | null;
  apiKey?: string | null;
  apiSecret?: string | null;
  region?: string | null;
}

export async function updateUserSettings(
  userId: string,
  input: UpdateSettingsInput
) {
  const existing = await getUserSettings(userId);
  const data: {
    aiEnabled?: boolean;
    aiProvider?: string | null;
    aiModel?: string | null;
    apiKeyEnc?: string | null;
    apiSecretEnc?: string | null;
    region?: string | null;
  } = {};
  if (input.aiEnabled !== undefined) data.aiEnabled = input.aiEnabled;
  if (input.aiProvider !== undefined) data.aiProvider = input.aiProvider;
  if (input.aiModel !== undefined) data.aiModel = input.aiModel;
  if (input.region !== undefined) data.region = input.region;
  if (input.apiKey === null) data.apiKeyEnc = null;
  else if (typeof input.apiKey === "string" && input.apiKey.trim().length > 0) {
    data.apiKeyEnc = encryptSecret(input.apiKey.trim());
  }
  if (input.apiSecret === null) data.apiSecretEnc = null;
  else if (
    typeof input.apiSecret === "string" &&
    input.apiSecret.trim().length > 0
  ) {
    data.apiSecretEnc = encryptSecret(input.apiSecret.trim());
  }

  if (existing) {
    return prisma.userSettings.update({ where: { userId }, data });
  }
  return prisma.userSettings.create({
    data: { userId, ...data },
  });
}

export async function getDecryptedKey(userId: string): Promise<{
  provider: AiProvider | null;
  model: string | null;
  apiKey: string | null;
  apiSecret: string | null;
  region: string | null;
  enabled: boolean;
  configured: boolean;
}> {
  const s = await getUserSettings(userId);
  if (!s) {
    return {
      provider: null,
      model: null,
      apiKey: null,
      apiSecret: null,
      region: null,
      enabled: false,
      configured: false,
    };
  }
  let apiKey: string | null = null;
  if (s.apiKeyEnc) {
    try {
      apiKey = decryptSecret(s.apiKeyEnc);
    } catch {
      apiKey = null;
    }
  }
  let apiSecret: string | null = null;
  if (s.apiSecretEnc) {
    try {
      apiSecret = decryptSecret(s.apiSecretEnc);
    } catch {
      apiSecret = null;
    }
  }
  const provider = (s.aiProvider as AiProvider | null) ?? null;
  // Bedrock needs all three (key id + secret + region). Other providers
  // only need apiKey.
  const isConfigured = !!(
    provider &&
    apiKey &&
    (provider !== "bedrock" || (apiSecret && s.region))
  );
  return {
    provider,
    model: s.aiModel,
    apiKey,
    apiSecret,
    region: s.region ?? null,
    enabled: s.aiEnabled,
    configured: isConfigured,
  };
}
