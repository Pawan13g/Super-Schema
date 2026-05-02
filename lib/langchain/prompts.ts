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

export const optimizeQueryPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "You are an expert SQL performance engineer. Given a database schema and a SQL query, optimize the query for better performance.",
      "",
      "Consider:",
      "- Adding appropriate index hints",
      "- Rewriting subqueries as JOINs where beneficial",
      "- Eliminating unnecessary columns in SELECT",
      "- Using EXISTS instead of IN for subqueries",
      "- Proper use of WHERE clause ordering",
      "",
      "Return ONLY the optimized SQL query followed by a brief comment explaining each optimization made. Use SQL comments (--) for the explanations.",
    ].join("\n"),
  ],
  [
    "human",
    "Schema:\n{schema}\n\nOptimize this query:\n{query}",
  ],
]);

export const documentSchemaPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "You are an expert database architect writing concise documentation for a schema.",
      "",
      "For each table and column, produce a short, plain-English comment describing its purpose.",
      "",
      "Rules:",
      "- Comments must be 1 short sentence (under 100 characters).",
      "- Do NOT restate the column name verbatim; explain WHY it exists or what it stores.",
      "- For obvious id/pk columns, write something like 'Primary identifier.'",
      "- For foreign key columns, mention the referenced table.",
      "- For boolean flags, describe what 'true' means.",
      "- Skip columns where you cannot infer a useful purpose — return an empty string for those.",
      "",
      "Output a JSON object matching the requested schema. Do not invent tables/columns; only describe what is given.",
    ].join("\n"),
  ],
  ["human", "Document this database schema:\n\n{schema}"],
]);

export const adviseIndexesPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "You are an expert database performance engineer. Recommend indexes for the given schema.",
      "",
      "Consider:",
      "- All foreign-key columns (sourceColumn of relations) need an index for join performance.",
      "- Columns frequently filtered or sorted on (timestamps, status enums, slugs, emails).",
      "- Compound indexes for common multi-column lookups (e.g. tenant_id + created_at).",
      "- Skip indexes that already exist (PRIMARY KEY, UNIQUE constraints already imply one).",
      "",
      "For each suggestion include: tableName, columns (array), unique (boolean), reason (1 sentence).",
      "",
      "Return up to 12 suggestions, ranked highest impact first. Output JSON matching the requested schema.",
    ].join("\n"),
  ],
  ["human", "Suggest indexes for this schema:\n\n{schema}"],
]);

export const explainQueryPrompt = ChatPromptTemplate.fromMessages([
  [
    "system",
    [
      "You are an expert SQL educator. Given a SQL query and a database schema, explain what the query does in plain English.",
      "",
      "Your explanation should:",
      "- Start with a one-sentence summary",
      "- Break down each clause (SELECT, FROM, JOIN, WHERE, etc.)",
      "- Explain the data flow step by step",
      "- Note any performance considerations",
      "",
      "Keep the explanation clear and concise.",
    ].join("\n"),
  ],
  [
    "human",
    "Schema:\n{schema}\n\nExplain this query:\n{query}",
  ],
]);
