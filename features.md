Bugs / risks (ranked roughly by severity)                                                                                                                                                                                                                                                                                                                     
  <!-- Security / auth
  - /api/mock-db is not auth-gated. Any visitor can POST schema + SQL. Add auth() check.
  - allowDangerousEmailAccountLinking: true on all OAuth providers — same email auto-merges accounts. Fine for trust-self-signup but worth flagging; attackers controlling DNS
  for a victim's email + their own OAuth could potentially link.
  - No rate limiting on /api/ai, /api/sign-up, /api/mock-db. User can burn their key, attacker can spam sign-ups.
  - No password reset, no email verification (emailVerified field exists but never set). next-auth Email provider not wired.
  - Sign-up does no captcha / bot check.
  - API key decryptSecret failure leaves hasApiKey: true with mask "•••• (re-enter)" — user UI implies key works. Better: hasApiKey: false after decrypt failure.

  Data / state
  - Autosave race: switching schema mid-debounce can save canvas state to the previous schema id. No save-cancellation tied to active schema.
  - No optimistic locking on Schema.version — concurrent edits in two tabs silently overwrite.
  - crypto.randomUUID() fallback in chat is Math.random() — collisions possible if user spams.
  - Schema autosave triggers on every keystroke after debounce; no diff check, so identical state still writes.
  - getDecryptedKey returns enabled: true for users with no settings row — should be considered "not configured" so the AI route's error message is clearer. -->

  <!-- Canvas / React Flow
  - nodes state in schema-canvas.tsx overwrites with positions from RF only for existing entries. New tables added while a drag is in flight lose drag delta.
  - Auto-arrange uses estimated heights, not actual node.measured dimensions — overlapping rows possible with long column lists.
  - No undo/redo anywhere (Ctrl+Z does nothing on the canvas).
  - Edge labels (1:N, N:M) hard to read in dark mode (labelBgStyle: var(--color-card) is fine, but stroke uses node color which may be near-bg).
  - Junction table (createJunctionTable) places node at (0,0) then user-drags — overlap with existing tables.
  - React Flow MiniMap hidden on mobile but Controls remain — fine, but auto-arrange button has no toast feedback. -->

  <!-- OAuth / sign-in
  - microsoft-entra-id provider name in signIn() must match exactly — if env tenant is common, login still requires real app registration. No error UI if the redirect fails,
  just silent.
  - events.createUser + events.linkAccount both seed defaults — idempotent guard works, but two transactions race possible. Use INSERT ... ON CONFLICT for the workspace seed.
  - signIn on sign-in page doesn't catch the OAuthAccountNotLinked error — user gets generic "Invalid email or password". -->

  <!-- UI / UX bugs
  - Settings tab state not synced to URL hash on switch — back button doesn't navigate between sections.
  - AI chat regenerate walks back to prior user message; if the user edited an earlier message, history truncates. No undo.
  - ResizablePanel defaultSize is locked at mount — switching breakpoints (rotate phone) doesn't re-balance.
  - Toast at top-center can overlap the menubar on small screens.
  - nativeButton warning may still trigger on <DropdownMenuTrigger render={<button>} in app-sidebar.tsx if base-ui has stricter checks for child types.
  - Workspace switcher dropdown closes on outside click but not on Escape.
  - Sign-up doesn't normalize email case (Postgres unique index is case-sensitive).

  Build / infra
  - make db-migrate-reset is destructive but listed without confirmation.
  - Makefile clean-all removes package-lock.json — hard to reproduce builds after.
  - No CI config in repo.
  - No tests at all (TASKS.md flags this).
  - next.config not seen — verify images.remotePatterns set if Avatar URLs come from external hosts. -->

  ---
  Suggested features (ranked by leverage)

  <!-- High value, low effort
  1. Auth-gate /api/mock-db — one line, big risk fix.
  2. Validate API key on save — fire a 1-token test call when user saves a key, toast the result. Saves debugging time.
  3. AI cost / latency badge — track elapsed ms per call, show next to the assistant message.
  4. Undo / redo on canvas — Ctrl+Z. Keep last 50 schema snapshots in a ref.
  5. Schema linter — runs on every edit, surfaces a sidebar panel with: tables without PK, columns without type, FKs to missing tables, orphan tables, snake_case violations.
  6. Keyboard shortcuts overlay — ? opens a modal with the full list. Already partial in docs.
  7. Search across all schemas — Cmd-K palette: jump to table or schema by name.
  8. Toast for auto-arrange — "Arranged N tables".
  9. Dark mode polish — fix edge label readability + table-color contrast in dark. -->

  Medium value, medium effort
  <!-- 10. Schema versioning — already in TASKS.md as deferred. Snapshots on each save, with diff view. -->
  11. Compare schemas — pick two schemas, see add/drop/alter list.
  12. Migration SQL generator — diff between two schemas → ALTER TABLE statements.
  13. Schema templates library — one-click "E-commerce", "SaaS", "Blog", etc. Bundled JSON.
  14. CSV → table inference — drop a CSV, app proposes schema (column types from sampling).
  15. Comments on tables / columns — already partial (updateTableComment); expose in canvas hover card.
  16. AI doc-gen — auto-fill column comments via current model.
  17. Index advisor — AI suggests indexes based on FK columns + common query patterns.
  18. Public read-only schema links — /share/<id>, view-only canvas. Big growth driver.
  19. More providers: Anthropic Claude (@langchain/anthropic), Ollama (local), Mistral. Trivial extension to current LlmCreds.
  20. Export DBML / GraphQL / OpenAPI — wire into existing model-generator scaffold.
  21. Bulk export — zip with .sql, .json, schema.prisma, models.ts, er.png.

  High value, high effort
  22. Connect to a live DB — read existing schema from a Postgres/MySQL connection, import as a new schema. Massive onboarding boost.
  23. Real-time collaboration — Yjs + WebSocket or Liveblocks. Canvas multiplayer.
  24. Team workspaces — invite members, RBAC. Currently every workspace has a single ownerId.
  25. GitHub sync — push generated schema/models to a repo on save. Auth via GitHub App.
  26. Schema review / approval flow — PR-style for schema changes (esp. for teams).
  27. Mobile canvas mode — tap-to-select, full-screen sheets for editing. Current canvas is desktop-first.
  28. Self-hosted local mode — run AI against Ollama with no key, fully offline.

  UX polish (cheap wins)
  - ? to open shortcuts modal.
  - Cmd+K global command palette.
  - Trash bin (soft delete) for schemas/projects, 30-day recovery.
  - Active schema/project shown in browser tab title.
  - Toaster theme="system" — confirm sonner respects next-themes resolved theme.
  - Auto-save indicator with last-saved timestamp on hover.
  - Empty-state illustrations on /projects and inside the canvas.

  Want me to pick any of these and ship it? Best first picks IMO: auth-gate /api/mock-db (1-line security fix), API key validation on save (small UX win), undo/redo + linter
  (high impact, contained scope).