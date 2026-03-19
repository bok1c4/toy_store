# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> See also: `AGENTS.md` for detailed code style guidelines, naming conventions, and layer rules.

## Quick Start

```bash
cp .env.example .env
docker-compose up --build
```

App available at `http://localhost`. Test credentials: `admin@toystore.com` / `admin123` and `user@toystore.com` / `user123`.

## Commands

### Full Stack
```bash
docker-compose up --build          # Build and start all services
docker-compose down -v             # Stop and remove volumes (data reset)
docker-compose logs -f backend     # Tail backend logs
```

### Backend (Go)
```bash
cd backend
go run ./main.go                   # Run locally (requires DB/Redis running)
go vet ./...                       # Static analysis (must pass before commit)
gofmt -w .                         # Format all files
go test ./...                      # Run all tests
go test -run TestCreateUser ./internal/repository   # Run single test
```

### Frontend (Next.js)
```bash
cd frontend
npm run dev                        # Dev server (port 3000)
npm run lint                       # ESLint
npx tsc --noEmit                   # Type check (must pass before commit)
npm test                           # Run all tests
npm test -- --testNamePattern="AuthForm"  # Run single test
```

## Architecture

**Stack:** Next.js 14 (App Router, TypeScript) → Go/Gin API → PostgreSQL + Redis, behind Nginx reverse proxy. All containerized via Docker Compose.

**Request flow:**
```
Browser :80 → Nginx → /api/* → Go backend :8080 → PostgreSQL / Redis / toy.pequla.com
                     → /*    → Next.js :3000
```

### Backend (`backend/`)

Strict three-layer architecture — never skip layers:
- **Handler** (`internal/handlers/`) — HTTP only: parse request, call service, return JSON with HTTP status codes
- **Service** (`internal/services/`) — business logic, returns `error` (never HTTP codes)
- **Repository** (`internal/repository/`) — database queries only

Other packages: `internal/auth/` (JWT + middleware), `internal/cache/` (Redis), `internal/models/` (domain types), `internal/router/` (route registration), `config/` (env loading), `migrations/` (SQL schema).

**Auth:** JWT access tokens (15 min) + refresh tokens stored in Redis (7 days). Middleware: `RequireAuth` and `RequireAdmin`.

**Caching:** Toy catalog from external API (`toy.pequla.com/api`) is cached in Redis — `toys:all` (5 min TTL), metadata `age-groups`/`toy-types` (30 min TTL). Frontend never calls the external API directly.

### Frontend (`frontend/src/`)

- `app/` — Next.js App Router pages; `(auth)/` route group for login/register
- `components/ui/` — shadcn/ui primitives; `components/layout/` — Navbar/Footer; feature-specific subdirs for domain components
- `lib/api.ts` — Axios instance with interceptors (auto-refresh on 401), `lib/auth.ts` — token helpers, `lib/validators.ts` — Zod schemas
- `store/` — Zustand stores (cart, wishlist, order)
- `middleware.ts` — Next.js server-side route guards (validates JWT cookie)

**No `any` in TypeScript. No `console.log` in production code. All forms validated with Zod.**

### Database

PostgreSQL with UUID primary keys. Key tables: `users` (role: user/admin), `orders` + `order_items` (payment_status: pending/paid/failed/refunded), `cart_items` (unique user+toy, includes price/name cache snapshot), `wishlist_items`. All queries use parameterized statements (pgx).

### Key Rules

1. Frontend never calls `toy.pequla.com` directly — always via Go backend
2. HTTP status codes set only in handlers
3. Parameterized SQL only — never string concatenation
4. No file > 400 lines
5. All exported Go functions need a doc comment
6. Commit format: `type(scope): description`
