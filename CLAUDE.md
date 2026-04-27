# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> See also: `docs/AGENTS.md` for detailed code style guidelines, naming conventions, and layer rules. `docs/CLAUDE.md` has overlapping content and may be merged into this file in the future.

## Quick Start

```bash
cp .env.example .env
docker-compose up --build       # full stack at http://localhost
```

Test credentials: `admin@toystore.com` / `admin123`, `user@toystore.com` / `user123`.

## Commands

### Full stack
```bash
docker-compose up --build
docker-compose down -v             # reset DB/Redis volumes
docker-compose logs -f backend
```

### Backend (Go 1.23, from `backend/`)
```bash
go run ./main.go                   # requires DB + Redis reachable
go vet ./...
gofmt -w .
go test ./...
go test -run TestCreateUser ./internal/repository   # single test
```

Migrations run automatically at backend startup via `golang-migrate` against the `migrations/` directory; state lives in the `schema_migrations` table. To add schema changes, create a new numbered pair `NNNNNN_name.up.sql` / `.down.sql`.

### Frontend (Next.js 14, from `frontend/`)
```bash
npm run dev                        # :3000
npm run lint
npx tsc --noEmit                   # type check
```

There is no jest/vitest runner wired up yet — `npm test` is not configured.

## Architecture

**Stack:** Next.js 14 (App Router, TypeScript) → Go/Gin API → PostgreSQL 16 + Redis 7, all behind an Nginx reverse proxy. Composed with Docker Compose.

```
Browser :80 → Nginx → /api/auth/*  → Go :8080  (strict rate limit: 10 req/min)
                    → /api/*       → Go :8080  (200 req/min)
                    → /*           → Next.js :3000
Go → PostgreSQL :5432, Redis :6379, https://toy.pequla.com/api
```

### Backend (`backend/`) — strict three-layer, never skip layers

- **Handler** (`internal/handlers/`) — only layer that touches the Gin context: parse params/body, call service, set HTTP status. No business logic.
- **Service** (`internal/services/`) — business logic. Returns plain `error`; never picks HTTP status codes.
- **Repository** (`internal/repository/`) — parameterized SQL via `pgx` only. Knows nothing about HTTP or business rules.

Cross-cutting packages: `internal/auth/` (JWT manager + `RequireAuth` / `RequireAdmin` middleware), `internal/cache/` (Redis client wrapper), `internal/models/`, `internal/router/router.go` (single place where deps are wired and routes registered), `config/` (env loading).

`router.Init(cfg, dbPool, redisClient)` must be called before `router.New()` — globals in `router.go` are populated by `Init`. Composition root lives in `main.go`.

### Frontend (`frontend/src/`)

- `app/` — App Router pages. `(auth)/` route group for login/register, `admin/` is admin-only (guarded by `middleware.ts`).
- `lib/api.ts` — Axios instance with interceptors that auto-refresh on 401 and retry the original request. **Does not redirect to `/login`** when the user has no refresh token — only when an existing session expires.
- Tokens are stored in **both** `localStorage` (for the Axios interceptor) and cookies (for the Next.js `middleware.ts` server-side guard); both must stay in sync. An `auth-state-change` `CustomEvent` keeps components/tabs aligned.
- `store/` — Zustand stores (cart, wishlist, order). React Query handles server state.
- `lib/validators.ts` — all forms validated with Zod.
- Theming via `next-themes` with `attribute="class"` + Tailwind `darkMode: ["class"]`. Use semantic Tailwind tokens (`bg-background`, `text-foreground`, `border-border`, `bg-card`, …) defined as CSS variables in `globals.css`. Do not hardcode `bg-white` / `text-gray-700` etc.
- React Server Components fetch from the backend over the Docker network at `http://backend:8080`; the browser only ever talks to `/api` through Nginx.

### Data & external integrations

- **Toy catalog is not stored in our DB.** It is fetched from `https://toy.pequla.com/api` by `ToyService` (10s HTTP timeout) and cached in Redis: `toys:all`, `toy:<id>`, `toys:filtered:<ag>:<type>:<q>` (5 min); `age-groups`, `toy-types` (30 min). The frontend must never call `toy.pequla.com` directly.
- `order_items` snapshots `toy_name` and `price_at_purchase` because the catalog is external and mutable — historical orders must remain stable even if a toy disappears or is repriced.
- **Payments:** Stripe in test mode. If `STRIPE_SECRET_KEY` starts with `sk_`, the backend uses real PaymentIntents with client-side confirmation; otherwise it auto-falls-back to mock mode and creates the order immediately. Webhook endpoint `/api/webhook/stripe` is intentionally exempt from rate limiting.
- **Auth:** JWT access (15 min) + refresh (7 days). Refresh tokens are stored in Redis so logout is actually revocable; without that, a stolen access token would remain valid until expiry.
- **Redis is best-effort for caching.** `cache.Set` failures are logged at warn and the request continues by hitting the external API directly — do not promote cache errors to request failures.

### PostgreSQL

- UUID primary keys (not sequential IDs) — prevents enumeration of orders/users.
- All queries parameterized via `pgx`. Never build SQL by string concatenation.
- Order creation, line-item insertion, and cart clearing happen in a single transaction.

## Project conventions

1. Frontend never calls `toy.pequla.com` directly — always via the Go backend.
2. HTTP status codes are set only in handlers; services return `error`.
3. Parameterized SQL only.
4. No file > 400 lines.
5. All exported Go functions need a doc comment.
6. No `any` in TypeScript. No `console.log` in production code.
7. Commit format: `type(scope): description`.
