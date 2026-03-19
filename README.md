# 🧸 Toy Store

> **Language** · [English](./README.md) · [Srpski (Serbian)](./README.sr.md)

A full-stack Serbian e-commerce web application for selling toys, built with a Go backend API, Next.js 14 frontend, PostgreSQL database, and Redis cache — all orchestrated through Docker Compose and served behind an Nginx reverse proxy.

---

## 📋 System Overview

Toy Store is an e-commerce platform that lets users browse a toy catalog, add items to a cart or wishlist, and complete purchases. Registered users can view their full order history and request cancellations of active orders. Administrators have a dedicated panel with an overview of all orders, users, analytics, and the ability to approve or decline cancellation requests.

An important architectural decision concerns toy data: the application **does not store toys in its own database**. The catalog is fetched from an external API (`toy.pequla.com/api`) and cached in Redis. The frontend never calls the external API directly — all requests go through the Go backend, which is the single integration point with the external system. This enables centralized error handling, caching, and security.

Payments are implemented using Stripe test mode — no money is charged and all transactions are simulated. When a Stripe key is configured in `.env` and starts with `sk_`, the system uses the real Stripe PaymentIntent flow with client-side confirmation. When no key is set, the system automatically falls back to mock mode and creates an order immediately without Stripe integration. The entire system starts with a single command (`docker-compose up --build`) and is available at `http://localhost`.

---

## 📸 Screenshots

<table>
  <tr>
    <th>Home Page</th>
    <th>Katalog igračaka</th>
    <th>Admin Dashboard</th>
  </tr>
  <tr>
    <td>
      <img width="100%" alt="Home Page" src="https://github.com/user-attachments/assets/fb8f43a6-8e1e-4451-b503-f6769a772e0e" />
    </td>
    <td>
      <img width="100%" alt="Katalog igračaka" src="https://github.com/user-attachments/assets/8db81cc0-e15b-417c-98cc-5524aa66ca93" />
    </td>
    <td>
      <img width="100%" alt="Admin Dashboard" src="https://github.com/user-attachments/assets/8f8e4292-6c02-47d0-ac8b-dc77c36b36fd" />
    </td>
  </tr>
</table>

---

## 📸 Screenshots

| Home Page | Toy Catalog | Admin Dashboard |
|-----------|-------------|-----------------|
| _screenshot_ | _screenshot_ | _screenshot_ |

> Run the application and add your own screenshots.

---

## 🏗️ System Architecture

### Architecture Diagram

```
Browser / Client
       │
       ▼
   Nginx (port 80)
   ├── Rate limiting
   │   ├── auth_limit: 10 req/min, burst=5  (zone: 10MB, by IP address)
   │   └── api_limit:  200 req/min, burst=50 (zone: 10MB, by IP address)
   │
   ├── location = /health        → Backend (exact match, no rate limit)
   ├── location /api/health      → rewrite → /health (internal rewrite)
   ├── location /api/auth/       → Backend (auth_limit — strict limit)
   ├── location /api/            → Backend (api_limit — general limit)
   └── location /                → Frontend (Next.js, WebSocket upgrade)
        │
   ┌────┴────────────────────────────────────────┐
   │                                             │
   ▼                                             ▼
Backend (Go/Gin)                         Frontend (Next.js 14)
port 8080                                port 3000
   │
   ├── PostgreSQL (port 5432)
   │   ├── users
   │   ├── orders + order_items
   │   ├── cart_items
   │   └── wishlist_items
   │
   ├── Redis (port 6379)
   │   ├── JWT refresh tokens (TTL: 168h)
   │   ├── toys:all (TTL: 5 min)
   │   ├── toy:<id> (TTL: 5 min)
   │   ├── toys:filtered:<ag>:<type>:<q> (TTL: 5 min)
   │   ├── age-groups (TTL: 30 min)
   │   └── toy-types  (TTL: 30 min)
   │
   └── toy.pequla.com (external API)
       GET /api/toy
       GET /api/toy/:id
       GET /api/toy/permalink/:slug
       GET /api/age-group
       GET /api/type
```

### Component Breakdown

#### Nginx (Reverse Proxy)

Nginx stands in front of the entire system as the single public entry point. This gives several advantages: users never communicate directly with the Go process or Next.js server, all traffic passes through one point that can filter, log, and rate-limit requests.

Rate limiting is configured at two levels. For auth routes (`/api/auth/`) a stricter limit of 10 requests per minute with `burst=5` is applied — this directly prevents brute-force attacks on the login endpoint. A burst of 5 allows a user to quickly retry a few times on a wrong password, but blocks automated attacks. For all other API routes a more liberal limit of 200 requests per minute with `burst=50` applies, which is more than enough for legitimate users.

`location = /health` uses exact match (`=`) because of Nginx location evaluation order: Nginx checks locations from most specific to most general, so the health check route is never caught by the general `/api/` block with its rate limit. This is important because Docker Compose sends a health check every 10 seconds.

Rate limiting is applied at the Nginx level, **before a request ever reaches the Go process** — an attacker generating thousands of requests only consumes Nginx resources, and the Go backend receives only legitimate traffic.

The Stripe webhook endpoint (`/api/webhook/stripe`) has no special rate limit — intentionally. Stripe guarantees reliable webhook delivery and the server must be able to accept them without throttling, because every missed webhook means missed payment status information.

#### Backend (Go + Gin)

We use Go 1.23 with the Gin HTTP framework. We chose Go for static typing that eliminates an entire class of runtime errors, a compiled binary with no runtime dependencies, and excellent support for concurrent programming. Gin adds routing, middleware chaining, and JSON binding with minimal overhead.

The backend is organized using a strict three-layer architecture:

```
HTTP request → Handler → Service → Repository → Database
```

The **Handler** layer (`internal/handlers/`) is the only one allowed to touch the HTTP context: it reads parameters from the URL, deserializes the JSON body, calls the service, and returns a JSON response with the appropriate HTTP status code. A handler must never contain business logic.

The **Service** layer (`internal/services/`) contains all business logic. Functions return `error` values, never HTTP statuses — that decision belongs to the handler. A service may call multiple repositories and coordinate between them.

The **Repository** layer (`internal/repository/`) contains only SQL queries. It knows nothing about HTTP or business rules — it only executes queries and maps results to models.

This separation is not formalism — it directly improves testability (each layer can be tested in isolation with mocked dependencies), maintainability (changing the database requires changes only in the repository layer), and code readability.

Database migrations run automatically at every backend startup using `golang-migrate`. Migrations are numbered SQL files (`000001_create_users.up.sql`, `000002_create_orders.up.sql`, etc.) that execute strictly in order and never twice. Migration state is stored in the `schema_migrations` table in PostgreSQL. This guarantees the database is always in a consistent, known state without manual intervention.

Structured logging is implemented through `zerolog` which writes JSON lines to stdout — every log event is machine-readable with structured fields like `user_id`, `latency`, `status`, and `path`. This makes logs searchable and analyzable in production with tools like Loki or Elasticsearch.

#### Frontend (Next.js 14 App Router)

We use Next.js 14 with the App Router for several reasons. Server-side rendering improves SEO because search engines receive fully rendered HTML, not an empty `<div id="root">` page. File-based routing reduces configuration. React Server Components enable data fetching on the server — the home page fetches the toy catalog directly from the backend within the Docker network (`http://backend:8080`) without that request going through the user's browser, eliminating waterfalls and reducing latency.

