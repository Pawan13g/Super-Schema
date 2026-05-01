import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatMistralAI } from "@langchain/mistralai";
import { ChatBedrockConverse } from "@langchain/aws";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { z } from "zod";
import {
  generateSchemaPrompt,
  explainSchemaPrompt,
  fixSchemaPrompt,
  generateQueryPrompt,
  optimizeQueryPrompt,
  explainQueryPrompt,
} from "./prompts";
import type { AiProvider } from "@/lib/ai-providers";
import { DEFAULT_MODELS } from "@/lib/ai-providers";

export interface LlmCreds {
  provider: AiProvider;
  apiKey: string;
  // Bedrock-only: AWS secret access key + region. Ignored for other providers.
  apiSecret?: string | null;
  region?: string | null;
  model?: string | null;
}

function makeLLM(creds: LlmCreds): BaseChatModel {
  const model = creds.model ?? DEFAULT_MODELS[creds.provider];
  switch (creds.provider) {
    case "openai":
      return new ChatOpenAI({
        model,
        temperature: 0.2,
        apiKey: creds.apiKey,
      });
    case "anthropic":
      return new ChatAnthropic({
        model,
        temperature: 0.2,
        apiKey: creds.apiKey,
      });
    case "mistral":
      return new ChatMistralAI({
        model,
        temperature: 0.2,
        apiKey: creds.apiKey,
      });
    case "openrouter":
      // OpenRouter is OpenAI-compatible — point ChatOpenAI at their endpoint.
      return new ChatOpenAI({
        model,
        temperature: 0.2,
        apiKey: creds.apiKey,
        configuration: {
          baseURL: "https://openrouter.ai/api/v1",
          defaultHeaders: {
            "HTTP-Referer": "https://super-schema.app",
            "X-Title": "Super Schema",
          },
        },
      });
    case "grok":
      // xAI's API is also OpenAI-compatible.
      return new ChatOpenAI({
        model,
        temperature: 0.2,
        apiKey: creds.apiKey,
        configuration: { baseURL: "https://api.x.ai/v1" },
      });
    case "bedrock":
      if (!creds.apiSecret || !creds.region) {
        throw new Error(
          "AWS Bedrock requires a secret access key and a region. Add them in Settings."
        );
      }
      return new ChatBedrockConverse({
        model,
        temperature: 0.2,
        region: creds.region,
        credentials: {
          accessKeyId: creds.apiKey,
          secretAccessKey: creds.apiSecret,
        },
      });
    case "google":
    default:
      return new ChatGoogleGenerativeAI({
        model,
        temperature: 0.2,
        apiKey: creds.apiKey,
      });
  }
}

const columnSchema = z.object({
  name: z.string().describe("Column name in snake_case"),
  type: z
    .enum([
      "INT", "BIGINT", "SMALLINT", "SERIAL", "FLOAT", "DOUBLE", "DECIMAL",
      "BOOLEAN", "VARCHAR", "TEXT", "CHAR", "DATE", "TIMESTAMP", "DATETIME",
      "TIME", "JSON", "UUID", "BLOB",
    ])
    .describe("Column data type"),
  constraints: z
    .array(
      z.enum([
        "PRIMARY KEY", "NOT NULL", "UNIQUE", "AUTO_INCREMENT",
        "DEFAULT", "CHECK", "REFERENCES",
      ])
    )
    .describe("Column constraints"),
});

const tableSchema = z.object({
  name: z.string().describe("Table name in snake_case"),
  columns: z.array(columnSchema).describe("Table columns"),
});

const relationSchema = z.object({
  sourceTable: z.string().describe("FK table name"),
  sourceColumn: z.string().describe("FK column name"),
  targetTable: z.string().describe("Referenced table name"),
  targetColumn: z.string().describe("Referenced column name"),
  type: z
    .enum(["one-to-one", "one-to-many", "many-to-many"])
    .describe("Relationship cardinality"),
});

const generatedSchemaZod = z.object({
  tables: z.array(tableSchema).describe("Database tables"),
  relations: z.array(relationSchema).describe("Table relationships"),
});

export type GeneratedSchema = z.infer<typeof generatedSchemaZod>;

export async function generateSchema(
  creds: LlmCreds,
  description: string
): Promise<GeneratedSchema> {
  const llm = makeLLM(creds);
  const structuredLlm = llm.withStructuredOutput(generatedSchemaZod);
  const chain = generateSchemaPrompt.pipe(structuredLlm);
  return await chain.invoke({ input: description });
}

export async function explainSchema(
  creds: LlmCreds,
  schemaJson: string
): Promise<string> {
  const llm = makeLLM(creds);
  const chain = explainSchemaPrompt.pipe(llm);
  const result = await chain.invoke({ schema: schemaJson });
  return typeof result.content === "string"
    ? result.content
    : JSON.stringify(result.content);
}

export async function fixSchema(
  creds: LlmCreds,
  schemaJson: string
): Promise<GeneratedSchema> {
  const llm = makeLLM(creds);
  const structuredLlm = llm.withStructuredOutput(generatedSchemaZod);
  const chain = fixSchemaPrompt.pipe(structuredLlm);
  return await chain.invoke({ schema: schemaJson });
}

export async function generateQuery(
  creds: LlmCreds,
  schemaJson: string,
  question: string
): Promise<string> {
  const llm = makeLLM(creds);
  const chain = generateQueryPrompt.pipe(llm);
  const result = await chain.invoke({ schema: schemaJson, question });
  return typeof result.content === "string"
    ? result.content
    : JSON.stringify(result.content);
}

export async function optimizeQuery(
  creds: LlmCreds,
  schemaJson: string,
  query: string
): Promise<string> {
  const llm = makeLLM(creds);
  const chain = optimizeQueryPrompt.pipe(llm);
  const result = await chain.invoke({ schema: schemaJson, query });
  return typeof result.content === "string"
    ? result.content
    : JSON.stringify(result.content);
}

export async function explainQuery(
  creds: LlmCreds,
  schemaJson: string,
  query: string
): Promise<string> {
  const llm = makeLLM(creds);
  const chain = explainQueryPrompt.pipe(llm);
  const result = await chain.invoke({ schema: schemaJson, query });
  return typeof result.content === "string"
    ? result.content
    : JSON.stringify(result.content);
}
