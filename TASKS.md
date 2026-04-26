# Super Schema - Project Tasks

## Phase 1: Project Setup & Foundation (Week 1-2)

- [x] Initialize Next.js project with App Router and TypeScript
- [ ] Install and configure Prisma ORM with PostgreSQL
- [ ] Set up NextAuth for authentication
- [x] Install React Flow for canvas UI
- [x] Define the core schema JSON model (tables, columns, constraints, relations)
- [x] Create project folder structure (`/app/api`, `/lib/langchain`, `/components/editor`, `/components/canvas`, `/components/query-builder`, `/prisma`)
- [x] Set up global styles and base layout
- [x] Build basic canvas UI with React Flow (drag-drop table nodes)
- [x] Render table nodes with columns, types, and constraints
- [x] Draw edge connections for relationships between tables
- [x] Add sidebar form for manually creating/editing tables and columns
- [x] Implement add/remove table and column functionality

## Phase 2: SQL Generator & Export (Week 3-4)

- [x] Build SQL generator (schema JSON to SQL) without AI
  - [x] Support PostgreSQL dialect
  - [x] Support MySQL dialect
  - [x] Support SQLite dialect
- [x] Include CREATE TABLE statements with constraints and indexes
- [x] Handle foreign key generation from relations
- [x] Build SQL preview/display panel in the UI
- [x] Export canvas as PNG
- [ ] Export canvas as PDF
- [x] Export schema as JSON file
- [x] Export generated SQL as `.sql` file

## Phase 3: LangChain & AI Integration (Week 5-6)

- [x] Install and configure LangChain with Gemini
- [x] Create prompt templates (`/lib/langchain/prompts.ts`)
  - [x] Schema generation prompt
  - [x] SQL generation prompt (via sql-generator, not AI)
  - [x] Query generation prompt
- [x] Define LangChain AI functions (`/lib/langchain/ai.ts`)
  - [x] `generateSchema` - natural language to schema JSON
  - [x] `explainSchema` - schema to human explanation
  - [x] `fixSchema` - detect and fix schema issues
  - [x] `generateQuery` - natural language to SQL query
- [x] Create API route `/app/api/ai/route.ts` to handle AI requests
- [x] Build AI chat/input UI for schema generation from natural language
- [x] Wire AI-generated schema into the React Flow canvas
- [x] Implement "Explain Schema" feature (schema to human-readable explanation)
- [x] Implement "Fix My Schema" feature (detect and suggest fixes for bad design)

## Phase 4: Query Builder & AI Query Generator (Week 7-8)

- [ ] Build visual query builder component
- [ ] Support visual JOIN construction
- [ ] Implement `generate_query` tool - natural language to SQL query
- [ ] Implement `optimize_query` tool - suggest query optimizations
- [ ] Create API route `/app/api/query/route.ts`
- [ ] Build query input UI (natural language question to SQL)
- [ ] Display generated/optimized queries with syntax highlighting
- [ ] Add query explanation feature (AI explains what a query does)

## Phase 5: Mock Database System (Week 9-10)

- [ ] Set up SQLite in-memory database for mock execution
- [ ] Implement `generate_mock_data` tool using faker.js
- [ ] Build flow: schema -> create tables -> insert mock data -> run query -> show results
- [ ] Display query results in a table UI
- [ ] Add safety & validation layer
  - [ ] Validate SQL syntax before execution
  - [ ] Prevent destructive queries (DROP, DELETE, TRUNCATE)
  - [ ] Sandbox execution environment

## Phase 6: Advanced Features & Polish (Week 11+)

- [ ] Implement "Convert DB" feature (e.g., MySQL to PostgreSQL)
- [ ] Implement "Generate Backend Models" (Prisma / Sequelize code generation)
- [ ] Create schema API route `/app/api/schema/route.ts` for save/load
- [ ] Save schemas to PostgreSQL via Prisma (user projects/history)
- [ ] Add user authentication flow (sign up, sign in, session management)
- [ ] Polish UI/UX across all components
- [ ] Performance optimization
- [ ] Error handling and edge cases
- [ ] Testing (unit + integration)
