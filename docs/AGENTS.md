# AGENTS.md — Coding Guidelines for Toy Store Project

This file provides quick reference for AI coding agents working on this university toy store project.

## Quick Start

```bash
cp .env.example .env
docker-compose up --build
```

App available at `http://localhost`

Test credentials:
- Admin: `admin@toystore.com` / `admin123`
- User: `user@toystore.com` / `user123`

## Build Commands

### Full Stack
```bash
docker-compose up --build          # Build and start all services
docker-compose down -v             # Stop and remove volumes (data reset)
docker-compose logs -f backend     # Tail backend logs
docker-compose logs -f frontend    # Tail frontend logs
```

### Backend (Go)
```bash
cd backend
go build -o server ./main.go       # Build binary
go run ./main.go                   # Run locally (needs DB/Redis)
go mod tidy                        # Clean dependencies
go mod download                    # Download dependencies

# Testing
go test ./...                      # Run all tests
go test -v ./...                   # Run with verbose output
go test ./internal/services        # Run package tests
go test -run TestCreateUser ./internal/repository   # Run single test
go test -v -run TestAuthService$ ./internal/services # Run specific test

# Linting
go vet ./...                       # Static analysis
gofmt -w .                         # Format all files
gofmt -d .                         # Show formatting diffs

# Migrations
go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest -path ./migrations -database "$DB_URL" up
go run -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest -path ./migrations -database "$DB_URL" down
```

### Frontend (Next.js)
```bash
cd frontend
npm install                        # Install dependencies
npm run dev                        # Start dev server (port 3000)
npm run build                      # Production build
npm start                          # Start production server

# Testing
npm test                           # Run all tests
npm test -- --watch              # Watch mode
npm test -- --testNamePattern="AuthForm"  # Run single test
npm test -- --testPathPattern="components/auth"  # Run test file

# Linting & Types
npm run lint                       # ESLint
npm run lint -- --fix            # Auto-fix lint errors
npx tsc --noEmit                   # Type check only
```

## Code Style Guidelines

### Go Backend

#### Package Structure
```
backend/
├── internal/
│   ├── auth/        # JWT, middleware
│   ├── cache/       # Redis client
│   ├── config/      # Env config
│   ├── database/    # DB connection
│   ├── handlers/    # HTTP handlers (only layer that touches HTTP)
│   ├── models/      # Domain models
│   ├── repository/  # Database queries
│   ├── router/      # Route registration
│   └── services/    # Business logic
```

#### Layer Rules
- **Handler** → receives HTTP, validates input, calls service, returns JSON
- **Service** → business logic, calls repositories, returns errors (not HTTP codes)
- **Repository** → database queries only, no business logic

#### Naming Conventions
- Files: `snake_case.go` (e.g., `auth_handler.go`)
- Types: `PascalCase` (e.g., `UserService`)
- Interfaces: `PascalCase` ending with `er` (e.g., `UserRepository`)
- Functions: `PascalCase` for exported, `camelCase` for unexported
- Variables: `camelCase` (e.g., `userID`, `dbPool`)
- Constants: `PascalCase` or `ALL_CAPS` for exported

#### Imports (grouped)
```go
import (
    "context"
    "time"

    "github.com/gin-gonic/gin"
    "github.com/rs/zerolog/log"

    "github.com/yourname/toystore/internal/models"
)
```

#### Error Handling
```go
// Services return errors
func (s *UserService) GetByID(ctx context.Context, id string) (*models.User, error) {
    user, err := s.repo.FindByID(ctx, id)
    if err != nil {
        return nil, fmt.Errorf("failed to find user: %w", err)
    }
    return user, nil
}

// Handlers set HTTP status
func (h *UserHandler) GetUser(c *gin.Context) {
    user, err := h.service.GetByID(c.Request.Context(), id)
    if err != nil {
        log.Error().Err(err).Str("user_id", id).Msg("failed to get user")
        c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get user"})
        return
    }
    c.JSON(http.StatusOK, gin.H{"data": user})
}
```

#### Struct Tags
```go
type RegisterRequest struct {
    Username string `json:"username" validate:"required,min=3,max=50"`
    Email    string `json:"email" validate:"required,email"`
    Password string `json:"password" validate:"required,min=8"`
}
```

### Next.js Frontend

#### File Structure
```
frontend/src/
├── app/                  # Next.js 14 App Router
│   ├── (auth)/          # Route groups
│   ├── admin/
│   └── api/             # Route handlers (if needed)
├── components/
│   ├── ui/              # Button, Input, Modal
│   ├── layout/          # Navbar, Footer
│   └── [feature]/       # Domain components
├── lib/
│   ├── api.ts           # Axios instance
│   ├── auth.ts          # Token helpers
│   └── validators.ts    # Zod schemas
├── hooks/               # Custom React hooks
└── store/               # Zustand stores
```

#### Naming Conventions
- Components: `PascalCase.tsx` (e.g., `ToyCard.tsx`)
- Hooks: `useCamelCase.ts` (e.g., `useAuth.ts`)
- Utilities: `camelCase.ts` (e.g., `api.ts`)
- Types: `PascalCase` interfaces/types in same file or `types.ts`
- Routes: `kebab-case` directories

#### TypeScript
```typescript
// No 'any' allowed
interface Toy {
  id: number;
  name: string;
  price: number;
  imageUrl: string;
}

// Explicit return types on hooks
export function useAuth(): AuthState {
  // ...
}

// Zod validation
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

type LoginForm = z.infer<typeof loginSchema>;
```

#### React Components
```typescript
'use client'; // When using hooks or browser APIs

interface ToyCardProps {
  toy: Toy;
  onAddToCart: (toyId: number) => void;
}

export function ToyCard({ toy, onAddToCart }: ToyCardProps): JSX.Element {
  return (
    <div className="rounded-lg border p-4">
      {/* ... */}
    </div>
  );
}
```

#### API Calls
```typescript
// src/lib/api.ts
import axios from 'axios';

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Usage in components
const { data } = await api.get('/toys');
```

#### Error Handling
- Use try/catch in async functions
- Show loading states for all API calls
- Display inline validation errors from Zod
- No `console.log` in production code

## Key Architecture Rules

1. **No direct external API calls from frontend** — always go through Go backend
2. **Handler → Service → Repository** — never skip layers
3. **HTTP codes only in handlers** — services return errors
4. **Parameterized SQL only** — never string concatenation
5. **No file > 400 lines** — split when approaching limit
6. **All exported functions commented** — one-line doc comment
7. **Environment variables only** — no hardcoded secrets
8. **Redis caching** — toy data cached with appropriate TTL

## External References

- External API: `https://toy.pequla.com/api`
- JWT: access token 15min, refresh token 7 days
- Redis keys: `toys:all`, `toy:<id>`, `age-groups`, `toy-types`

## Pre-Commit Checklist

- [ ] `go vet ./...` passes (backend)
- [ ] `npx tsc --noEmit` passes (frontend)
- [ ] No `console.log` in frontend code
- [ ] No hardcoded secrets
- [ ] All errors handled explicitly
- [ ] Tests pass: `go test ./...` and `npm test`