Client Components (`'use client'`) are used only where necessary — for interactive elements such as the cart, login form, and wishlist. The rest of the application are Server Components rendered on the server and sent as finished HTML.

The Axios interceptor (`lib/api.ts`) automatically adds the JWT access token to every request from the browser. Tokens are stored in **localStorage** for access from the Axios interceptor, and simultaneously written to **cookies** for access from the Next.js middleware. Both stores are synchronized on every auth state change.

When a token expires and the backend returns 401, the interceptor transparently calls the refresh endpoint, gets a new token pair, and retries the original request — the user doesn't notice. Key security detail: the interceptor **does not redirect to `/login`** if the user is not logged in (has no refresh token) — it simply rejects the request. Redirect to login only happens when the user was logged in but their session expired.

In addition to the Axios interceptor, the system uses a **CustomEvent** (`auth-state-change`) to synchronize auth state between components and browser tabs — `AuthProvider` dispatches the event on login/logout/refresh, and all components listening for it refresh their local state.

Zustand is used for client-side cart and wishlist state management. We chose it for its minimal API without the boilerplate typical of Redux — an entire store is defined in a single function.

Dark and light mode are implemented through the `next-themes` library. `ThemeProvider` (`src/components/providers/ThemeProvider.tsx`) is used with `attribute="class"` which adds or removes `class="dark"` on the `<html>` element. Tailwind's `darkMode: ["class"]` mode automatically applies all `dark:` variants of classes. By default, the application follows the user's system preference (`prefers-color-scheme`).

**Tailwind CSS custom properties** are used for all colors in the application — never hardcoded `bg-white`, `bg-gray-50`, `text-gray-700` and similar. CSS variables in `globals.css` define semantic tokens (`--background`, `--foreground`, `--card`, `--muted`, `--border`, `--input`, `--primary`, `--destructive`, etc.) used as Tailwind classes (`bg-background`, `text-foreground`, `border-border`). Brand colors (`--brand-primary`, `--brand-sage`) are defined in `tailwind.config.js`. This approach guarantees consistent appearance in light and dark mode without dual styling.

#### PostgreSQL

We chose PostgreSQL 16 for its ACID guarantees — every transaction is atomic, consistent, isolated, and durable. This is critical for order operations where an order is created, line items are inserted, and the cart is deleted all in a single transaction.

Primary keys are UUIDs instead of sequential integers. The reason is security: sequential IDs (`/orders/1`, `/orders/2`) allow an attacker to enumerate all orders by trying all IDs. A UUID of the format `a1b2c3d4-e5f6-7890-abcd-ef1234567890` is unpredictable and cannot be guessed without database access.

The `order_items` table stores `toy_name` and `price_at_purchase` as a snapshot at the time of purchase. This is an architectural decision directly tied to the use of an external API we don't control: prices may change, toys may be removed from the catalog. Without a snapshot, order history would be inconsistent — it would show current prices instead of what the user actually paid, or would break for toys that no longer exist in the external system.

#### Redis

Redis has two completely separate roles in the system. The first is storing JWT refresh tokens: the backend writes the refresh token to Redis on login and deletes it on logout or refresh. This solves the fundamental problem of JWT authentication — JWT tokens are inherently non-revocable until they expire. With Redis, logout actually works because the backend checks for the presence of the refresh token in Redis on every refresh request. Without Redis, a user could continue using a stolen access token after logout until it expires (15 minutes).

The second role is caching the toy catalog. Whenever a request for toys comes in, the service first checks Redis. On a cache hit, data is returned immediately without an HTTP call to the external API. On a cache miss, data is fetched from `toy.pequla.com`, written to Redis with a TTL, and returned to the user. TTL is 5 minutes for the catalog and individual toys, 30 minutes for categories and types that rarely change.

If Redis is unavailable, `redis.Set()` returns an error that is logged as a warning (`log.Warn()`), but the request continues normally — the system degrades gracefully to direct API calls without caching.

#### External API (toy.pequla.com)

The application does not own toy data — the entire catalog comes from `https://toy.pequla.com/api`. The backend is the only one that calls this API, for three reasons. Security: a frontend that directly calls an external API would expose that dependency to users. Caching: by centralizing calls in the backend, the Redis cache benefits all users, not just one. Error handling: all external API errors are caught and transformed in one place into consistent error messages that the user sees.

`ToyService` has an `httpClient` with a 10-second timeout — if the external API doesn't respond, the request doesn't block a goroutine forever.

---

## 🗄️ Database Schema

### Table `users`

Stores all registered users of the system.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `UUID` PRIMARY KEY | Auto-generated UUID (`uuid_generate_v4()`) |
| `username` | `VARCHAR(50)` NOT NULL UNIQUE | Username, unique in the system |
| `email` | `VARCHAR(255)` NOT NULL UNIQUE | Email address, used for login |
| `password_hash` | `VARCHAR(255)` NOT NULL | bcrypt hash of password (cost 12) — never plaintext |
| `role` | `VARCHAR(20)` NOT NULL DEFAULT `'user'` | `'user'` or `'admin'`, CHECK constraint |
| `avatar_url` | `TEXT` nullable | Profile picture URL |
| `address` | `TEXT` nullable | Shipping address |
| `is_active` | `BOOLEAN` NOT NULL DEFAULT `true` | Disabled accounts cannot log in |
| `created_at` | `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()` | Registration time |
| `updated_at` | `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()` | Last modification time |

Indices: `idx_users_email`, `idx_users_username` — speed up lookups during login and uniqueness checks.

### Table `orders`

Every completed purchase generates one row in this table.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `UUID` PRIMARY KEY | Auto-generated UUID |
| `user_id` | `UUID` NOT NULL | FK → `users(id)` ON DELETE CASCADE |
| `status` | `VARCHAR(30)` NOT NULL DEFAULT `'pending'` | `pending`, `processing`, `shipped`, `delivered`, `cancelled` |
| `payment_status` | `VARCHAR(20)` NOT NULL DEFAULT `'pending'` | `pending`, `paid`, `failed`, `refunded` |
| `total_amount` | `NUMERIC(10,2)` NOT NULL | Total amount in RSD (in smallest unit — no decimals, e.g. 4999 = 49.99 RSD) |
| `shipping_address` | `TEXT` NOT NULL | Shipping address at time of purchase |
| `cancellation_requested` | `BOOLEAN` NOT NULL DEFAULT `false` | User requested cancellation |
| `cancellation_reason` | `TEXT` nullable | Reason stated by the user |
| `cancellation_approved` | `BOOLEAN` nullable | `true`/`false` when admin decides, `NULL` while pending |
| `cancellation_response` | `TEXT` nullable | Admin comment with the decision |
| `created_at` | `TIMESTAMPTZ` NOT NULL | Order creation time |
| `updated_at` | `TIMESTAMPTZ` NOT NULL | Last status change |

Indices: `idx_orders_user_id`, `idx_orders_created_at DESC` — speed up order listing by user and sorting by date.

### Table `order_items`

