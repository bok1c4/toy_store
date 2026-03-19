# University Toy Store — Master Project Plan

### AI Agent Execution Blueprint (Kimi 2.5 / MiniMax 2.5 / GLM-5)

> **How to use this document:**
> This file is your single source of truth. Read it fully before writing any code. Each phase is a self-contained unit. You will receive one phase at a time. Do not jump ahead. When a phase is complete, confirm with the human reviewer before proceeding.

---

## SECTION 0 — Project Identity

| Field          | Value                                                              |
| -------------- | ------------------------------------------------------------------ |
| Project        | University Toy Store Web Application                               |
| Type           | Full-stack monorepo, fully Dockerized                              |
| Stack          | Next.js 14 · Go 1.23 (Gin) · PostgreSQL 16 · Redis 7 · Nginx       |
| External API   | `https://toy.pequla.com/api` (read-only, no auth)                  |
| Auth strategy  | JWT access token (15 min) + refresh token (7 days) stored in Redis |
| Code reviewer  | Claude Opus / Sonnet (human-initiated, not automated)              |
| Primary agents | Sonnet 4.6, Kimi 2.5, MiniMax 2.5, GLM-5                           |

---

## SECTION 1 — Non-Negotiable Rules

These rules apply to every file you write, in every phase, without exception.

### Code quality

- Write clean, readable code over clever code.
- Every exported function must have a one-line comment explaining what it does.
- No file longer than 400 lines. Split if needed.
- No hardcoded secrets, ports, hostnames, or credentials in source files. All config comes from environment variables.
- Every database query must use parameterized statements — never string concatenation.
- All errors must be handled explicitly. Never swallow errors silently.

### Go (backend) conventions

- Use `internal/` package structure. No business logic in `main.go`.
- Handler → Service → Repository layering. Handlers do not touch the DB directly.
- Use `github.com/gin-gonic/gin` for routing.
- Use `github.com/golang-jwt/jwt/v5` for JWT.
- Use `golang.org/x/crypto/bcrypt` for password hashing (cost 12).
- Use `github.com/go-playground/validator/v10` for request struct validation.
- Use `github.com/rs/zerolog` for structured logging.
- Use `github.com/golang-migrate/migrate/v4` for database migrations.
- Return errors from services, not HTTP codes. HTTP codes are set only in handlers.
- Use `github.com/ulule/limiter/v3` for rate limiting on auth routes.

### Next.js (frontend) conventions

- Use App Router (not Pages Router).
- Use TypeScript for all files. No plain `.js` files in `src/`.
- Use `zod` for all form validation schemas.
- Use `axios` or native `fetch` with a shared API client in `src/lib/api.ts`.
- All protected pages must use middleware to check for valid JWT. Redirect to `/login` if absent.
- Use Tailwind CSS for styling. No inline `style` attributes except for truly dynamic values.
- No `console.log` in production code. Use proper error boundaries.

### Git discipline

- Commit after each logical unit (not after each file).
- Commit message format: `type(scope): description` — e.g. `feat(auth): add JWT refresh endpoint`.
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`.

### Docker discipline

- Each service must have a dedicated `Dockerfile` using multi-stage builds.
- No secrets in `Dockerfile` or `docker-compose.yml`. Use `.env` file (gitignored).
- All services must define `healthcheck` in docker-compose.
- The full application must start with a single command: `docker-compose up --build`.

---

## SECTION 2 — Architecture Overview

```
Browser
  │
  ▼
Nginx (port 80) ─── reverse proxy, rate limiting, static assets
  │
  ├──► Frontend (Next.js, port 3000)
  │         │
  │         └──► Backend API (Go/Gin, port 8080)
  │                   │
  │                   ├──► PostgreSQL (port 5432)  ← users, orders, carts, wishlist
  │                   ├──► Redis (port 6379)        ← JWT store, toy cache (5 min TTL)
  │                   └──► toy.pequla.com/api       ← external read-only toy catalog
