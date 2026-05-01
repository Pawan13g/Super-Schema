// Client-safe constants and types. Do not import server-only modules here.

export type AiProvider =
  | "google"
  | "openai"
  | "anthropic"
  | "mistral"
  | "openrouter"
  | "grok"
  | "bedrock";

export interface PublicSettings {
  aiEnabled: boolean;
  aiProvider: AiProvider | null;
  aiModel: string | null;
  hasApiKey: boolean;
  apiKeyMask: string | null;
  // Bedrock extras
  hasApiSecret: boolean;
  region: string | null;
}

export const DEFAULT_MODELS: Record<AiProvider, string> = {
  google: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-6",
  mistral: "mistral-large-latest",
  openrouter: "openai/gpt-4o-mini",
  grok: "grok-2-latest",
  bedrock: "anthropic.claude-3-5-sonnet-20240620-v1:0",
};

export const PROVIDER_LABEL: Record<AiProvider, string> = {
  google: "Google Gemini",
  openai: "OpenAI",
  anthropic: "Anthropic Claude",
  mistral: "Mistral AI",
  openrouter: "OpenRouter",
  grok: "xAI Grok",
  bedrock: "AWS Bedrock",
};

export const PROVIDER_KEY_URL: Record<AiProvider, string> = {
  google: "https://aistudio.google.com/app/apikey",
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
  mistral: "https://console.mistral.ai/api-keys",
  openrouter: "https://openrouter.ai/keys",
  grok: "https://console.x.ai/",
  bedrock: "https://console.aws.amazon.com/iam/home#/security_credentials",
};

// Providers that need an extra secret + region (AWS access key id + secret + region).
export const PROVIDER_NEEDS_SECRET: Record<AiProvider, boolean> = {
  google: false,
  openai: false,
  anthropic: false,
  mistral: false,
  openrouter: false,
  grok: false,
  bedrock: true,
};

export const PROVIDER_KEY_LABEL: Record<AiProvider, string> = {
  google: "API key",
  openai: "API key",
  anthropic: "API key",
  mistral: "API key",
  openrouter: "API key",
  grok: "API key",
  bedrock: "AWS access key ID",
};

export const PROVIDER_SECRET_LABEL: Record<AiProvider, string> = {
  google: "",
  openai: "",
  anthropic: "",
  mistral: "",
  openrouter: "",
  grok: "",
  bedrock: "AWS secret access key",
};