Line items for each order. This is the key table for understanding the snapshot data architecture.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `UUID` PRIMARY KEY | Auto-generated UUID |
| `order_id` | `UUID` NOT NULL | FK → `orders(id)` ON DELETE CASCADE |
| `toy_id` | `INTEGER` NOT NULL | Toy ID from external API (no FK — external system) |
| `toy_name` | `VARCHAR(255)` NOT NULL | **Snapshot** — toy name at time of purchase |
| `toy_image_url` | `TEXT` nullable | **Snapshot** — image URL at time of purchase |
| `price_at_purchase` | `NUMERIC(10,2)` NOT NULL | **Snapshot** — price at time of purchase (in smallest unit) |
| `quantity` | `INTEGER` NOT NULL CHECK `> 0` | Ordered quantity |

Why snapshot? Toys come from an external API we don't control. If the external system changes a toy's price or removes it entirely from the catalog, orders already paid must show the exact data from the time of purchase. `toy_id` is `INTEGER` without an FK constraint because we cannot guarantee referential integrity to an external system.

### Table `cart_items`

Represents the active cart of each user. A cart is not an order — it is deleted on order completion in a DB transaction.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `UUID` PRIMARY KEY | Auto-generated UUID |
| `user_id` | `UUID` NOT NULL | FK → `users(id)` ON DELETE CASCADE |
| `toy_id` | `INTEGER` NOT NULL | Toy ID from external API |
| `toy_name_cache` | `VARCHAR(255)` NOT NULL | Cached name for faster cart display |
| `toy_image_cache` | `TEXT` nullable | Cached image URL |
| `price_cache` | `NUMERIC(10,2)` NOT NULL | Cached price in smallest unit at time of adding |
| `quantity` | `INTEGER` NOT NULL DEFAULT `1` CHECK `> 0` | Quantity in cart |
| `updated_at` | `TIMESTAMPTZ` NOT NULL | Last modification |
| UNIQUE(`user_id`, `toy_id`) | | A user cannot add the same toy twice — only changes quantity |

### Table `wishlist_items`

A simple join table between users and toys they want to save for later browsing.

| Column | Type | Description |
|--------|------|-------------|
| `id` | `UUID` PRIMARY KEY | Auto-generated UUID |
| `user_id` | `UUID` NOT NULL | FK → `users(id)` ON DELETE CASCADE |
| `toy_id` | `INTEGER` NOT NULL | Toy ID from external API |
| `created_at` | `TIMESTAMPTZ` NOT NULL DEFAULT `NOW()` | When added |
| UNIQUE(`user_id`, `toy_id`) | | Each toy can be on a user's wishlist only once |

### Table Relationships

```
users (1) ──────────── (N) orders
users (1) ──────────── (N) cart_items
users (1) ──────────── (N) wishlist_items
orders (1) ─────────── (N) order_items
```

All FK relationships have `ON DELETE CASCADE` — deleting a user automatically deletes all their orders, order items, cart, and wishlist. This prevents orphan records and ensures data consistency without manual cleanup.

---

## 🔐 Authentication and Security

### JWT Strategy — Dual-Token System

We use two tokens: a short-lived access token and a long-lived refresh token. This is the standard pattern balancing security and user experience.

**Access token** lasts 15 minutes (configurable via `JWT_ACCESS_TTL`). Sent in the `Authorization: Bearer <token>` header with every request that requires authentication. Short duration limits damage if a token is stolen — an attacker can use it for only 15 minutes.

**Refresh token** lasts 168 hours / 7 days (configurable via `JWT_REFRESH_TTL`) and is stored in Redis. Used exclusively for renewing the token pair. The user doesn't send it with every request, only when the access token expires.

Token renewal flow:

```
1. User sends request → backend returns 401 (access token expired)
2. Axios interceptor automatically sends POST /api/auth/refresh
   with the refresh token
3. Backend checks Redis: does this refresh token exist?
4. If YES → generates new access + refresh pair, deletes old refresh
   from Redis (rotation), returns new pair
5. If NO → token was revoked (user logged out or token expired),
   returns 401
6. Axios interceptor retries original request with new access token
7. User notices nothing — transparent to UX
```

Without Redis, JWT would be completely non-revocable — it would be impossible to implement logout that actually works, because a stolen access token would remain valid until expiry.

### Password Protection

Passwords are hashed using `bcrypt` with cost factor 12. Cost factor 12 means the algorithm performs 2¹² = 4096 hashing rounds, making one hashing attempt slow (around 200–400ms on modern hardware). An attacker attempting a brute-force attack can test only a few thousand passwords per second — instead of billions possible with MD5 or SHA-256.

bcrypt automatically generates and embeds a random salt in every hash, meaning the same plaintext produces a different hash each time. This eliminates the effectiveness of rainbow table attacks — an attacker cannot precompute a hash table.

The password is never logged, never returned in API responses, and never stored in plaintext — not in the database, not in Redis, not in logs.

### Role-Based Access Control (RBAC)

The system has two access levels: `user` and `admin`. Roles are stored in JWT claims and checked in middleware on every request.

Middleware chain for admin routes:

```
HTTP request
     │
     ▼
RequireAuth()          ← verifies JWT signature and expiry,
     │                    validates token type == "access",
     │                    writes userID and role into Gin context
     ▼
RequireAdmin()         ← reads role from Gin context,
     │                    returns 403 Forbidden if role != "admin"
     ▼
Handler
```

`RequireAdmin` is applied at the **route group level** in `router.go`, not on every individual handler:

```go
adminGroup := r.Group("/api/admin")
adminGroup.Use(authMiddleware.RequireAuth())
adminGroup.Use(authMiddleware.RequireAdmin())
{
    adminGroup.GET("/users", ...)
    adminGroup.GET("/orders", ...)
    // every new endpoint automatically gets both middlewares
}
```

This is security by default — a developer adding a new admin endpoint doesn't need to remember to add protection. It is already applied at the group level.

### Rate Limiting

Rate limiting is implemented at the Nginx level, not in application code. There are two zones:

- `auth_limit` (10 req/min, burst=5, zone 10MB): applied to `/api/auth/`. Designed to stop brute-force attacks on login.
- `api_limit` (200 req/min, burst=50, zone 10MB): applied to other `/api/` routes. Sufficient for legitimate users, but limits automated scrapers and DoS attacks.

Advantage of Nginx-level over application-level: Nginx blocks the request before the Go process allocates a goroutine and parses the request body. An attacker generating 10,000 requests per second only consumes Nginx resources — minimal compared to the Go runtime.

### Input Validation

Validation happens at both layers of the system without exception.

On the **backend**, all request structs have `validate` struct tags evaluated by `go-playground/validator/v10`:

```go
type RegisterRequest struct {
    Username string `json:"username" validate:"required,min=3,max=50"`
    Email    string `json:"email"    validate:"required,email"`
    Password string `json:"password" validate:"required,min=8"`
}
```

On the **frontend**, all forms are validated with a Zod schema before sending an API request. Validation errors are shown inline next to the field with Serbian messages.

All SQL queries use parameterized arguments — never string concatenation. This is absolute protection against SQL injection:

```go
// Correct — parameterized
row := db.QueryRow(ctx,
    "SELECT id, email FROM users WHERE email = $1", email)

// Wrong — never do this
query := "SELECT * FROM users WHERE email = '" + email + "'"
```

---

## 📡 API Documentation