```

### Data flow rules

- The browser NEVER calls `toy.pequla.com` directly.
- All toy data flows through the Go backend, which caches responses in Redis.
- JWT access tokens are sent in the `Authorization: Bearer <token>` header.
- Refresh tokens are stored in Redis with a 7-day TTL and can be revoked on logout.
- Admin routes are protected by both JWT middleware and a role-check middleware.

---

## SECTION 3 — Full Folder Structure

```
toy-store/                          ← monorepo root
├── .env.example                    ← template for environment variables
├── .gitignore
├── docker-compose.yml              ← orchestrates all services
├── README.md                       ← setup instructions
│
├── nginx/
│   ├── Dockerfile
│   └── nginx.conf                  ← reverse proxy config
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   └── src/
│       ├── app/
│       │   ├── layout.tsx           ← root layout, navbar, footer
│       │   ├── page.tsx             ← home/landing page
│       │   ├── (auth)/
│       │   │   ├── login/page.tsx
│       │   │   └── register/page.tsx
│       │   ├── toys/
│       │   │   ├── page.tsx         ← catalog with filters, search, pagination
│       │   │   └── [id]/page.tsx    ← toy detail
│       │   ├── cart/page.tsx
│       │   ├── checkout/
│       │   │   ├── page.tsx
│       │   │   └── success/page.tsx
│       │   ├── profile/
│       │   │   ├── page.tsx
│       │   │   └── orders/
│       │   │       ├── page.tsx
│       │   │       └── [id]/page.tsx
│       │   ├── wishlist/page.tsx
│       │   └── admin/
│       │       ├── layout.tsx       ← admin layout with sidebar
│       │       ├── page.tsx         ← dashboard
│       │       ├── users/page.tsx
│       │       ├── orders/page.tsx
│       │       └── analytics/page.tsx
│       ├── components/
│       │   ├── ui/                  ← Button, Input, Badge, Modal, Spinner
│       │   ├── layout/              ← Navbar, Footer, Sidebar
│       │   ├── toys/                ← ToyCard, ToyGrid, ToyFilters, ToySearch
│       │   ├── cart/                ← CartItem, CartSummary, CartDrawer
│       │   ├── checkout/            ← CheckoutForm, PaymentSimulator
│       │   ├── orders/              ← OrderCard, OrderDetail, OrderStatus
│       │   └── admin/               ← UserTable, OrderTable, AnalyticsChart, MetricCard
│       ├── lib/
│       │   ├── api.ts               ← fetch wrapper with auth headers + interceptors
│       │   ├── auth.ts              ← token storage (localStorage), helpers
│       │   └── validators.ts        ← zod schemas for all forms
│       ├── hooks/
│       │   ├── useAuth.ts
│       │   ├── useCart.ts
│       │   └── useWishlist.ts
│       ├── store/
│       │   └── cartStore.ts         ← Zustand cart state
│       └── middleware.ts            ← Next.js route protection middleware
│
├── backend/
│   ├── Dockerfile
│   ├── go.mod
│   ├── go.sum
│   ├── main.go                      ← entry point, wire everything together
│   ├── config/
│   │   └── config.go               ← load and validate env vars at startup
│   ├── migrations/
│   │   ├── 000001_create_users.up.sql
│   │   ├── 000001_create_users.down.sql
│   │   ├── 000002_create_orders.up.sql
│   │   ├── 000002_create_orders.down.sql
│   │   ├── 000003_create_cart.up.sql
│   │   ├── 000003_create_cart.down.sql
│   │   └── 000004_create_wishlist.up.sql
│   └── internal/
│       ├── auth/
│       │   ├── jwt.go               ← token generation and parsing
│       │   └── middleware.go        ← Gin middleware: RequireAuth, RequireAdmin
│       ├── cache/
│       │   └── redis.go             ← Redis client, get/set/del helpers
│       ├── database/
│       │   └── postgres.go          ← DB connection pool, ping on startup
│       ├── handlers/
│       │   ├── auth_handler.go
│       │   ├── user_handler.go
│       │   ├── toy_handler.go
│       │   ├── cart_handler.go
│       │   ├── order_handler.go
│       │   ├── wishlist_handler.go
│       │   └── admin_handler.go
│       ├── models/
│       │   ├── user.go
│       │   ├── order.go
│       │   ├── cart.go
│       │   └── wishlist.go
│       ├── repository/
│       │   ├── user_repo.go
│       │   ├── order_repo.go
│       │   ├── cart_repo.go
│       │   └── wishlist_repo.go
│       ├── services/
│       │   ├── auth_service.go
│       │   ├── user_service.go
│       │   ├── toy_service.go       ← calls external API, caches in Redis
│       │   ├── cart_service.go
│       │   ├── order_service.go
│       │   ├── payment_service.go   ← mock payment simulation
│       │   └── admin_service.go
│       └── router/
│           └── router.go            ← register all Gin routes with middleware
│
└── database/
    └── seed.sql                     ← creates admin user + test data for local dev
```

---

## SECTION 4 — Database Schema (Full SQL)

Run these migrations in order using `golang-migrate`.

```sql
-- 000001_create_users.up.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username      VARCHAR(50)  NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    avatar_url    TEXT,
    address       TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- 000002_create_orders.up.sql
CREATE TABLE orders (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status           VARCHAR(30) NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','processing','shipped','delivered','cancelled')),
    payment_status   VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (payment_status IN ('pending','paid','failed','refunded')),
    total_amount     NUMERIC(10,2) NOT NULL,
    shipping_address TEXT NOT NULL,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE order_items (
    id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id           UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    toy_id             INTEGER NOT NULL,
    toy_name           VARCHAR(255) NOT NULL,   -- snapshot at purchase time
    toy_image_url      TEXT,                    -- snapshot at purchase time
    price_at_purchase  NUMERIC(10,2) NOT NULL,  -- snapshot at purchase time
    quantity           INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- 000003_create_cart.up.sql
CREATE TABLE cart_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    toy_id          INTEGER NOT NULL,
    toy_name_cache  VARCHAR(255) NOT NULL,
    toy_image_cache TEXT,
    price_cache     NUMERIC(10,2) NOT NULL,
    quantity        INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, toy_id)
);

