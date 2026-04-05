# ────────────────────────────────────────────
# NameCard — Development Commands
# ────────────────────────────────────────────

.PHONY: dev build deploy lint typecheck db-schema

## Start the development server
dev:
	npm run dev

## Production build (TypeScript check + Vite)
build:
	npm run build

## Deploy to Cloudflare Pages
deploy: build
	npx wrangler pages deploy dist --project-name namecade --branch main

## Run ESLint
lint:
	npm run lint

## TypeScript type-check only (no emit)
typecheck:
	npx tsc --noEmit

## Apply database schema to D1
db-schema:
	npx wrangler d1 execute namecade-db --file=schema.sql