### All Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | ❌ | Register new user |
| `POST` | `/api/auth/login` | ❌ | Login, returns JWT pair |
| `POST` | `/api/auth/logout` | ✅ | Logout, revokes refresh token in Redis |
| `POST` | `/api/auth/refresh` | ❌ | Renew access token with refresh token |
| `GET` | `/api/user/profile` | ✅ | Profile of logged-in user |
| `PUT` | `/api/user/profile` | ✅ | Update username, address, avatar |
| `PUT` | `/api/user/password` | ✅ | Change password (requires old password) |
| `GET` | `/api/user/orders` | ✅ | Paginated order history |
| `GET` | `/api/user/orders/:id` | ✅ | Order details with line items |
| `POST` | `/api/user/orders/:id/cancel` | ✅ | Request order cancellation |
| `GET` | `/api/toys` | ❌ | Toy list (filters: `type`, `age_group`, `q`, `page`, `per_page`) |
| `GET` | `/api/toys/:id` | ❌ | Toy details by numeric ID |
| `GET` | `/api/toys/permalink/:slug` | ❌ | Toy by URL permalink |
| `GET` | `/api/toys/age-groups` | ❌ | List of age groups |
| `GET` | `/api/toys/types` | ❌ | List of toy types |
| `GET` | `/api/cart` | ✅ | User's cart with calculated subtotal |
| `POST` | `/api/cart` | ✅ | Add toy to cart (`toy_id`, `quantity`) |
| `PUT` | `/api/cart/:item_id` | ✅ | Update cart item quantity |
| `DELETE` | `/api/cart/:item_id` | ✅ | Remove cart item |
| `DELETE` | `/api/cart` | ✅ | Clear entire cart |
| `GET` | `/api/wishlist` | ✅ | Wishlist with toy details |
| `POST` | `/api/wishlist` | ✅ | Add toy to wishlist |
| `DELETE` | `/api/wishlist/:toy_id` | ✅ | Remove toy from wishlist |
| `GET` | `/api/wishlist/check/:toy_id` | ✅ | Check if toy is on wishlist |
| `POST` | `/api/checkout` | ✅ | Direct checkout (mock mode) |
| `POST` | `/api/checkout/intent` | ✅ | Create Stripe PaymentIntent, returns `client_secret` |
| `POST` | `/api/checkout/confirm` | ✅ | Confirm Stripe payment and create order |
| `GET` | `/api/checkout/simulate` | ✅ | Simulate payment (test endpoint) |
| `POST` | `/api/webhook/stripe` | ❌* | Stripe webhook for async payment status |
| `GET` | `/api/admin/users` | 👑 | List all users (admin) |
| `GET` | `/api/admin/users/:id` | 👑 | User details (admin) |
| `PUT` | `/api/admin/users/:id` | 👑 | Update user — activate/deactivate (admin) |
| `GET` | `/api/admin/orders` | 👑 | All orders with filters (admin) |
| `PUT` | `/api/admin/orders/:id` | 👑 | Update order status (admin) |
| `GET` | `/api/admin/analytics` | 👑 | Analytics — revenue, orders, users (admin) |
| `GET` | `/api/admin/cancellation-requests` | 👑 | Pending cancellation requests (admin) |
| `PUT` | `/api/admin/cancellation-requests/:id/approve` | 👑 | Approve order cancellation (admin) |
| `PUT` | `/api/admin/cancellation-requests/:id/decline` | 👑 | Decline cancellation request (admin) |
| `GET` | `/health` | ❌ | Health check — Docker healthcheck and monitoring |

**Legend:** ❌ public, ✅ JWT access token required, 👑 admin JWT required
*Stripe webhook has no JWT, but verifies `Stripe-Signature` header using HMAC-SHA256 with the webhook secret

### Request/Response Examples

```bash
# Register a new user
curl -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"petar_nikolic","email":"petar@example.com","password":"sigurna123"}'

# Login
curl -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@toystore.com","password":"user123"}'

# Successful login response
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "username": "user",
      "email": "user@toystore.com",
      "role": "user"
    }
  }
}

# Using access token for protected routes
curl http://localhost/api/user/profile \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Browse toy catalog with filters (public)
curl "http://localhost/api/toys?age_group=3-5&per_page=10&page=1"

# Add toy to cart
curl -X POST http://localhost/api/cart \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{"toy_id": 6, "quantity": 1}'

# Renew access token
curl -X POST http://localhost/api/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'
```

---

## 💳 Payment Flow

Stripe payment is implemented as a two-step process following Stripe best practices for server-side confirmation. Stripe mode detection is done by checking whether `STRIPE_SECRET_KEY` starts with `sk_` — that means it is a valid Stripe key (test: `sk_test_...`, live: `sk_live_...`). Everything else (empty, placeholder) activates mock mode.

```
User clicks "Pay"
        │
        ▼
POST /api/checkout/intent
        │
        ├── STRIPE_SECRET_KEY starts with "sk_"?
        │
       YES ──────────────────────────────────────────────────────┐
        │                                                         │
        │   Backend creates PaymentIntent on Stripe                 │
        │   - Amount = cart total × 100 (Stripe uses smallest currency unit)  │
        │   - Currency: rsd                                        │
        │   Returns: { client_secret, payment_intent_id,         │
        │             total_amount }                               │
        │                                                         │
        │   Frontend receives client_secret                        │
        │   Stripe.js displays secure card form                   │
        │   User enters card (card number never                    │
        │   reaches our server)                                   │
        │                                                         │
        │   stripe.confirmCardPayment(client_secret)              │
        │   (Stripe verifies card directly on Stripe               │
        │    servers — PCI compliant)                            │
        │                                                         │
        │   POST /api/checkout/confirm                            │
        │   { payment_intent_id, shipping_address }               │
        │   Backend calls Stripe API:                            │
        │   - Checks: PI.Status == "succeeded"?                   │
        │   - Yes → creates order in database                     │
        │   - No → returns error                                 │
        │                                                         │
        NO ──────────────────────────────────────────────────────┤
        │                                                         │
        │   Mock mode — creates order immediately                   │
        │   No Stripe calls, always successful                    │
        │                                                         │
        └─────────────────────────────────────────────────────────┘
                              │
                              ▼
              DB transaction (atomic):
              1. INSERT INTO orders (status='processing', payment_status='paid')
              2. INSERT INTO order_items with snapshot data for each line item
              3. DELETE FROM cart_items WHERE user_id = ?
              (all or nothing — if anything fails, rollback)
```

The two-step flow (intent → confirm) is safer than a one-shot approach because the backend never receives a card number. Stripe.js communicates directly with Stripe servers, and our backend only verifies the final result by calling the Stripe API.

> **Note:** This is Stripe test mode. No money is charged and all transactions are simulated.

```
Test card:  4242 4242 4242 4242
Expiry:     any future date (e.g. 12/28)
CVC:        any 3 digits (e.g. 123)
```

---

## ⚡ Caching

We use a **cache-aside** (lazy loading) strategy — the backend manually manages the cache without automatic invalidation.

```
GET /api/toys
       │
       ▼
redis.Get("toys:all")
       │
       ├── HIT  ──────────────────────────────► Return data
       │                                        log: "cache_hit"
       │                                        Latency: ~1ms
       │
       └── MISS
              │
              log: "cache_miss"
              │
              ▼
       GET https://toy.pequla.com/api/toy
       (HTTP timeout: 10 seconds)
              │
              ▼
       redis.Set("toys:all", data, 5*time.Minute)
       (Redis write error = warning, not fatal)
              │
              ▼
       Return data to user
       Latency: ~200–500ms (HTTP round-trip to external API)
```