CREATE INDEX idx_cart_items_user_id ON cart_items(user_id);

-- 000004_create_wishlist.up.sql
CREATE TABLE wishlist_items (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    toy_id     INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, toy_id)
);

CREATE INDEX idx_wishlist_user_id ON wishlist_items(user_id);
```

---

## SECTION 5 — Complete API Contract

Base URL (inside Docker network): `http://backend:8080`
Base URL (from browser via Nginx): `/api`

All endpoints return JSON. Error response format:

```json
{ "error": "human-readable message", "code": "MACHINE_CODE" }
```

Success response format (list):

```json
{ "data": [...], "total": 42, "page": 1, "per_page": 20 }
```

Success response format (single):

```json
{ "data": { ... } }
```

### 5.1 Auth Endpoints (no auth required)

```
POST /api/auth/register
Body: { "username": "alice", "email": "alice@example.com", "password": "secret123" }
Response 201: { "data": { "id": "uuid", "username": "alice", "email": "...", "role": "user" } }
Errors: 400 (validation), 409 (email/username taken)

POST /api/auth/login
Body: { "email": "alice@example.com", "password": "secret123" }
Response 200: { "access_token": "...", "refresh_token": "...", "user": { ... } }
Errors: 400 (validation), 401 (wrong credentials), 403 (account disabled)

POST /api/auth/logout
Headers: Authorization: Bearer <access_token>
Body: { "refresh_token": "..." }
Response 200: { "message": "logged out" }
Action: invalidates refresh token in Redis

POST /api/auth/refresh
Body: { "refresh_token": "..." }
Response 200: { "access_token": "...", "refresh_token": "..." }
Errors: 401 (invalid or expired refresh token)
```

### 5.2 User Endpoints (requires auth)

```
GET /api/user/profile
Response 200: { "data": { "id", "username", "email", "role", "avatar_url", "address", "created_at" } }

PUT /api/user/profile
Body: { "username"?: "...", "address"?: "...", "avatar_url"?: "..." }
Response 200: { "data": { updated user } }

PUT /api/user/password
Body: { "current_password": "...", "new_password": "..." }
Response 200: { "message": "password updated" }
Errors: 400 (validation), 401 (wrong current password)

GET /api/user/orders
Query: ?page=1&per_page=10
Response 200: { "data": [...orders], "total": N, "page": 1, "per_page": 10 }

GET /api/user/orders/:id
Response 200: { "data": { order + order_items } }
Errors: 404 (not found or not owned by user)
```

### 5.3 Toy Endpoints (public, no auth required)

```
GET /api/toys
Query: ?age_group=3-5&type=puzzle&q=lego&page=1&per_page=20
Response 200: { "data": [...toys], "total": N }
Note: Filters are applied server-side after fetching from external API.
      Results are cached in Redis with key "toys:all" (5 min TTL).

GET /api/toys/:id
Response 200: { "data": { toy object } }
Note: Cached in Redis as "toy:<id>" (5 min TTL).
Errors: 404 (toy not found in external API)

GET /api/toys/permalink/:slug
Response 200: { "data": { toy object } }

GET /api/toys/age-groups
Response 200: { "data": [...age groups] }
Note: Cached as "age-groups" (30 min TTL).

GET /api/toys/types
Response 200: { "data": [...types] }
Note: Cached as "toy-types" (30 min TTL).
```

### 5.4 Cart Endpoints (requires auth)

```
GET /api/cart
Response 200: { "data": [...cart_items with toy details], "subtotal": 49.99 }

POST /api/cart
Body: { "toy_id": 123, "quantity": 2 }
Response 201: { "data": { cart_item } }
Note: If toy_id already in cart, increments quantity.
      Fetches toy from external API to snapshot name/image/price.

PUT /api/cart/:item_id
Body: { "quantity": 3 }
Response 200: { "data": { updated cart_item } }
Errors: 400 (quantity < 1 → use DELETE instead), 404

DELETE /api/cart/:item_id
Response 200: { "message": "item removed" }

DELETE /api/cart
Response 200: { "message": "cart cleared" }
```

### 5.5 Checkout & Orders (requires auth)

