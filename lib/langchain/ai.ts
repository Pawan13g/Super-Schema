import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import {
  generateSchemaPrompt,
  explainSchemaPrompt,
  fixSchemaPrompt,
  generateQueryPrompt,
} from "./prompts";

function getLLM() {
  return new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature: 0.2,
    apiKey: process.env.GOOGLE_API_KEY,
  });
}

function extractJson(text: string): string {
  // Strip markdown code fences if present
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  // Try to find raw JSON
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) return jsonMatch[0];
  return text;
}

export interface GeneratedSchema {
  tables: {
    name: string;
    columns: {
      name: string;
      type: string;
      constraints: string[];
    }[];
  }[];
  relations: {
    sourceTable: string;
    sourceColumn: string;
    targetTable: string;
    targetColumn: string;
    type: string;
  }[];
}

export async function generateSchema(
  description: string
): Promise<GeneratedSchema> {
  const llm = getLLM();
  const chain = generateSchemaPrompt.pipe(llm);
  const result = await chain.invoke({ input: description });
  const json = extractJson(
    typeof result.content === "string"
      ? result.content
      : JSON.stringify(result.content)
  );
  return JSON.parse(json);
}

export async function explainSchema(schemaJson: string): Promise<string> {
  const llm = getLLM();
  const chain = explainSchemaPrompt.pipe(llm);
  const result = await chain.invoke({ schema: schemaJson });
  return typeof result.content === "string"
    ? result.content
    : JSON.stringify(result.content);
}

export async function fixSchema(
  schemaJson: string
): Promise<GeneratedSchema> {
  const llm = getLLM();
  const chain = fixSchemaPrompt.pipe(llm);
  const result = await chain.invoke({ schema: schemaJson });
  const json = extractJson(
    typeof result.content === "string"
      ? result.content
      : JSON.stringify(result.content)
  );
  return JSON.parse(json);
}

export async function generateQuery(
  schemaJson: string,
  question: string
): Promise<string> {
  const llm = getLLM();
  const chain = generateQueryPrompt.pipe(llm);
  const result = await chain.invoke({ schema: schemaJson, question });
  return typeof result.content === "string"
    ? result.content
    : JSON.stringify(result.content);
}
 