### Redis Keys and TTLs

| Key | TTL | Content |
|-----|-----|---------|
| `toys:all` | 5 min | Full toy catalog (uncached request) |
| `toy:<id>` | 5 min | Single toy by numeric ID |
| `toy:permalink:<slug>` | 5 min | Single toy by URL slug |
| `toys:filtered:<ag>:<type>:<q>` | 5 min | Filtered search results |
| `age-groups` | 30 min | List of age groups (rarely changes) |
| `toy-types` | 30 min | List of toy types (rarely changes) |

Filtered search caches results separately by filter combination — the same filters from two different users get the same cached response. Metadata has a longer TTL because toy types and age groups don't change often.

Caching benefits are threefold: it reduces calls to the external API protecting against eventual quotas, it gives users faster responses because Redis reads (~1ms) are multiple times faster than HTTP calls (200–500ms), and if the external API temporarily goes down, the last cached data remains available to users until the TTL expires.

---

## 🚀 Running the Project

### Prerequisites

- **Docker Desktop** — the only requirement. Go, Node.js, PostgreSQL, and Redis are all inside containers.

### Installation and Startup

```bash
# 1. Clone the repository
git clone git@github.com:bok1c4/toy_store.git
cd toy_store

# 2. Configure environment
cp .env.example .env

# 3. Generate secure values and fill in .env
#    JWT_SECRET:
openssl rand -hex 32
#    DB_PASSWORD and REDIS_PASSWORD:
openssl rand -hex 24

# 4. Stripe keys (optional)
#    Without Stripe keys the system runs in mock mode
#    With Stripe keys: https://dashboard.stripe.com/test/apikeys

# 5. Start all services
docker-compose up --build

# Application is available at http://localhost
```

### What Happens at Startup

1. Docker Compose starts the PostgreSQL container and waits for its health check (`pg_isready -U toystore_user -d toystore`) — the backend won't start until the database is fully ready
2. Docker Compose starts the Redis container protected with a password and waits for its health check (`redis-cli --pass $REDIS_PASSWORD ping`)
3. Backend container starts — automatically runs all SQL migrations in order (`000001` to `000006`) using `golang-migrate`
4. Migration `000006_seed_data.up.sql` seeds test users, orders, cart, and wishlist data
5. Backend health check on `GET /health` starts returning `{"status":"ok"}`; Frontend container starts only then (`depends_on: backend: condition: service_healthy`)
6. Next.js build runs inside the container (TypeScript compilation, optimization), Next.js server starts on port 3000
7. Nginx container starts last — the only public entry point on port 80, routing traffic to backend and frontend

To stop:

```bash
docker-compose down        # Stops containers, preserves data
docker-compose down -v     # Stops + deletes volumes (data reset)
```

### Test Accounts

| Role | Email | Password | Notes |
|------|-------|---------|-------|
| Admin | `admin@toystore.com` | `admin123` | Access to `/admin` panel |
| User | `user@toystore.com` | `user123` | 5 orders, 3 items in cart, 4 in wishlist |

Seed data for the test user includes: 3 delivered orders, 1 order in delivery, and 1 order in processing with an active cancellation request.

### Test Payment (Stripe Test Mode)

```
Card number:  4242 4242 4242 4242
Expiry:       any future date (e.g. 12/28)
CVC:          any 3 digits (e.g. 123)
```

---

## 🗂️ Project Structure

```
toy-store/
├── docker-compose.yml          # Orchestration of all 5 services with health checks
├── .env.example              # Template with comments for every variable
├── README.md                  # This file (English)
├── README.sr.md               # Serbian version
├── AGENTS.md                  # Code conventions and architectural rules
│
├── nginx/
│   ├── Dockerfile
│   └── nginx.conf            # Reverse proxy, rate limiting zones, keepalive
│
├── backend/                  # Go API server
│   ├── Dockerfile            # Multi-stage build (builder + minimal runtime)
│   ├── go.mod                # Go 1.23 dependencies
│   ├── main.go               # Entry point — DB, Redis, migrations, server
│   ├── config/
│   │   └── config.go         # Environment variables with fail-fast validation
│   ├── migrations/            # Versioned SQL migrations (golang-migrate)
│   │   ├── 000001_create_users.up.sql
│   │   ├── 000002_create_orders.up.sql
│   │   ├── 000003_create_cart.up.sql
│   │   ├── 000004_create_wishlist.up.sql
│   │   ├── 000005_add_cancellation_columns.up.sql
│   │   └── 000006_seed_data.up.sql
│   └── internal/
│       ├── auth/             # JWT generation, validation, middleware
│       ├── cache/             # Redis client wrapper
│       ├── database/          # PostgreSQL connection pool (pgx/v5)
│       ├── handlers/          # HTTP handlers — only layer touching HTTP
│       ├── models/            # Domain models and request/response structures
│       ├── repository/        # Database queries — only layer touching SQL
│       ├── router/            # Gin route registration and middleware chaining
│       └── services/          # Business logic — only layer with business rules
│
├── frontend/                  # Next.js 14 App Router application
│   ├── Dockerfile            # Multi-stage build (deps + builder + runner)
│   ├── package.json
│   ├── tailwind.config.js    # Tailwind with custom brand tokens and dark mode
│   └── src/
│       ├── app/              # Next.js App Router pages
│       │   ├── page.tsx     # Home page (Server Component, server-side fetch)
│       │   ├── globals.css   # CSS variables, light and dark mode
│       │   ├── layout.tsx   # Root layout — fonts, ThemeProvider, Navbar
│       │   ├── toys/         # Catalog (/toys) and detail (/toys/[id])
│       │   ├── cart/         # Cart overview
│       │   ├── checkout/     # Stripe payment form
│       │   ├── profile/      # User profile and order history
│       │   ├── wishlist/     # Wishlist
│       │   ├── (auth)/        # Route group: /login and /register
│       │   └── admin/         # Admin panel (protected by Next.js middleware)
│       ├── components/
│       │   ├── home/         # HeroSection, CategoryBar, FeaturedToys,
│       │   │                 # AgeGroupSection, TrustBanner
│       │   ├── toys/         # ToyCard, ToyFilters, ToySearch
│       │   ├── layout/        # Navbar with dark mode toggle
│       │   ├── providers/     # AuthProvider, ThemeProvider
│       │   └── ui/            # shadcn/ui primitives (Button, Badge, Skeleton,
│       │                       # Pagination, ThemeToggle, Sonner Toaster)
│       ├── hooks/             # useAuth, useWishlist, useCart
│       ├── lib/
│       │   ├── api.ts         # Axios instance with JWT interceptor and
│       │   │                 # auto-refresh logic
│       │   ├── auth.ts        # Token helpers (localStorage + cookies)
│       │   ├── errors.ts      # getErrorMessage, getFieldErrors helpers
│       │   └── validators.ts   # Zod schemas with Serbian validation errors
│       ├── store/             # Zustand stores
│       │   ├── cartStore.ts    # Cart — fetch, add, update, remove
│       │   ├── wishlistStore.ts # Wishlist
│       │   └── orderStore.ts   # Checkout flow and order history
│       └── middleware.ts      # Next.js server-side route protection
│
└── database/
    └── seed.sql               # Test data (reference copy for development)
```

---

## 🛠️ Tech Stack — Decision Rationale

Every technology choice was driven by the specific requirements of the project.