```
POST /api/checkout
Body: { "shipping_address": "123 Main St, City" }
Flow:
  1. Load user's cart (error if empty)
  2. Call payment_service.Simulate() → always returns success
  3. Create order record with status=processing, payment_status=paid
  4. Create order_items (snapshot toy name, image, price)
  5. Clear user's cart
  6. Return created order
Response 201: { "data": { order with items } }
Errors: 400 (empty cart, missing address)

GET /api/checkout/simulate
Response 200: { "success": true, "transaction_id": "FAKE-TXN-XXXXXX" }
Note: This is the mock payment endpoint. Always returns success.
```

### 5.6 Wishlist Endpoints (requires auth)

```
GET /api/wishlist
Response 200: { "data": [...wishlist items with toy details from API] }

POST /api/wishlist
Body: { "toy_id": 123 }
Response 201: { "data": { wishlist_item } }
Errors: 409 (already in wishlist)

DELETE /api/wishlist/:toy_id
Response 200: { "message": "removed from wishlist" }
```

### 5.7 Admin Endpoints (requires auth + role=admin)

```
GET /api/admin/users
Query: ?page=1&per_page=20&q=search_term
Response 200: { "data": [...users], "total": N }

GET /api/admin/users/:id
Response 200: { "data": { user + order history } }

PUT /api/admin/users/:id
Body: { "is_active"?: bool, "role"?: "user"|"admin" }
Response 200: { "data": { updated user } }

GET /api/admin/orders
Query: ?page=1&per_page=20&status=pending
Response 200: { "data": [...orders with user info], "total": N }

PUT /api/admin/orders/:id
Body: { "status": "shipped" }
Response 200: { "data": { updated order } }

GET /api/admin/analytics
Response 200:
{
  "data": {
    "total_users": 42,
    "total_orders": 158,
    "total_revenue": 4920.50,
    "orders_by_status": { "pending": 10, "processing": 5, "shipped": 80, ... },
    "orders_per_day": [{ "date": "2026-03-01", "count": 12, "revenue": 340.00 }, ...],
    "top_toys": [{ "toy_id": 123, "toy_name": "...", "total_sold": 45 }, ...]
  }
}
Note: orders_per_day covers last 30 days.
      top_toys is top 10 by quantity sold.
```

---

## SECTION 6 — Docker Configuration (Complete)

### `.env.example`

```env
# Database
DB_USER=toystore_user
DB_PASSWORD=changeme_in_production
DB_NAME=toystore

# Redis
REDIS_PASSWORD=changeme_redis

# JWT
JWT_SECRET=change_this_to_a_random_64_char_string
JWT_ACCESS_TTL=15m
JWT_REFRESH_TTL=168h

# External API
EXTERNAL_API_URL=https://toy.pequla.com/api

# App
ENVIRONMENT=development
LOG_LEVEL=debug
```

### `docker-compose.yml`

```yaml
version: "3.9"

services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${DB_NAME}
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./database/seed.sql:/docker-entrypoint-initdb.d/seed.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER} -d ${DB_NAME}"]
      interval: 5s
      timeout: 5s
      retries: 10

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --requirepass ${REDIS_PASSWORD}
    healthcheck:
      test: ["CMD", "redis-cli", "--pass", "${REDIS_PASSWORD}", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      DB_URL: postgres://${DB_USER}:${DB_PASSWORD}@db:5432/${DB_NAME}?sslmode=disable
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379/0
      JWT_SECRET: ${JWT_SECRET}
      JWT_ACCESS_TTL: ${JWT_ACCESS_TTL}
      JWT_REFRESH_TTL: ${JWT_REFRESH_TTL}
      EXTERNAL_API_URL: ${EXTERNAL_API_URL}
      ENVIRONMENT: ${ENVIRONMENT}
      LOG_LEVEL: ${LOG_LEVEL}
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:8080/health"]
      interval: 10s
      timeout: 5s
      retries: 5

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    restart: unless-stopped
    environment:
      NEXT_PUBLIC_API_URL: /api
    depends_on:
      backend:
        condition: service_healthy

  nginx:
    build:
      context: ./nginx
      dockerfile: Dockerfile
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - frontend
      - backend

volumes:
  pgdata:
```

### `nginx/nginx.conf`

```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Rate limiting zones
    limit_req_zone $binary_remote_addr zone=auth_limit:10m rate=10r/m;
    limit_req_zone $binary_remote_addr zone=api_limit:10m  rate=60r/m;

    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" "$http_user_agent"';

    upstream backend {
        server backend:8080;
    }

    upstream frontend {
        server frontend:3000;
    }

    server {
        listen 80;
        server_name localhost;
        client_max_body_size 10M;

        # API proxy with rate limiting
        location /api/auth/ {
            limit_req zone=auth_limit burst=5 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        location /api/ {
            limit_req zone=api_limit burst=20 nodelay;
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        # Frontend proxy
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }
    }
}
```

### `nginx/Dockerfile`

```dockerfile
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/nginx.conf
EXPOSE 80
```

### `backend/Dockerfile`

