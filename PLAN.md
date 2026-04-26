
# 🚀 1. High-Level System (Next.js + LangChain)

### Tech Stack (Updated)

* **Frontend + Backend**: Next.js (App Router)
* **Language**: TypeScript
* **AI Layer**: LangChain
* **DB (App Metadata)**: PostgreSQL
* **ORM**: Prisma
* **Canvas/UI**: React Flow
* **Auth**: NextAuth

---

# 🧠 2. Gemini Role in Your System

Gemini (via LangChain) will act as:

### 1. Schema Designer

> Converts natural language → schema JSON

### 2. SQL Generator

> Converts schema → dialect SQL

### 3. Query Assistant

> Helps write, optimize, explain queries

### 4. Debugger

> Fix broken SQL / schema

### 5. Mock Data Generator

> Generate realistic test data

---

# 🧩 3. Core Architecture (AI Layer)

Use **LangChain Agents + Tools**

```text
User Input
   ↓
LangChain Agent
   ↓
Tools (Skills)
   ↓
Response (UI / SQL / Schema)
```

---

# 🛠️ 4. Define Claude “Skills” (Tools)

These are CRITICAL. Without them, the AI becomes messy.

---

## 🔹 Skill 1: Schema Generator

### Purpose

Convert natural language → structured schema JSON

### Tool Name

```ts
generate_schema
```

### Input

```json
{
  "description": "string"
}
```

### Output

```json
{
  "tables": [...],
  "relations": [...]
}
```

---

## 🔹 Skill 2: SQL Generator

```ts
generate_sql
```

### Input

```json
{
  "schema": {},
  "dialect": "postgresql | mysql | sqlite"
}
```

---

## 🔹 Skill 3: Query Generator

```ts
generate_query
```

### Input

```json
{
  "schema": {},
  "question": "string"
}
```

---

## 🔹 Skill 4: Query Optimizer

```ts
optimize_query
```

---

## 🔹 Skill 5: Mock Data Generator

```ts
generate_mock_data
```

---

## 🔹 Skill 6: Schema Validator

```ts
validate_schema
```

---

# 🧠 5. Claude System Prompt (VERY IMPORTANT)

This defines how Claude behaves.

---

## ✅ Master System Prompt

```text
You are an expert database architect and SQL engineer.

Your responsibilities:
- Design normalized, scalable database schemas
- Generate correct SQL for multiple dialects (PostgreSQL, MySQL, SQLite)
- Ensure constraints, indexes, and relationships are properly defined
- Avoid hallucination: only generate valid SQL and schema structures
- Always follow the provided JSON schema format strictly
- Prefer best practices (3NF, indexing, foreign keys)

When generating schema:
- Use consistent naming conventions (snake_case)
- Include primary keys for all tables
- Use foreign keys for relationships
- Normalize repeated data into separate tables

When generating SQL:
- Respect the selected SQL dialect
- Avoid unsupported features
- Include constraints and indexes

When unsure:
- Ask for clarification instead of guessing

Output must always be structured and machine-readable when required.
```

---

# 🎯 6. Prompt Templates (LangChain)

---

## 🔹 Prompt: Schema Generation

```ts
const schemaPrompt = `
Convert the following application description into a database schema.

Description:
{input}

Output JSON format:
{
  "tables": [
    {
      "name": "",
      "columns": [
        {
          "name": "",
          "type": "",
          "constraints": []
        }
      ]
    }
  ],
  "relations": []
}

Rules:
- Use snake_case
- Add primary keys
- Normalize data
- Include foreign keys
`;
```

---

## 🔹 Prompt: SQL Generation

```ts
const sqlPrompt = `
Convert the following schema into {dialect} SQL.

Schema:
{schema}

Rules:
- Follow {dialect} syntax strictly
- Include CREATE TABLE statements
- Add constraints and indexes
`;
```

---

## 🔹 Prompt: Query Generation

```ts
const queryPrompt = `
Given this schema:
{schema}

Write an SQL query for:
{question}

Return only SQL.
`;
```

---

# 🧱 7. Next.js Project Structure

```text
/app
  /api
    /ai
      route.ts
    /schema
    /query
/lib
  /langchain
    agent.ts
    tools.ts
    prompts.ts
/components
  /editor
  /canvas
  /query-builder
/prisma
```

---

# ⚙️ 8. LangChain Agent Setup (TypeScript)

### tools.ts

```ts
import { tool } from "langchain/tools";

export const generateSchemaTool = tool({
  name: "generate_schema",
  description: "Generate DB schema from text",
  func: async ({ description }) => {
    // call LLM with schema prompt
  }
});
```

---

### agent.ts

```ts
import { initializeAgentExecutorWithOptions } from "langchain/agents";

const agent = await initializeAgentExecutorWithOptions(
  tools,
  llm,
  {
    agentType: "openai-functions",
    verbose: true
  }
);
```

---

# 🎨 9. GUI Features Mapping

| Feature          | Implementation   |
| ---------------- | ---------------- |
| Drag-drop tables | React Flow       |
| Relationships    | Edge connections |
| Edit schema      | Sidebar forms    |
| Export           | Canvas → PNG/PDF |
| Query builder    | Visual joins     |

---

# 🧪 10. Mock System Design

Use:

* SQLite in-memory
* Seed with fake data (faker.js)

Flow:

```text
Schema → Create tables → Insert mock data → Run query → Show result
```

---

# 🔐 11. Safety & Validation

Before executing SQL:

* Validate syntax
* Prevent destructive queries
* Sandbox execution

---

# 📅 12. Step-by-Step Start Plan

---

## Week 1–2

* Setup Next.js
* Build schema JSON model
* Basic canvas UI

---

## Week 3–4

* SQL generator (no AI yet)
* Export features

---

## Week 5–6

* LangChain integration
* Schema AI generation

---

## Week 7–8

* Query builder + AI query generator

---

## Week 9–10

* Mock DB system

---

## Week 11+

* Optimization + advanced features

---

# 💡 13. Smart Features You Should Add

These will make your product stand out:

### 🔥 1. “Explain Schema” (AI)

* Turns schema → human explanation

### 🔥 2. “Fix My Schema”

* Detects bad design

### 🔥 3. “Convert DB”

* MySQL → PostgreSQL

### 🔥 4. “Generate Backend Models”

* Prisma / Sequelize code