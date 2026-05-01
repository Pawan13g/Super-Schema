# Super Schema — Makefile
# Cross-platform (Windows/macOS/Linux). Requires: node, npm, npx.
# Run from project root: `make <target>`

SHELL := /bin/sh
NPM   ?= npm
NPX   ?= npx
PORT  ?= 3000

.DEFAULT_GOAL := help

# ---------- Help ----------
.PHONY: help
help:
	@echo "Super Schema — available targets:"
	@echo ""
	@echo "  Setup"
	@echo "    install         Install npm dependencies"
	@echo "    setup           install + prisma generate + migrate-dev"
	@echo "    env-check       Verify required env vars present"
	@echo ""
	@echo "  Dev / Run"
	@echo "    dev             Start Next.js dev server (PORT=$(PORT))"
	@echo "    run             Alias for 'start' (production server)"
	@echo "    build           Production build"
	@echo "    start           Run built app"
	@echo "    lint            Run eslint"
	@echo "    typecheck       Run tsc --noEmit"
	@echo ""
	@echo "  Database / Prisma"
	@echo "    db-generate     Generate Prisma client"
	@echo "    db-migrate      Apply migrations (dev, with prompt)"
	@echo "    db-migrate-deploy   Apply migrations (production / non-interactive)"
	@echo "    db-migrate-create   Create migration without applying (NAME=add_x)"
	@echo "    db-migrate-reset    Drop DB + re-apply all migrations (DESTRUCTIVE)"
	@echo "    db-push         Push schema without creating migration"
	@echo "    db-studio       Open Prisma Studio"
	@echo "    db-status       Show migration status"
	@echo ""
	@echo "  Auth (NextAuth helpers)"
	@echo "    auth-secret     Print a fresh AUTH_SECRET"
	@echo ""
	@echo "  Maintenance"
	@echo "    clean           Remove .next + dist artifacts"
	@echo "    clean-all       clean + remove node_modules + lock"
	@echo "    fresh           clean-all + install + setup"
	@echo ""

# ---------- Setup ----------
.PHONY: install
install:
	$(NPM) install

.PHONY: setup
setup: install db-generate db-migrate
	@echo "Setup complete."

.PHONY: env-check
env-check:
	@node -e "['DATABASE_URL','GOOGLE_API_KEY','AUTH_SECRET'].forEach(k=>{if(!process.env[k])console.error('MISSING:',k);else console.log('OK:',k)})"

# ---------- Dev / Run ----------
.PHONY: dev
dev:
	$(NPM) run dev -- -p $(PORT)

.PHONY: build
build:
	$(NPM) run build

.PHONY: start
start:
	$(NPM) run start -- -p $(PORT)

.PHONY: run
run: start

.PHONY: lint
lint:
	$(NPM) run lint

.PHONY: typecheck
typecheck:
	$(NPX) tsc --noEmit

# ---------- Prisma / DB ----------
.PHONY: db-generate
db-generate:
	$(NPX) prisma generate

.PHONY: db-migrate
db-migrate:
	$(NPX) prisma migrate dev

.PHONY: db-migrate-deploy
db-migrate-deploy:
	$(NPX) prisma migrate deploy

.PHONY: db-migrate-create
db-migrate-create:
	@if [ -z "$(NAME)" ]; then echo "Usage: make db-migrate-create NAME=add_x"; exit 1; fi
	$(NPX) prisma migrate dev --name $(NAME) --create-only

.PHONY: db-migrate-reset
db-migrate-reset:
	@echo ""
	@echo "⚠️  DESTRUCTIVE: drops the entire database and re-applies all migrations."
	@echo "   All data in $$DATABASE_URL will be lost."
	@echo ""
	@printf "Type 'reset' to continue, anything else to abort: "
	@read REPLY; [ "$$REPLY" = "reset" ] || (echo "Aborted." && exit 1)
	$(NPX) prisma migrate reset --force

.PHONY: db-push
db-push:
	$(NPX) prisma db push

.PHONY: db-studio
db-studio:
	$(NPX) prisma studio

.PHONY: db-status
db-status:
	$(NPX) prisma migrate status

# ---------- Auth ----------
.PHONY: auth-secret
auth-secret:
	@node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# ---------- Maintenance ----------
.PHONY: clean
clean:
	@node -e "const f=require('fs');['.next','dist','out'].forEach(d=>f.rmSync(d,{recursive:true,force:true}))"
	@echo "Cleaned build artifacts."

.PHONY: clean-all
clean-all: clean
	@node -e "const f=require('fs');['node_modules'].forEach(d=>f.rmSync(d,{recursive:true,force:true}))"
	@echo "Removed node_modules. (package-lock.json kept for reproducible builds — delete manually if you really mean it.)"

.PHONY: fresh
fresh: clean-all install setup
	@echo "Fresh install complete."