```dockerfile
FROM golang:1.23-alpine AS builder
RUN apk add --no-cache git ca-certificates
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server ./main.go

FROM alpine:3.20
RUN apk add --no-cache ca-certificates wget
WORKDIR /app
COPY --from=builder /app/server .
COPY --from=builder /app/migrations ./migrations
EXPOSE 8080
CMD ["./server"]
```

### `frontend/Dockerfile`

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## SECTION 7 — Implementation Phases

---

### PHASE 1 — Project Scaffold

**Goal:** Everything compiles, containers start, health check returns 200.

**Tasks:**

Backend:

1. `go mod init github.com/yourname/toystore`
2. Add all dependencies to `go.mod`:
   - `github.com/gin-gonic/gin`
   - `github.com/golang-jwt/jwt/v5`
   - `golang.org/x/crypto`
   - `github.com/go-playground/validator/v10`
   - `github.com/rs/zerolog`
   - `github.com/jackc/pgx/v5`
   - `github.com/golang-migrate/migrate/v4`
   - `github.com/redis/go-redis/v9`
   - `github.com/ulule/limiter/v3`
3. Create `config/config.go` — load all env vars, fail fast if required vars are missing
4. Create `internal/database/postgres.go` — connect and ping
5. Create `internal/cache/redis.go` — connect and ping
6. Create `main.go` — initialize all dependencies, run migrations, register a `GET /health` route
7. Write all 4 migration `.up.sql` files from Section 4
8. Write `database/seed.sql` — insert one admin user with email `admin@toystore.com`, password `admin123` (bcrypt hashed), and one regular user

Frontend:

1. `npx create-next-app@latest frontend --typescript --tailwind --app`
2. Install: `axios`, `zod`, `zustand`, `@tanstack/react-query`
3. Create `src/lib/api.ts` — base axios instance pointing to `NEXT_PUBLIC_API_URL`
4. Create root layout with placeholder Navbar and Footer
5. Create home `page.tsx` with just a heading "Toy Store — Coming Soon"

Infrastructure:

1. Write all four `Dockerfile`s
2. Write `docker-compose.yml`
3. Write `nginx/nginx.conf`
4. Write `.env.example` and `.gitignore`

**Acceptance criteria:**

- `docker-compose up --build` starts without errors
- `curl http://localhost/api/health` returns `{"status":"ok"}`
- Frontend loads at `http://localhost` with placeholder content
- All database tables are created after startup

---

### PHASE 2 — Authentication

**Goal:** Users can register, log in, and receive JWT tokens. Protected routes reject unauthenticated requests.

**Tasks:**

Backend:

1. Implement `internal/auth/jwt.go`:
   - `GenerateAccessToken(userID, role string) (string, error)`
   - `GenerateRefreshToken(userID string) (string, error)`
   - `ValidateToken(tokenString string) (*Claims, error)`
2. Implement `internal/auth/middleware.go`:
   - `RequireAuth` — extracts and validates Bearer token, sets `userID` and `role` in Gin context
   - `RequireAdmin` — checks `role == "admin"` after RequireAuth
3. Implement `internal/repository/user_repo.go`:
   - `Create(ctx, user) error`
   - `FindByEmail(ctx, email) (*User, error)`
   - `FindByID(ctx, id) (*User, error)`
   - `Update(ctx, id, fields) error`
4. Implement `internal/services/auth_service.go`:
   - `Register(ctx, req RegisterRequest) (*User, error)` — validate unique email/username, hash password, insert
   - `Login(ctx, req LoginRequest) (*LoginResponse, error)` — verify credentials, generate token pair, store refresh token in Redis
   - `Logout(ctx, refreshToken string) error` — delete refresh token from Redis
   - `RefreshTokens(ctx, refreshToken string) (*TokenPair, error)` — validate Redis entry, issue new pair
5. Implement `internal/handlers/auth_handler.go` with the 4 auth routes
6. Apply `RequireAuth` middleware to all non-public route groups
7. Apply rate limiter (10 req/min per IP) to `POST /api/auth/login` and `POST /api/auth/register`

Frontend:

1. Create `src/lib/auth.ts` — save/load/clear tokens in localStorage, parse JWT claims
2. Create `src/hooks/useAuth.ts` — provides current user, isLoggedIn, login(), logout()
3. Add axios interceptor in `api.ts` — attach `Authorization: Bearer` header to all requests
4. Create `/register/page.tsx` — form with username, email, password, confirm password; zod validation; calls POST /api/auth/register
5. Create `/login/page.tsx` — form with email, password; calls POST /api/auth/login; stores tokens; redirects to `/toys`
6. Create `src/middleware.ts` — protect all routes under `/profile`, `/cart`, `/checkout`, `/wishlist`, `/admin`
7. Update Navbar to show login/register or username/logout based on auth state

**Acceptance criteria:**

