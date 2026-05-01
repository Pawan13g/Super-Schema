# Deployment

Quick paths to ship Super Schema. Pick the platform that matches your infra.

---

## 1. Pre-flight checklist (do this once, regardless of platform)

1. **Generate `AUTH_SECRET`**
   ```bash
   make auth-secret
   ```
   Stash the output in your secrets manager.

2. **Provision Postgres**
   - Anywhere reachable from the app (RDS, Cloud SQL, Neon, Supabase, Render).
   - Note the `DATABASE_URL` — Prisma uses the standard libpq format.

3. **Pick `NEXTAUTH_URL`**
   - Production origin, including scheme and no trailing slash.
   - Example: `https://schema.example.com`.

4. **Decide the post-login destination**
   - `NEXT_PUBLIC_DEFAULT_DASHBOARD` — defaults to `/projects`.

5. **(Optional) Create OAuth apps**
   - Each provider needs a callback URL of `${NEXTAUTH_URL}/api/auth/callback/<provider>`.
   - See `.env.example` for the per-provider env vars.

6. **Apply migrations**
   ```bash
   make db-migrate-deploy
   ```

7. **Smoke-test**
   - `curl https://yourdomain/api/health` should return `{ "ok": true, "db": "ok" }`.

---

## 2. Vercel

1. Import the repo in the Vercel dashboard.
2. Set environment variables in the Vercel project (copy from `.env.example`).
   - `DATABASE_URL`
   - `AUTH_SECRET`
   - `NEXTAUTH_URL` — your `*.vercel.app` URL (or custom domain)
   - `NEXT_PUBLIC_DEFAULT_DASHBOARD`
   - any OAuth IDs/secrets you've set up
3. Add a **Build Command** override only if you want migrations to run on every deploy:
   ```
   npx prisma migrate deploy && npm run build
   ```
   Otherwise run `make db-migrate-deploy` from your machine when schema changes.
4. Deploy. The first cold start hits `/api/health` to verify.

---

## 3. Docker (single host)

```bash
# Build
docker build -t super-schema:latest .

# Run with an external Postgres
docker run -d --name super-schema \
  -p 3000:3000 \
  --env-file .env.production \
  super-schema:latest
```

The image is multi-stage (`node:20-alpine` base, ~150 MB final), runs as a
non-root user, exposes a `/api/health` healthcheck, and uses Next's
`standalone` output so it only ships what it needs.

---

## 4. Docker Compose (app + Postgres on one host)

```bash
cp .env.example .env.production
# Fill in AUTH_SECRET, NEXTAUTH_URL, OAuth secrets, etc.

docker compose up -d --build

# Apply migrations once Postgres is up
docker compose exec app npx prisma migrate deploy
```

`docker-compose.yml` provisions both services with healthchecks. Postgres
data persists in the `db-data` named volume.

---

## 5. Self-hosted (bare metal / VM / systemd)

```bash
# On the host
git clone <repo> super-schema && cd super-schema
make setup            # install + generate + migrate-dev
cp .env.example .env  # fill in values
make build
PORT=3000 npm start
```

For long-running setups put `npm start` behind systemd / PM2 and front it
with nginx (TLS termination + gzip).

---

## 6. Operational notes

### Migrations

- **Dev**: `make db-migrate` — interactive, prompts you for a name.
- **Prod**: `make db-migrate-deploy` — non-interactive, applies pending migrations.
- **Reset (destructive)**: `make db-migrate-reset` — type `reset` to confirm.

### Rotating `AUTH_SECRET`

Rotating invalidates **every** active session AND breaks every saved BYOK API
key (they're encrypted with a key derived from `AUTH_SECRET`). Force-log all
users out and ask them to re-enter their AI keys in Settings.

### Rate limiting

The in-memory limiter in `lib/rate-limit.ts` is process-local. For
multi-instance deployments, swap it for Redis (Upstash, Elasticache).

### Service worker

`public/sw.js` is served with a no-cache header so users always pick up new
SW versions on the next visit. Bump `CACHE_VERSION` in the SW when you
change the precache list.

### Health endpoint

`GET /api/health` pings the DB and returns `{ ok, db, latencyMs, uptime }`.
Wire this into your load balancer / Kubernetes liveness + readiness probes.

### Backups

Take regular `pg_dump` snapshots of the app database. The schema is small —
hourly snapshots are cheap.

### CI

`.github/workflows/ci.yml` runs lint + typecheck + tests + a full build on
every push / PR against `main`. Add a deploy job to push to your registry
when CI passes.

---

## 7. Hardening checklist

- [ ] Use a managed Postgres with automated backups + point-in-time recovery.
- [ ] Terminate TLS at a CDN / load balancer (Cloudflare, AWS ALB, nginx).
- [ ] Set `NEXTAUTH_URL` to the **exact** public origin — OAuth callbacks fail otherwise.
- [ ] Restrict OAuth callback URLs in each provider's console to only your prod hosts.
- [ ] Set strong DB credentials and lock the DB to the app's VPC / private network.
- [ ] Replace the in-memory rate limiter with Redis if you scale beyond one instance.
- [ ] Configure log shipping (Vector, Filebeat) to your observability stack.
- [ ] Set up alerting on `/api/health` failures + 5xx error rate.
- [ ] Schedule regular dependency upgrades (`npm outdated` + `npm audit fix`).
