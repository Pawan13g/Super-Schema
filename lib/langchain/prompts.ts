import { ChatPromptTemplate } from "@langchain/core/prompts";

const SCHEMA_JSON_DESCRIPTION = `A JSON object with two keys: "tables" (array of objects with "name" string and "columns" array of objects with "name" string, "type" string, and "constraints" string array) and "relations" (array of objects with "sourceTable", "sourceColumn", "targetTable", "targetColumn" strings and "type" string being one of "one-to-one", "one-to-many", or "many-to-many").`;

export const generateSchemaPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "You are an expert database architect. Convert natural language descriptions into normalized database schemas.",
      "",
      "Rules:",
      "- Use snake_case for all names",
      "- Every table MUST have a primary key (usually an auto-incrementing id using SERIAL type with PRIMARY KEY constraint)",
      "- Use foreign keys for relationships",
      "- Normalize data to at least 3NF",
      "- Include NOT NULL on required fields",
      "- Use appropriate column types from: INT, BIGINT, SMALLINT, SERIAL, FLOAT, DOUBLE, DECIMAL, BOOLEAN, VARCHAR, TEXT, CHAR, DATE, TIMESTAMP, DATETIME, TIME, JSON, UUID, BLOB",
      "- Column constraints can be: PRIMARY KEY, NOT NULL, UNIQUE, AUTO_INCREMENT, REFERENCES",
      "- For relations, sourceTable/sourceColumn is the FK side, targetTable/targetColumn is the PK side",
      "",
      "Output format: " + SCHEMA_JSON_DESCRIPTION,
      "",
      "Output ONLY valid JSON. No markdown code fences, no explanation, just the raw JSON object.",
    ].join("\n"),
  ],
  ["human", "{input}"],
]);

export const explainSchemaPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "You are an expert database architect. Given a database schema in JSON format, provide a clear, concise human-readable explanation of:",
      "1. What this database is designed for",
      "2. Each table and its purpose",
      "3. The relationships between tables",
      "4. Any notable design decisions",
      "",
      "Keep the explanation clear and well-structured.",
    ].join("\n"),
  ],
  ["human", "Explain this database schema:\n\n{schema}"],
]);

export const fixSchemaPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "You are an expert database architect and schema reviewer. Analyze the provided schema for issues and return an improved version.",
      "",
      "Check for:",
      "- Missing primary keys",
      "- Missing NOT NULL constraints on required fields",
      "- Denormalized data that should be in separate tables",
      "- Missing indexes on foreign keys",
      "- Naming convention inconsistencies",
      "- Missing relationship definitions",
      "- Redundant columns",
      "",
      "Output format: " + SCHEMA_JSON_DESCRIPTION,
      "",
      "Return ONLY the fixed schema as valid JSON. No markdown code fences, no explanation, just the raw JSON object.",
    ].join("\n"),
  ],
  ["human", "Fix and improve this schema:\n\n{schema}"],
]);

export const generateQueryPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "You are an expert SQL engineer. Given a database schema and a natural language question, write the correct SQL query.",
      "",
      "Rules:",
      "- Return ONLY the SQL query, no explanation",
      "- Use standard SQL that works across dialects",
      "- Use proper JOINs when needed",
      "- Always qualify column names with table names when joining",
    ].join("\n"),
  ],
  [
    "human",
    "Schema:\n{schema}\n\nWrite an SQL query for: {question}",
  ],
]);