- Can register a new user via the form
- Can log in and receive tokens (check browser localStorage)
- Visiting `/profile` without login redirects to `/login`
- Admin endpoint returns 403 when called with a regular user token

---

### PHASE 3 — Toy Catalog

**Goal:** Toy listing and detail pages work, pulling from the external API with Redis caching.

**Tasks:**

Backend:

1. Implement `internal/services/toy_service.go`:
   - `GetAll(ctx) ([]Toy, error)` — fetch from Redis cache first ("toys:all"), then external API, store result in Redis with 5-min TTL
   - `GetByID(ctx, id int) (*Toy, error)` — check Redis ("toy:<id>"), then external API
   - `GetByPermalink(ctx, slug string) (*Toy, error)`
   - `GetAgeGroups(ctx) ([]AgeGroup, error)` — cached 30 min
   - `GetTypes(ctx) ([]ToyType, error)` — cached 30 min
   - `FilterToys(toys []Toy, ageGroup, toyType, query string) []Toy` — pure function, no IO
2. Implement `internal/handlers/toy_handler.go` with the 5 toy routes from Section 5.3
3. Write a thin HTTP client wrapper for the external API calls

Frontend:

1. Create `src/app/toys/page.tsx`:
   - Fetch `/api/toys`, `/api/toys/age-groups`, `/api/toys/types` on page load
   - Render a filter sidebar (age group dropdown, type dropdown, search input)
   - Render toy grid using `ToyCard` component
   - Implement client-side filtering by passing query params to API
   - Implement simple pagination (next/prev buttons)
2. Create `src/components/toys/ToyCard.tsx`:
   - Shows toy image, name, type, age group, price
   - "Add to Cart" button (disabled if not logged in with tooltip)
   - Wishlist heart button
   - Links to `/toys/[id]`
3. Create `src/app/toys/[id]/page.tsx`:
   - Show full toy detail: large image, description, price, type, age group
   - Quantity selector
   - "Add to Cart" and "Add to Wishlist" buttons
4. Create `src/components/toys/ToyFilters.tsx` and `ToySearch.tsx`

**Acceptance criteria:**

- Toy catalog loads with real data from the external API
- Filtering by age group and type works
- Search works (client-side text match on toy name/description)
- Toy detail page shows correct data
- Second request for same toy data hits Redis, not the external API (verify with backend logs)

---

### PHASE 4 — Cart & Wishlist

**Goal:** Logged-in users can add toys to cart and wishlist, with persistent DB storage.

**Tasks:**

Backend:

1. Implement `internal/repository/cart_repo.go`:
   - `GetByUserID(ctx, userID) ([]CartItem, error)`
   - `Upsert(ctx, item CartItem) error` — insert or increment quantity (use ON CONFLICT)
   - `UpdateQuantity(ctx, itemID, userID, quantity int) error`
   - `Delete(ctx, itemID, userID) error`
   - `ClearByUserID(ctx, userID) error`
2. Implement `internal/services/cart_service.go`:
   - Before adding: fetch toy from toy_service to snapshot name/image/price
   - Calculate subtotal in GetCart
3. Implement `internal/handlers/cart_handler.go`
4. Repeat for wishlist (simpler — just add/remove toy IDs, no quantity)

Frontend:

1. Create `src/store/cartStore.ts` with Zustand:
   - State: items[], isLoading
   - Actions: fetchCart(), addItem(), updateQuantity(), removeItem(), clearCart()
   - Syncs with backend on every mutation
2. Create `src/app/cart/page.tsx`:
   - List all cart items with toy image, name, price, quantity controls
   - Subtotal calculation
   - "Proceed to Checkout" button
   - "Remove" per item
3. Add cart item count badge to Navbar
4. Create `src/hooks/useCart.ts` that wraps cartStore
5. Create `src/app/wishlist/page.tsx` — grid of wished toys with "Add to Cart" and "Remove" buttons
6. Create `src/hooks/useWishlist.ts`
7. Wire up wishlist heart button on `ToyCard`

**Acceptance criteria:**

- Can add a toy to cart from detail page
- Cart shows correct items and subtotal
- Updating quantity and removing items works
- Cart persists after page refresh (fetched from DB on load)
- Wishlist add/remove works

---

### PHASE 5 — Checkout & Orders

**Goal:** Users can complete a simulated purchase, which creates a real order in the DB.

**Tasks:**

Backend:

1. Implement `internal/services/payment_service.go`:
   - `Simulate(ctx) PaymentResult` — always returns `{Success: true, TransactionID: "FAKE-TXN-" + randomID}`
   - Log a structured message: `"mock payment processed"` with amount
2. Implement `internal/repository/order_repo.go`:
   - `Create(ctx, order, items) error` — transaction: insert order + all items atomically
   - `GetByUserID(ctx, userID, page, perPage) ([]Order, int, error)`
   - `GetByID(ctx, id, userID) (*OrderWithItems, error)` — userID=nil for admin use
   - `GetAll(ctx, page, perPage, status) ([]Order, int, error)` — admin only
   - `UpdateStatus(ctx, id, status) error`