| Technology | Version | Why |
|------------|---------|-----|
| **Go + Gin** | 1.23 | Static typing eliminates runtime errors. Compiles to a single binary with no runtime dependencies. Gin router with middleware chaining has minimal overhead. |
| **Next.js App Router** | 14 | Server Components for data fetching without waterfalls. SSR for SEO. File-based routing. Excellent TypeScript integration. |
| **PostgreSQL** | 16 | ACID guarantees for order transactions. UUID support. `uuid-ossp` extension. Production-proven. |
| **Redis** | 7 | Sub-millisecond read/write. Essential for revocable JWT tokens. TTL natively supported. |
| **Nginx** | latest | Industry standard reverse proxy. Rate limiting before application layer. Keepalive connections (32 per upstream). |
| **Docker Compose** | — | Reproducible environment. Dependency ordering with health checks. Single command for the whole stack. |
| **JWT (golang-jwt/v5)** | v5.3 | Stateless authentication. Standard for REST APIs. Claims with user_id, role, and jti. |
| **bcrypt (golang.org/x/crypto)** | — | Deliberately slow hash algorithm for passwords. Auto-salt. Cost factor 12 (2¹² rounds). |
| **zerolog** | v1.32 | Structured JSON logs with minimal allocation. Queryable in production. |
| **golang-migrate** | v4.17 | Versioned bidirectional migrations. Auto-runs at startup. |
| **go-playground/validator** | v10.19 | Struct tag validation. Rich set of built-in rules. |
| **pgx/v5** | v5.5 | Native PostgreSQL driver for Go. Connection pool. Better performance than `database/sql`. |
| **Zod** | v3.22 | Runtime TypeScript validation. Schema = validation + type inference in one. |
| **Zustand** | v4.5 | Minimal state management without Redux boilerplate. |
| **Axios** | v1.6 | HTTP client with interceptor support for JWT auto-refresh. |
| **Stripe** | v76 (test mode) | Industry standard for payments. PaymentIntent API. Test cards for simulation. |
| **next-themes** | v0.4 | Dark/light mode with `class` strategy. System preference support. No hydration mismatch. |
| **shadcn/ui** | — | UI components in project code — no npm dependency, full control. Tailwind-based. |
| **Sonner** | — | Toast notifications for user feedback (success/error). Used in root layout as `<Toaster />`. |
| **tailwindcss-animate** | — | CSS animations for components (fade-in, slide, skeleton pulse). |
| **tw-animate-css** | — | CSS animations for shadcn/ui components. Automatically included with shadcn setup. |

---

## ⚠️ Known Limitations

This is an academic project. Some limitations are intentional, some would be resolved in a production system.

**Toy images** are served from the `toy.pequla.com` server. The home page uses emoji placeholders instead of real images because image URLs are relative paths pointing to an external server we don't control.

**Stripe webhook** requires the Stripe CLI tool for local testing because Stripe cannot send an HTTP request to `localhost`. The endpoint `/api/webhook/stripe` exists and verifies the HMAC signature, but is not called automatically in local development. In production, you would configure the actual webhook URL in the Stripe Dashboard and `STRIPE_WEBHOOK_SECRET` in `.env`.

**Email notifications** are not implemented. The system does not send order confirmation, shipping status notifications, or password reset emails.

**Search** is implemented as in-memory filtering on the fetched toy list. This works but doesn't scale for catalogs with thousands of toys. A production solution would use PostgreSQL full-text search or Elasticsearch.

