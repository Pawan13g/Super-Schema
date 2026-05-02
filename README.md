<div align="center">
  <h1>Super Schema</h1>
  <p><strong>Design databases visually. Ship SQL faster.</strong></p>
  <p>
    Drag-and-drop schema designer with AI-assisted generation, multi-dialect SQL output,
    real-time collaboration, and PR-style review flow.
  </p>
</div>

---

## Why Super Schema

Building a database schema usually means juggling whiteboards, ER diagrams, half-baked SQL files, and ORM model files that drift apart. Super Schema collapses all of that into one canvas:

- **Visual ERD** — drag tables onto a canvas, draw FK relations between columns, get instant SQL.
- **Multi-dialect** — PostgreSQL, MySQL, SQLite output. Switch dialects with one click.
- **AI co-pilot** — bring your own key for Google, OpenAI, Anthropic, Mistral, Grok, OpenRouter, AWS Bedrock, or Ollama (local). Generate schemas from plain English, fix bad design, write queries, document tables.
- **Real-time multiplayer** — flip on Live mode and edit the same schema with teammates. Yjs-backed CRDT sync, peer avatars, no extra setup.
- **PR-style reviews** — propose schema changes, share a diff, get approval, merge. Schema versioning is built in.
- **Live DB import** — point at a running Postgres or MySQL, pull the existing schema, edit visually.
- **One-click exports** — `.sql`, `.json`, `schema.prisma`, Sequelize models, DBML, GraphQL SDL, OpenAPI 3.1, ER PNG — or grab them all as a ZIP.

## Features at a glance

| Area | Highlights |
|---|---|
| Canvas | Drag tables, draw relations from column handles, auto-arrange, undo/redo, comments on hover |
| AI | Generate / explain / fix schema, write & optimize queries, doc-gen, index advisor |
| Collaboration | Real-time multiplayer (Yjs + WebRTC), public read-only share links |
| Reviews | PR-style proposed changes with diff, approve+merge or reject |
| Versioning | Auto-snapshots on every save, restore any version, compare any two |
| Migrations | Compare schemas → generate `ALTER TABLE` SQL with dialect-aware warnings |
| Imports | Live DB introspection (Postgres / MySQL), CSV → table inference, SQL DDL paste |
| Exports | `.sql` per dialect, JSON, Prisma, Sequelize, DBML, GraphQL, OpenAPI, ER PNG, ZIP bundle |
| Templates | E-commerce, SaaS, Blog, Auth, Inventory starters |
| Productivity | Command palette (⌘K), shortcuts overlay (?), trash bin with 30-day recovery |

## How it works

1. **Sketch** — drop tables, define columns, draw FK relations between column handles. Snapping, auto-arrange, and lint feedback as you go.
2. **Refine with AI** — describe a feature in plain English; Super Schema proposes tables and FKs you can drop straight onto the canvas.
3. **Export or import** — copy the SQL, download Prisma / Sequelize models, or push to live Postgres / MySQL via the bulk export.
4. **Ship together** — invite teammates, collaborate live, open a review when you're ready, merge after approval.

## Plans

| | Free | Pro | Team |
|---|---|---|---|
| Workspaces | 1 | 1 | unlimited |
| Schemas | up to 5 | unlimited | unlimited |
| Real-time collaboration | – | ✓ | ✓ |
| Schema reviews | – | ✓ | ✓ |
| Live DB import | ✓ | ✓ | ✓ |
| AI features (BYOK) | ✓ | ✓ | ✓ |
| Public read-only share links | ✓ | ✓ | ✓ |
| Priority support | – | ✓ | ✓ |
| Role-based permissions | – | – | ✓ |

> Pricing finalized at launch — see the website for current tiers.

## AI providers

Super Schema is **bring-your-own-key**. Your provider key is encrypted at rest with AES-256-GCM and only decrypted server-side per request. We never log or proxy through a shared key.

Supported providers:

- Google Gemini
- OpenAI
- Anthropic Claude
- Mistral AI
- xAI Grok
- OpenRouter
- AWS Bedrock
- **Ollama** — fully local, no API key, no data ever leaves your machine

## Privacy

- Your schema JSON, comments, and exported artifacts are stored encrypted at rest in our database.
- AI calls go directly from our server to your chosen provider using your key. We don't keep transcripts.
- Real-time collaboration uses peer-to-peer WebRTC; the schema state syncs directly between connected browsers.
- Read-only share links are unguessable tokens (24-byte URL-safe random) and revocable any time.

## Documentation

Full product docs live at [`/docs`](./app/docs) — quickstart, AI setup, collaboration, reviews, exports, FAQ.

## Support

- **In-app help** — `/docs` inside the product
- **Issues / feature requests** — [GitHub Issues](https://github.com/anthropic-experimental/super-schema/issues)
- **Email** — support@superschema.app

## License

Source-available; see [LICENSE](./LICENSE) for terms.
