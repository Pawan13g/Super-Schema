import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { z } from "zod";
import {
  generateSchemaPrompt,
  explainSchemaPrompt,
  fixSchemaPrompt,
  generateQueryPrompt,
  optimizeQueryPrompt,
  explainQueryPrompt,
} from "./prompts";

function getLLM() {
  return new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash",
    temperature: 0.2,
    apiKey: process.env.GOOGLE_API_KEY,
  });
}

// Zod schemas for structured output
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
  description: string
): Promise<GeneratedSchema> {
  const llm = getLLM();
  const structuredLlm = llm.withStructuredOutput(generatedSchemaZod);
  const chain = generateSchemaPrompt.pipe(structuredLlm);
  return await chain.invoke({ input: description });
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
  const structuredLlm = llm.withStructuredOutput(generatedSchemaZod);
  const chain = fixSchemaPrompt.pipe(structuredLlm);
  return await chain.invoke({ schema: schemaJson });
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

export async function optimizeQuery(
  schemaJson: string,
  query: string
): Promise<string> {
  const llm = getLLM();
  const chain = optimizeQueryPrompt.pipe(llm);
  const result = await chain.invoke({ schema: schemaJson, query });
  return typeof result.content === "string"
    ? result.content
    : JSON.stringify(result.content);
}

export async function explainQuery(
  schemaJson: string,
  query: string
): Promise<string> {
  const llm = getLLM();
  const chain = explainQueryPrompt.pipe(llm);
  const result = await chain.invoke({ schema: schemaJson, query });
  return typeof result.content === "string"
    ? result.content
    : JSON.stringify(result.content);
}