3. Implement `internal/services/order_service.go` — orchestrates checkout flow
4. Implement `internal/handlers/order_handler.go`
5. Implement `internal/handlers/user_handler.go` — profile get/update, order history

Frontend:

1. Create `src/app/checkout/page.tsx`:
   - Show order summary (items, quantities, prices, total)
   - Shipping address textarea (pre-filled from profile if available)
   - "Confirm & Pay" button
   - Show loading spinner while processing
   - On success: redirect to `/checkout/success`
2. Create `src/app/checkout/success/page.tsx`:
   - Show order ID and confirmation message
   - "View Order" and "Continue Shopping" links
3. Create `src/app/profile/page.tsx`:
   - Display username, email, address
   - Edit form (username, address) with save button
   - Change password form (current + new + confirm)
4. Create `src/app/profile/orders/page.tsx` — list with status badges
5. Create `src/app/profile/orders/[id]/page.tsx` — full order detail with items

**Acceptance criteria:**

- Checkout flow completes without error
- Order appears in database after checkout
- Cart is cleared after successful order
- Order history shows the new order with correct items and total
- Profile edit saves changes

---

### PHASE 6 — Admin Dashboard

**Goal:** Admin users have a protected dashboard with user/order management and analytics.

**Tasks:**

Backend:

1. Implement `internal/services/admin_service.go`:
   - `GetAnalytics(ctx) (*Analytics, error)`:
     - total users: `SELECT COUNT(*) FROM users`
     - total orders: `SELECT COUNT(*) FROM orders`
     - total revenue: `SELECT SUM(total_amount) FROM orders WHERE payment_status='paid'`
     - orders_by_status: `SELECT status, COUNT(*) FROM orders GROUP BY status`
     - orders_per_day (last 30 days): `SELECT DATE(created_at), COUNT(*), SUM(total_amount) FROM orders WHERE created_at > NOW()-INTERVAL '30 days' GROUP BY DATE(created_at)`
     - top_toys: `SELECT toy_id, toy_name, SUM(quantity) as total_sold FROM order_items GROUP BY toy_id, toy_name ORDER BY total_sold DESC LIMIT 10`
2. Implement `internal/handlers/admin_handler.go` with all admin routes from Section 5.7
3. Apply `RequireAdmin` middleware to all `/api/admin/*` routes

Frontend:

1. Create `src/app/admin/layout.tsx` — admin layout with sidebar navigation
2. Create `src/app/admin/page.tsx` — dashboard with 4 metric cards (users, orders, revenue, orders today)
3. Create `src/app/admin/analytics/page.tsx`:
   - 4 metric summary cards
   - Line/bar chart: orders per day (last 30 days) using `recharts`
   - Table: top 10 toys by sales
   - Donut/pie chart: orders by status
4. Create `src/app/admin/users/page.tsx`:
   - Searchable, paginated table: username, email, role, status, joined date
   - Per-row actions: "Disable" / "Enable", "Make Admin"
5. Create `src/app/admin/orders/page.tsx`:
   - Filterable table by status
   - Per-row status dropdown: change to processing / shipped / delivered / cancelled
6. Admin route protection: `middleware.ts` redirects non-admin users to `/`

**Acceptance criteria:**

- Admin user can access dashboard at `/admin`
- Regular user is redirected away from `/admin`
- Analytics page shows correct totals
- Can disable a user and their subsequent login returns 403
- Can update an order status

---

### PHASE 7 — Caching, Rate Limiting, Logging, Validation

**Goal:** All bonus improvements are wired in and verified.

**Tasks:**

Backend:

1. **Redis caching** — verify all toy endpoints use Redis (check logs show cache hits after first request)
2. **Rate limiting** — verify `POST /api/auth/login` returns 429 after 10 requests/minute
3. **Structured logging with zerolog** — every request logged with: method, path, status, duration, userID (if authenticated)
4. **Input validation** — every request struct uses `validate` tags, handlers return 400 with field-level error detail if validation fails
5. **Database migrations** — verify `golang-migrate` runs all migrations on startup; add a simple `migrate --version` health check

Frontend:

1. **Zod validation** — every form (login, register, profile edit, checkout) has a zod schema; field errors shown inline
2. **Error boundaries** — wrap page components in React error boundaries
3. **Loading states** — every API call shows a loading spinner or skeleton
4. **404 page** — create `src/app/not-found.tsx`

**Acceptance criteria:**

- Second toy catalog load is ~10x faster than first (Redis hit)
- Rapid login attempts are blocked with 429
- Structured JSON logs appear in `docker-compose logs backend`
- Submitting an empty form shows field-level errors

---