**HTTPS** is not configured. Nginx listens on port 80 (HTTP). In production, you would add an SSL certificate (Let's Encrypt via Certbot) and an HTTP-to-HTTPS redirect in nginx.conf.

**Catalog pagination** is performed client-side on the frontend because the backend returns all toys from Redis cache at once. Server-side pagination would be more efficient for a large catalog.

**Admin panel — cancellation requests** (`/admin/cancellation-requests`): Backend endpoints exist (`/api/admin/cancellation-requests`, `/approve`, `/decline`) but the admin UI for managing cancellations is not implemented. Users can request cancellation from their profile, and admins see the number of requests in analytics, but there is no dedicated page for approving/declining. This is a planned upgrade.

---

## 💻 Running for Development (without Docker)

For developers who want hot-reload outside of Docker containers. Requires locally installed PostgreSQL 16 and Redis 7.

```bash
# Backend
cd backend

export DB_URL="postgres://toystore_user:password@localhost:5432/toystore?sslmode=disable"
export REDIS_URL="redis://:redis_password@localhost:6379/0"
export JWT_SECRET="$(openssl rand -hex 32)"
export EXTERNAL_API_URL="https://toy.pequla.com/api"
export ENVIRONMENT="development"
export LOG_LEVEL="debug"

# Run migrations
go run -tags 'postgres' \
  github.com/golang-migrate/migrate/v4/cmd/migrate@latest \
  -path ./migrations -database "$DB_URL" up

# Start server
go run ./main.go

# Linting and static analysis
go vet ./...
gofmt -w .
go test ./...
```

```bash
# Frontend (in a separate terminal)
cd frontend

# Create .env.local — REQUIRED: fill in real values
# ⚠️ .env.local in the frontend/ directory OVERRIDES docker-compose env vars in dev mode!
# ⚠️ Keep both .env.local AND .env in sync when changing Stripe keys!
cat > .env.local << 'EOF'
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
EOF

npm install
npm run build
npm run dev
# Dev server available at http://localhost:3000

# Type-check and lint
npx tsc --noEmit
npm run lint
npm run build
```

---

## 🔧 Managing Migrations

### How Migrations Work

`golang-migrate` checks the `schema_migrations` table in PostgreSQL at every backend startup:

```sql
-- Table maintained automatically by golang-migrate
SELECT version, dirty FROM schema_migrations;
-- version: number of the last executed migration (e.g. 6)
-- dirty: true if the last migration crashed mid-way
```

Each migration has `up` and `down` variants:

```
migrations/
├── 000001_create_users.up.sql      ← creates users table
├── 000001_create_users.down.sql    ← drops users table (rollback)
├── 000002_create_orders.up.sql
├── 000002_create_orders.down.sql
└── ...
```

Migrations run once and never twice — the `schema_migrations` table tracks which ones have already run.

### Manual Management (outside Docker)

```bash
cd backend

# Run all pending migrations
go run -tags 'postgres' \
  github.com/golang-migrate/migrate/v4/cmd/migrate@latest \
  -path ./migrations \
  -database "postgres://user:pass@localhost:5432/toystore?sslmode=disable" \
  up

# Rollback last migration
go run -tags 'postgres' \
  github.com/golang-migrate/migrate/v4/cmd/migrate@latest \
  -path ./migrations \
  -database "postgres://user:pass@localhost:5432/toystore?sslmode=disable" \
  down 1

# Check current state
go run -tags 'postgres' \
  github.com/golang-migrate/migrate/v4/cmd/migrate@latest \
  -path ./migrations \
  -database "postgres://user:pass@localhost:5432/toystore?sslmode=disable" \
  version
```

### Adding a New Migration

```bash
# Naming convention: number_description.up.sql and number_description.down.sql
touch backend/migrations/000007_add_reviews.up.sql
touch backend/migrations/000007_add_reviews.down.sql
```

```sql
-- 000007_add_reviews.up.sql
CREATE TABLE reviews (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    toy_id     INTEGER NOT NULL,
    rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    body       TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

```sql
-- 000007_add_reviews.down.sql
DROP TABLE IF EXISTS reviews;
```

---

## 🔍 Detailed Go Architecture Walkthrough

### Complete Flow Example: Adding to Cart

Every HTTP request passes through all layers. Here is a concrete example for `POST /api/cart`:

```
POST /api/cart
{ "toy_id": 6, "quantity": 1 }
Authorization: Bearer eyJ...
```

**1. Router** (`internal/router/router.go`) receives the request and passes it through middleware:

```go
cartGroup := r.Group("/api/cart")
cartGroup.Use(authMiddleware.RequireAuth())   // verifies JWT
{
    cartGroup.POST("", cartHandler.AddToCart)
}
```

**2. Middleware** (`internal/auth/middleware.go`) verifies the token and writes userID to context:

```go
func (m *Middleware) RequireAuth() gin.HandlerFunc {
    return func(c *gin.Context) {
        // parses "Authorization: Bearer <token>"
        // validates signature and expiry
        // c.Set("userID", claims.UserID)
        c.Next()
    }
}
```

**3. Handler** (`internal/handlers/cart_handler.go`) reads the request body and calls the service:

```go
func (h *CartHandler) AddToCart(c *gin.Context) {
    userID := c.GetString("userID")

    var req AddToCartRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        respondValidationError(c, err)
        return
    }

    item, err := h.service.AddItem(c.Request.Context(), userID, req.ToyID, req.Quantity)
    if err != nil {
        respondError(c, http.StatusBadRequest, "CART_ERROR", err.Error())
        return
    }

    c.JSON(http.StatusCreated, gin.H{"data": item})
}
```

**4. Service** (`internal/services/cart_service.go`) contains business logic:

```go
func (s *CartService) AddItem(ctx context.Context, userID string, toyID int, qty int) (*models.CartItem, error) {
    // Verify that the toy exists (calls ToyService which uses Redis cache)
    toy, err := s.toyService.GetByID(ctx, toyID)
    if err != nil {
        return nil, fmt.Errorf("toy not found: %w", err)
    }

    // Call repository for the DB operation
    return s.repo.AddOrUpdate(ctx, userID, toyID, toy.Name, toy.Image, toy.Price, qty)
}
```

**5. Repository** (`internal/repository/cart_repository.go`) executes SQL:

```go
func (r *CartRepository) AddOrUpdate(ctx context.Context, userID string, toyID int,
    name, image string, price float64, qty int) (*models.CartItem, error) {
    // UPSERT — if it already exists, increment quantity
    row := r.db.QueryRow(ctx, `
        INSERT INTO cart_items (user_id, toy_id, toy_name_cache, toy_image_cache, price_cache, quantity)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id, toy_id)
        DO UPDATE SET quantity = cart_items.quantity + EXCLUDED.quantity,
                      updated_at = NOW()
        RETURNING id, user_id, toy_id, toy_name_cache, toy_image_cache,
                  price_cache, quantity, updated_at
    `, userID, toyID, name, image, price, qty)

    var item models.CartItem
    if err := row.Scan(&item.ID, /* ... */); err != nil {
        return nil, fmt.Errorf("failed to add cart item: %w", err)
    }
    return &item, nil
}
```

Each layer has one clear responsibility. Changing a SQL query does not require touching the handler or service.

### Structured Logging Example

Every HTTP request is logged through the `requestLogger` middleware as JSON with zerolog:

```json
{
  "level": "info",
  "client_ip": "172.18.0.1",
  "method": "POST",
  "path": "/api/cart",
  "status": 201,
  "latency": "12.34ms",
  "user_id": "550e8400-e29b-41d4-a716-446655440001",
  "time": "2026-03-19T14:30:00Z"
}
```

Cache operations are logged at the `debug` level:

```json
{"level":"debug","key":"toys:all","message":"cache_hit"}
{"level":"debug","key":"toy:6","message":"cache_miss"}
{"level":"warn","key":"toys:all","error":"redis: connection refused","message":"failed to cache toys"}
```

Monitoring logs in real time:

```bash
docker-compose logs -f backend           # all logs
docker-compose logs -f backend | grep '"status":4'  # only 4xx errors
docker-compose logs -f backend | grep 'cache_miss'    # cache misses
```

---

## 🎨 Frontend Architecture — Details

### Server vs Client Components

Next.js 14 App Router distinguishes Server Components (default) and Client Components (`'use client'`).

**Server Component** — executes on the server, has no access to browser APIs:

```typescript
// src/app/page.tsx — Server Component
// Fetching happens on the server, within the Docker network
export default async function HomePage() {
  const [toys, ageGroups, toyTypes] = await Promise.all([
    fetchJSON<Toy[]>('/api/toys'),        // http://backend:8080/api/toys
    fetchJSON<AgeGroup[]>('/api/toys/age-groups'),
    fetchJSON<ToyType[]>('/api/toys/types'),
  ]);

  // Check auth state by reading cookies (server-side)
  const cookieStore = await cookies();
  const hasToken = cookieStore.has('access_token');

  return (
    <main>
      <HeroSection />
      <FeaturedToys toys={toys ?? []} isAuthenticated={hasToken} />
    </main>
  );
}
```

Benefits: no JavaScript on the client for data fetching, no loading states, content is in the HTML that search engines index.

**Client Component** — executes in the browser, has access to hooks and the DOM API:

```typescript
// src/components/home/FeaturedToys.tsx
'use client';

export function FeaturedToys({ toys, isAuthenticated }: FeaturedToysProps) {
  const { addItem } = useCartStore();           // Zustand store
  const { isInWishlist } = useWishlistStore();
  const [loading, setLoading] = useState(false);

  // Interactivity — button click, API call
  async function handleAddToCart(toyId: number) {
    setLoading(true);
    await addItem(toyId, 1);
    setLoading(false);
  }

  return (/* JSX with onClick handlers */);
}
```

### Zustand Store — Example

The cart store (`src/store/cartStore.ts`) holds all cart state and all actions:

```typescript
export const useCartStore = create<CartState>((set, get) => ({
  items: [],
  subtotal: 0,
  itemCount: 0,
  isLoading: false,
  error: null,

  fetchCart: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get<CartResponse>('/cart');
      const { items, subtotal } = response.data.data;
      const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
      set({ items, subtotal, itemCount, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Greška pri učitavanju korpe', isLoading: false });
    }
  },

  addItem: async (toyId: number, quantity: number) => {
    set({ error: null, isLoading: true });
    try {
      await api.post('/cart', { toy_id: toyId, quantity });
      const response = await api.get<CartResponse>('/cart');
      const { items, subtotal } = response.data.data;
      const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
      set({ items, subtotal, itemCount, isLoading: false });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Nije uspelo dodavanje u korpu', isLoading: false });
      throw error;
    }
  },
}));
```

### useCart Hook — Wrapper Around Zustand Store

Components don't use `cartStore` directly — they use the `useCart` hook (`src/hooks/useCart.ts`) which wraps the store and automatically calls `fetchCart()` on mount. This eliminates the repeated `useEffect(() => { fetchCart() }, [])` in every component:

```typescript
// Navbar.tsx, checkout/page.tsx — all use the same pattern
export function useCart() {
  const store = useCartStore();
  useEffect(() => { store.fetchCart(); }, []);
  return store;
}
```

### Zod Validation with Serbian Messages

All form inputs go through Zod schemas defined in `src/lib/validators.ts`:

```typescript
export const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Korisničko ime mora imati najmanje 3 karaktera')
    .max(50, 'Korisničko ime ne sme biti duže od 50 karaktera'),
  email: z
    .string()
    .email('Neispravan format email adrese'),
  password: z
    .string()
    .min(8, 'Lozinka mora imati najmanje 8 karaktera'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Lozinke se ne podudaraju',
  path: ['confirmPassword'],
});