### PHASE 8 — Final Polish & Documentation

**Goal:** The project is ready to hand in. Clean, documented, runs on any machine.

**Tasks:**

1. Write `README.md` (required content):
   - Project description
   - Prerequisites: Docker Desktop
   - Setup: `cp .env.example .env` then `docker-compose up --build`
   - Test credentials: `admin@toystore.com` / `admin123` and `user@toystore.com` / `user123`
   - Architecture overview (one paragraph)
   - API base URL and example curl commands for 3 endpoints
   - Known limitations / scope (university project, simulated payments)

2. Code cleanup:
   - Remove all TODO comments
   - Remove all `console.log` from frontend
   - Run `go vet ./...` and fix all warnings
   - Run `npx tsc --noEmit` in frontend and fix all type errors
   - Ensure `.env.example` has all required variables with safe placeholder values

3. Seed data quality:
   - Admin user: `admin@toystore.com` / `admin123`
   - Regular user: `user@toystore.com` / `user123`
   - 3 pre-created orders for the regular user (so order history is not empty)

4. Error pages:
   - `500` server error page
   - `403` forbidden page
   - `404` not found page

5. Final test: fresh clone → `cp .env.example .env` → `docker-compose up --build` → browse full app

**Acceptance criteria:**

- App works on a fresh machine with no prior setup
- Admin login works with seed credentials
- All pages render without console errors
- `docker-compose down -v && docker-compose up --build` works (data reset test)

---

## SECTION 8 — AI Agent Instructions for Each Phase

> Read this before starting any phase. These instructions are specifically for Kimi 2.5, MiniMax 2.5, and GLM-5.

### How you should work

**Before starting any task:**

1. State which phase you are working on.
2. State the specific task number you are starting.
3. If you are unclear about anything, ask ONE specific clarifying question before writing any code. Do not guess.

**When writing code:**

- Write complete files. Do not show partial snippets unless explicitly asked.
- After writing a file, state: "File written: `path/to/file.go`"
- If a file is longer than 400 lines, split it and explain how.

**When you finish a phase:**

- List all files created/modified.
- List any dependencies added to `go.mod` or `package.json`.
- State: "Phase X complete. Ready for code review."
- Do NOT start the next phase until the human confirms.

**What you must never do:**

- Do not invent API endpoints that are not in Section 5.
- Do not change the database schema from Section 4.
- Do not add dependencies that are not listed in the rules or explicitly approved.
- Do not write frontend code that calls `toy.pequla.com` directly.
- Do not hardcode any credentials, passwords, or secrets.
- Do not skip error handling to save space.

### Context to keep in memory

Always remember:

- Backend listens on port `8080`
- Frontend listens on port `3000`
- Nginx listens on port `80` and is the only public-facing port
- PostgreSQL is at host `db`, port `5432` inside Docker network
- Redis is at host `redis`, port `6379` inside Docker network
- External toy API base: `https://toy.pequla.com/api`
- All routes are prefixed with `/api` for the backend (Nginx strips nothing)
- JWT access tokens expire in 15 minutes; refresh tokens in 7 days

### Dependency lookup note

If you are uncertain about a Go package API or a Next.js 14 App Router pattern, state your uncertainty and the reviewer (Claude Opus/Sonnet) will clarify. Do not guess at API signatures — getting them wrong wastes more time than asking.

---

## SECTION 9 — Code Review Checklist (for Claude Opus/Sonnet)

Use this checklist when reviewing each phase submission.

### Security

- [ ] Passwords hashed with bcrypt, cost >= 12
- [ ] JWT secret loaded from env, not hardcoded
- [ ] All SQL queries use parameterized statements
- [ ] Auth middleware applied to all protected routes
- [ ] Admin middleware applied to all admin routes
- [ ] Input validation on all request bodies
- [ ] No sensitive data in logs (passwords, full tokens)
- [ ] Rate limiting on auth endpoints

### Correctness

- [ ] Database transactions used where multiple writes must be atomic (checkout)
- [ ] Cart cleared after successful order
- [ ] Toy data snapshotted in order_items (not just toy_id)
- [ ] Redis TTL set on all cached values
- [ ] JWT refresh token invalidated on logout
- [ ] Errors returned from services, HTTP status set only in handlers

### Code quality

- [ ] Handler → Service → Repository layering respected
- [ ] No business logic in handlers
- [ ] Exported functions have comments
- [ ] No file exceeds 400 lines
- [ ] Frontend has no `console.log`
- [ ] All TypeScript types are explicit (no `any`)
- [ ] Zod validation on all forms

### Docker

- [ ] Multi-stage builds for both frontend and backend
- [ ] All services have healthchecks
- [ ] No secrets in Dockerfiles
- [ ] `docker-compose up --build` works from scratch

---

_End of Master Plan — Version 1.0_
_Generated: March 2026_
_Project: University Toy Store_