type RegisterForm = z.infer<typeof registerSchema>;
```

Validation errors are shown immediately below the field, without sending a request to the server.

### Axios Interceptor — Details

`src/lib/api.ts` defines an interceptor that transparently manages JWT tokens:

```typescript
// Request interceptor — adds token before sending
api.interceptors.request.use(async (config) => {
  const token = getAccessToken();
  if (token) {
    if (isTokenExpired(token)) {
      // Token expired — renew before sending request
      const newToken = await refreshAccessToken();
      if (newToken) {
        config.headers.Authorization = `Bearer ${newToken}`;
      } else {
        // Refresh failed — redirect to login
        window.location.href = '/login';
        return Promise.reject(new Error('Token refresh failed'));
      }
    } else {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Response interceptor — catches 401 and attempts refresh
api.interceptors.response.use(
  response => response,
  async (error) => {
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't redirect if user is not logged in (no refresh token)
      if (!getRefreshToken()) return Promise.reject(error);
      // Attempt refresh then retry original request
    }
    return Promise.reject(error);
  }
);
```

---

## 🔒 Complete SQL Schema

For reference — the full database schema as defined in the migrations:

```sql
-- Extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Users ─────────────────────────────────────────────────────────────────
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username      VARCHAR(50)  NOT NULL UNIQUE,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'user'
                  CHECK (role IN ('user', 'admin')),
    avatar_url    TEXT,
    address       TEXT,
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- ─── Orders ────────────────────────────────────────────────────────────────
CREATE TABLE orders (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status           VARCHAR(30) NOT NULL DEFAULT 'pending'
                     CHECK (status IN
                       ('pending','processing','shipped','delivered','cancelled')),
    payment_status   VARCHAR(20) NOT NULL DEFAULT 'pending'
                     CHECK (payment_status IN
                       ('pending','paid','failed','refunded')),
    total_amount     NUMERIC(10,2) NOT NULL,
    shipping_address TEXT NOT NULL,
    created_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS cancellation_requested BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS cancellation_reason    TEXT,
    ADD COLUMN IF NOT EXISTS cancellation_approved  BOOLEAN,
    ADD COLUMN IF NOT EXISTS cancellation_response  TEXT;

CREATE INDEX idx_orders_user_id    ON orders(user_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- ─── Order Items (snapshot) ──────────────────────────────────────────────
CREATE TABLE order_items (
    id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id          UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    toy_id            INTEGER NOT NULL,
    toy_name          VARCHAR(255) NOT NULL,
    toy_image_url     TEXT,
    price_at_purchase NUMERIC(10,2) NOT NULL,
    quantity          INTEGER NOT NULL CHECK (quantity > 0)
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- ─── Cart ─────────────────────────────────────────────────────────────────
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

-- ─── Wishlist ──────────────────────────────────────────────────────────────
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

## 🧰 Useful Commands for Development

### Inspecting the Database

```bash
# Enter PostgreSQL shell
docker-compose exec db psql -U toystore_user -d toystore

# List tables
\dt

# View users
SELECT id, username, email, role, is_active FROM users;

# View orders with statuses
SELECT o.id, u.username, o.status, o.payment_status,
       o.total_amount, o.created_at
FROM orders o
JOIN users u ON u.id = o.user_id
ORDER BY o.created_at DESC;

# View a user's cart
SELECT c.toy_id, c.toy_name_cache, c.price_cache, c.quantity
FROM cart_items c
JOIN users u ON u.id = c.user_id
WHERE u.email = 'user@toystore.com';
```

### Inspecting Redis

```bash
# Enter Redis CLI
docker-compose exec redis redis-cli --pass $REDIS_PASSWORD

# List all keys
KEYS *

# Check TTL of toy cache
TTL toys:all

# View content (JSON)
GET toys:all | python3 -m json.tool | head -50

# Check if a refresh token exists for a user
KEYS *refresh*
```

### Logs and Debugging

```bash
# Follow all logs in real time
docker-compose logs -f

# Backend logs only
docker-compose logs -f backend

# Filter errors (4xx and 5xx)
docker-compose logs -f backend 2>&1 | grep '"status":[45]'

# Follow cache misses
docker-compose logs -f backend 2>&1 | grep 'cache_miss'

# Restart a single service without rebuilding
docker-compose restart backend
docker-compose restart frontend
```

### Reset and Cleanup

```bash
# Complete reset (deletes all data)
docker-compose down -v
docker-compose up --build

# Rebuild only frontend (e.g. after code changes)
docker-compose up --build frontend

# Remove unused Docker images
docker image prune -f
```

---

## 🐛 Troubleshooting

### Common Problems and Solutions

**Problem:** Backend cannot connect to the database on first startup.

```
error: failed to connect to database: connection refused
```

**Solution:** Docker Compose `depends_on` with `condition: service_healthy` waits for the health check, but if the PostgreSQL container was not created before it can take time. Wait 30–60 seconds and restart:

```bash
docker-compose down && docker-compose up --build
```

---

**Problem:** `schema_migrations: dirty database version`

**Solution:** A migration was interrupted mid-way. Mark as clean and restart:

```bash
docker-compose exec db psql -U toystore_user -d toystore \
  -c "UPDATE schema_migrations SET dirty = false"
docker-compose restart backend
```

---

**Problem:** Frontend shows `Internal Server Error` when loading the home page.

**Solution:** Server Component cannot reach the backend. Check if the backend is running:

```bash
docker-compose ps                    # all services must be "Up"
docker-compose logs backend | tail   # startup error?
curl http://localhost/health         # must return {"status":"ok"}
```

---

**Problem:** Stripe payment doesn't work — `payment intent creation failed`.

**Solution:** Check if `STRIPE_SECRET_KEY` starts with `sk_test_` or `sk_live_`:

```bash
# Check value in running container
docker-compose exec backend env | grep STRIPE_SECRET_KEY
```

If the key is not set correctly, the system falls back to mock mode (not an error, just no Stripe calls). If the key starts with `sk_` but payments still fail — check if the key is valid in the Stripe Dashboard.

---

**Problem:** `wishlist`/`cart` API returns 401 for unauthenticated users and redirects to `/login`.

**Solution:** This is intentional when the user has **an expired session**. If the user was never logged in, 401 is silently ignored. The Axios interceptor checks for the presence of a refresh token before redirecting — without a refresh token, it does not redirect.

---

**Problem:** Redis is unavailable, backend won't start.

**Solution:** Redis is a required dependency. Check the password:

```bash
# Check Redis connection
docker-compose exec redis redis-cli --pass $REDIS_PASSWORD ping
# Must return: PONG
```

If `REDIS_PASSWORD` in `.env` doesn't match the password Redis was started with, reset:

```bash
docker-compose down -v    # deletes Redis volume with the old password
docker-compose up --build
```

---

## 📄 License

```
MIT License — free for educational use.
```
