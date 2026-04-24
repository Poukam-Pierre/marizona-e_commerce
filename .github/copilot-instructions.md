# GitHub Copilot Instructions for ShopPk

This document provides essential guidance for AI coding agents working on the ShopPk repository.

## Repository Overview

**ShopPk** is a production-ready full-stack e-commerce platform built as a monorepo using Nx. The platform supports physical and digital product sales with WhatsApp-based checkout. It includes:

- **Backend API** (`apps/api`): NestJS application providing versioned REST APIs and WebSocket notifications
- **Frontend Apps**:
  - `apps/storefront`: Next.js customer-facing storefront (PWA-enabled, WhatsApp checkout)
  - `apps/admin`: Next.js admin dashboard (MUI-based, role-protected)
- **Shared Libraries** in `libs/`: types, utils, config, ui components, database utilities
- **Database**: SQLite (development) / PostgreSQL 16 (production) via Prisma ORM
- **Cache**: Redis 7 for caching and session management

## Technology Stack

### Core Technologies

- **Monorepo**: Nx 22.5.x
- **Backend**: NestJS 11.x with TypeScript
- **Frontend**: Next.js 16.x with React 19.x
- **Database**: SQLite (dev) / PostgreSQL 16 (prod) via Prisma 6.11.x
- **Cache**: Redis 7 with ioredis
- **Testing**: Jest 30.x for unit tests, Playwright for e2e tests
- **Styling**: Tailwind CSS 3.4.x (storefront), Material-UI 7.x (admin)
- **UI Components**: shadcn/ui (storefront — Radix UI based)
- **State Management**: Zustand (client-side cart), TanStack Query v5 (server state)
- **Real-time**: Socket.io WebSocket for product notifications
- **Push Notifications**: web-push (VAPID) for PWA push
- **Forms**: Formik with Yup validation
- **Auth**: JWT (access + refresh tokens) with Passport.js strategies

### Node.js Requirements

- **Required**: Node.js 20.0.0+
- **Package Manager**: bun 1.0.0+ (canonical package manager — `bun.lock` is source of truth)
- **Note**: pnpm can also be used; always use bun locally unless instructed otherwise

## Project Structure

```
marizona/
├── apps/
│   ├── api/                  # NestJS backend API (port 3002)
│   ├── storefront/           # Next.js customer storefront (port 3000)
│   ├── admin/                # Next.js admin dashboard (port 3001)
│   ├── api-e2e/              # API e2e tests (Jest)
│   ├── storefront-e2e/       # Storefront e2e tests (Playwright)
│   └── admin-e2e/            # Admin e2e tests (Playwright)
├── libs/
│   ├── types/                # @ecommerce-platform/types — shared TS types
│   ├── utils/                # @ecommerce-platform/utils — shared utilities
│   ├── config/               # @ecommerce-platform/config — configuration helpers
│   ├── ui/                   # @ecommerce-platform/ui — shared UI components
│   └── database/             # @ecommerce-platform/database — DB utilities
├── prisma/
│   ├── schema.prisma         # Database schema (SQLite dev, PostgreSQL prod)
│   ├── migrations/           # Migration history
│   └── seed.ts               # Database seed script
├── docker/
│   ├── Dockerfile.api, Dockerfile.storefront, Dockerfile.admin
│   └── nginx.conf, init-db.sql
├── k8s/
│   ├── base/                 # Kubernetes base manifests
│   └── overlays/staging, production  # Kustomize overlays
├── docs/                     # DEPLOYMENT.md, QUICKSTART.md, SCALING.md, etc.
└── .github/
    ├── workflows/ci-cd.yml   # CI/CD pipeline
    └── copilot-instructions.md
```

### Path Aliases (`tsconfig.base.json`)

```json
{
  "@ecommerce-platform/types": "libs/types/src/index.ts",
  "@ecommerce-platform/utils": "libs/utils/src/index.ts",
  "@ecommerce-platform/config": "libs/config/src/index.ts",
  "@ecommerce-platform/ui": "libs/ui/src/index.ts",
  "@ecommerce-platform/database": "libs/database/src/index.ts"
}
```

Always import shared code via these aliases — never use relative paths that cross app/lib boundaries.

## Development Workflow

### Initial Setup

1. **Install Dependencies**:

   ```bash
   bun install
   ```

2. **Start Infrastructure** (PostgreSQL + Redis via Docker):

   ```bash
   bun run docker:dev
   ```

3. **Database Setup**:

   ```bash
   bun run db:generate   # Generate Prisma client
   bun run db:push       # Push schema to dev DB (SQLite)
   bun run db:seed       # Seed initial data
   ```

4. **Start All Applications**:
   ```bash
   bun run dev:all       # Storefront + Admin + API in parallel
   # Or individually:
   bun run dev           # Storefront (port 3000)
   bun run dev:admin     # Admin (port 3001)
   bun run dev:api       # API (port 3002)
   ```

### Access Points (Development)

| Service     | URL                            |
| ----------- | ------------------------------ |
| Storefront  | http://localhost:3000          |
| Admin Panel | http://localhost:3001          |
| API         | http://localhost:3002/api/v1   |
| API Docs    | http://localhost:3002/api/docs |

**Default Admin Credentials**:

- Email: `superadmin@shoppk.com`
- Password: `admin123`

### Common Development Commands

```bash
# Testing
bun run test                   # Run all unit tests
bun run test:coverage          # With coverage reports
bun nx test api                 # Test specific project
bun nx test storefront

# Building
bun run build                  # Build all apps
bun run build:storefront
bun run build:admin
bun run build:api

# Linting & Type Checking
bun run lint                   # Lint all projects
bun run typecheck              # TypeScript checks

# Database
bun run db:migrate             # Create and apply migration
bun run db:migrate:deploy      # Apply migrations (production)
bun run db:studio              # Open Prisma Studio GUI
bun run db:generate            # Regenerate Prisma client
bun run db:reset               # Reset database (dev only)
bun run db:seed                # Seed database

# Docker
bun run docker:dev             # Start dev infrastructure (PG + Redis)
bun run docker:build           # Build production images
bun run docker:up              # Start production stack
bun run docker:down            # Stop production stack
bun run docker:logs            # Follow logs

# Kubernetes
bun run k8s:staging            # Deploy to staging
bun run k8s:production         # Deploy to production
```

## Code Style and Conventions

### File Naming

- **Files**: `kebab-case` (e.g., `user-profile.tsx`, `orders.service.ts`)
- **Directories**: `kebab-case`
- **Test files**: `*.spec.ts` (co-located or in `__tests__/`)
- **React Components**: `PascalCase.tsx` (e.g., `ProductCard.tsx`)

### Code Conventions

- **Variables/Functions**: `camelCase`
- **Constants**: `UPPER_SNAKE_CASE`
- **Classes/Interfaces/Types**: `PascalCase`
- **Enums**: `PascalCase` names, `UPPER_SNAKE_CASE` members
- **Booleans**: Prefix with `is`, `has`, `should` (e.g., `isActive`, `hasPermission`)
- **React Props interfaces**: `ComponentNameProps` (e.g., `ProductCardProps`)

### Code Quality

- **Formatter**: Prettier (configured at root) — always format before committing
- **Linting**: ESLint with Nx flat config (`eslint.config.mjs`)
- **Indentation**: 2 spaces
- **Line Endings**: LF (Unix-style)
- **Module boundaries**: Enforced by Nx — never cross app/lib boundaries via relative paths

## Backend Architecture (`apps/api`)

### Structure

```
apps/api/src/
├── app/              # Root AppModule, AppController, AppService
├── common/
│   ├── decorators/   # @CurrentUser(), @Public(), @Roles()
│   ├── dto/          # PaginationDto, PaginatedResult<T>
│   ├── filters/      # HttpExceptionFilter (global)
│   ├── interceptors/ # TransformInterceptor (standardized responses), LoggingMiddleware
│   └── services/     # PrismaService, RedisService, CurrencyService
├── config/           # appConfig, jwtConfig, redisConfig, databaseConfig
└── modules/
    ├── auth/         # JWT login, register, refresh, guards, strategies
    ├── categories/   # Product categories (hierarchical)
    ├── dashboard/    # Dashboard statistics
    ├── inventory/    # Stock movements
    ├── notifications/ # WebSocket gateway, push notifications, WhatsApp links
    ├── orders/       # Order lifecycle state machine
    ├── products/     # Product CRUD with variants and images
    ├── settings/     # Application settings
    └── users/        # Admin user management
```

### Patterns to Follow

- **Controller → Service → PrismaService** is the standard data flow
- All modules export a `*.module.ts`, `*.controller.ts`, `*.service.ts`, and a `dto/` directory
- Use `class-validator` + `class-transformer` on all DTOs — never accept raw objects at controller boundaries
- Use `@ApiProperty()` from `@nestjs/swagger` on all DTO fields
- Inject `PrismaService` for all database access — never instantiate `PrismaClient` directly
- Use `RedisService` for caching; it gracefully degrades when Redis is unavailable

### API URL Structure

- Base path: `/api/v1`
- Swagger UI: `/api/docs`

### Authentication & Authorization

- JWT access token (short-lived, configured via `JWT_EXPIRATION`)
- JWT refresh token (long-lived, via `JWT_REFRESH_EXPIRATION`)
- Guards: `JwtAuthGuard` (default), `RolesGuard`
- Decorators: `@Public()` to bypass auth, `@Roles(AdminRole.ADMIN)` for role restriction
- `AdminRole` hierarchy: `SUPER_ADMIN > ADMIN > MANAGER > VIEWER`

### Rate Limiting

- Three tiers configured via `@nestjs/throttler`:
  - `short`: 3 req/s
  - `medium`: 20 req/10s
  - `long`: 100 req/min

### Order State Machine

Strictly enforce these transitions — never permit arbitrary status changes:

```
PENDING → CONFIRMED → PROCESSING → SHIPPED → DELIVERED → COMPLETED
                   ↘ COMPLETED (digital orders shortcut)
Any non-terminal state → CANCELLED
DELIVERED / COMPLETED → REFUNDED
```

Terminal states (no further transitions): `CANCELLED`, `REFUNDED`

### Response Format

All API responses are normalized by `TransformInterceptor`:

```json
{
  "data": <payload>,
  "meta": <optional pagination meta>,
  "statusCode": 200,
  "timestamp": "ISO 8601"
}
```

### Database Conventions

- **IDs**: CUID (`@default(cuid())`)
- **Soft deletes**: `deletedAt DateTime?` — always filter `where: { deletedAt: null }` in queries
- **Timestamps**: All models have `createdAt` and `updatedAt`
- **JSON in dev DB**: SQLite stores JSON as `String` — in production PostgreSQL uses native `Json`
- After any `schema.prisma` change, run `pnpm run db:generate` immediately

## Frontend Architecture

### Storefront (`apps/storefront`) — Port 3000

- **Framework**: Next.js 16 App Router with React 19
- **Styling**: Tailwind CSS with shadcn/ui component library (Radix UI primitives)
- **Theme**: CSS variables-based design tokens in `globals.css`; dark mode via `next-themes` (`class` attribute)
- **Server state**: TanStack Query v5 (hooks in `src/hooks/use-api.ts`)
- **Client state**: Zustand (cart in `src/store/cart.ts`), persisted to `localStorage`
- **API Services**: `src/services/api.ts` — all API calls go through `apiFetch()` helper
- **Route structure**: `src/app/` with App Router page components
- **Component conventions**:
  - UI primitives: `src/components/ui/` (shadcn-style)
  - Feature components: `src/components/<feature>/`
  - Providers: `src/providers/`
  - Hooks: `src/hooks/`
- **PWA**: manifest.json, service worker, push notification subscription
- **Real-time**: WebSocket via `useProductNotifications` hook (Socket.io `/notifications` namespace)
- **Checkout**: WhatsApp-based — generates a prefilled WhatsApp message link
- **Currency**: XAF / FCFA (`APP_CONFIG.currency`)
- **Path alias**: `@/*` maps to `src/*`

### Admin Panel (`apps/admin`) — Port 3001

- **Framework**: Next.js 16 App Router with React 19
- **UI**: Material-UI (MUI) 7.x for all components — do NOT use shadcn/ui here
- **Styling**: MUI `ThemeProvider` + `next-themes` for light/dark mode
- **Auth**: JWT-based with session management; protected routes check admin authentication
- **Server state**: TanStack Query v5 (`src/providers/query-provider.tsx`)
- **Client state**: Zustand stores in `src/stores/`
- **Route structure**: `src/app/` — routes for dashboard, products, categories, orders, users, settings
- **Service layer**: `src/services/` for API calls with auth headers
- **Component conventions**: `src/components/` organized by feature

### Shared Data-Fetching Pattern

```typescript
// Always use TanStack Query hooks for server data
const { data, isLoading, error } = useProducts(query);

// Never fetch directly in components without useQuery/useMutation
```

## Notifications System

### WebSocket (Socket.io)

- Namespace: `/notifications`
- Events emitted by server: `product.created`, `product.updated`, `product.deleted`
- Client subscribes in storefront via `useProductNotifications` hook
- `NotificationsGateway` manages connected clients in-memory

### Push Notifications (PWA)

- VAPID-based using `web-push` library
- Subscriptions stored in `PushSubscription` table
- Service: `PushNotificationService` handles subscribe/unsubscribe/send
- Required env vars: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

### WhatsApp Integration

- On checkout, `NotificationsController` generates a WhatsApp deeplink for the order
- `PaymentMethod.WHATSAPP` is the primary checkout method
- Format: `https://wa.me/<number>?text=<prefilled message>`

## Testing Strategy

### Unit Tests

- Framework: Jest 30.x
- Co-located with source or in `__tests__/` directories
- Test files: `*.spec.ts` (or `*.test.ts`)
- Run: `npx nx test <project>` or `pnpm run test`
- Always mock `PrismaService` and `RedisService` in unit tests

### E2E Tests

- **API**: Jest-based (`apps/api-e2e`)
- **Frontend**: Playwright (`apps/storefront-e2e`, `apps/admin-e2e`)

### Test Best Practices

- Use `--passWithNoTests` in CI to allow projects without test files
- Clean up `process.env` modifications in `afterEach` hooks
- Use SQLite in-memory or file-based DB for API tests (`DATABASE_URL=file:./test.db`)
- Isolate test data with `beforeEach`/`afterEach` setup/tear-down

## Environment Variables

### Required for Development

| Variable                 | Purpose                   | Example                                           |
| ------------------------ | ------------------------- | ------------------------------------------------- |
| `DATABASE_URL`           | Prisma connection string  | `file:./dev.db` (dev) / `postgresql://...` (prod) |
| `REDIS_URL`              | Redis connection          | `redis://localhost:6379`                          |
| `JWT_SECRET`             | Access token signing key  | Generate: `openssl rand -base64 32`               |
| `JWT_REFRESH_SECRET`     | Refresh token signing key | Generate: `openssl rand -base64 32`               |
| `JWT_EXPIRATION`         | Access token TTL          | `15m`                                             |
| `JWT_REFRESH_EXPIRATION` | Refresh token TTL         | `7d`                                              |
| `PORT`                   | API port                  | `3002`                                            |
| `NODE_ENV`               | Environment               | `development`                                     |

### Optional / Feature-Specific

| Variable                      | Purpose                                     |
| ----------------------------- | ------------------------------------------- |
| `VAPID_PUBLIC_KEY`            | Enables PWA push notifications              |
| `VAPID_PRIVATE_KEY`           | Enables PWA push notifications              |
| `VAPID_SUBJECT`               | `mailto:admin@shoppk.com`                   |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | WhatsApp checkout number                    |
| `NEXT_PUBLIC_API_URL`         | API URL for storefront (if not using proxy) |

**Security**: Never commit `.env` to Git. Generate secrets with `openssl rand -base64 32`.

## Docker and Infrastructure

### Docker Compose Files

- `docker-compose.dev.yml`: Development infrastructure (PostgreSQL + Redis only)
- `docker-compose.yml`: Full production stack (API + Storefront + Admin + Postgres + Redis + Caddy/Nginx)
- `docker-compose.prod.yml`: Production variant with explicit image references

### Services and Ports (Production)

| Service    | Container Port | Host Port |
| ---------- | -------------- | --------- |
| Storefront | 3000           | 3000      |
| Admin      | 3001           | 3001      |
| API        | 3002           | 3002      |
| PostgreSQL | 5432           | 5432      |
| Redis      | 6379           | 6379      |

### Kubernetes

- Base manifests: `k8s/base/` (kustomize)
- Staging overlay: `k8s/overlays/staging/`
- Production overlay: `k8s/overlays/production/`
- Deploy: `pnpm run k8s:staging` or `pnpm run k8s:production`

## CI/CD Pipeline

### GitHub Actions (`.github/workflows/ci-cd.yml`)

- **Triggers**: Push to `main`/`develop`, PRs to `main`/`develop`, manual `workflow_dispatch`
- **Node Version**: 20
- **Jobs**:
  1. `lint` — ESLint across all projects
  2. `typecheck` — TypeScript compile check (after `db:generate`)
  3. `test` — Jest with SQLite test DB and Redis service container
  4. `build` — Production build with Nx
  5. `docker` — Build and push Docker images to registry
  6. `deploy` — Deploy to staging (auto on `develop`) or production (manual trigger)

## Common Issues and Solutions

### Database Issues

**Problem**: `Can't reach database server`
**Solution**: Start infrastructure: `pnpm run docker:dev`

**Problem**: Prisma client out of sync with schema
**Solution**: `pnpm run db:generate` — always run this after schema changes

**Problem**: Migration drift in development
**Solution**: `pnpm run db:reset` (dev only — destroys all data)

### Nx Issues

**Problem**: Stale cache or unexpected build failures
**Solution**: `npx nx reset`

**Problem**: Module boundary violations
**Solution**: Always import shared code via `@ecommerce-platform/*` aliases, not relative paths

### Build Issues

**Problem**: TypeScript errors after Prisma schema change
**Solution**: Run `pnpm run db:generate` then `pnpm run typecheck`

**Problem**: Next.js Image domain errors
**Solution**: Add allowed hostname to `next.config.js` → `images.remotePatterns`

### Development Issues

**Problem**: WebSocket connection refused in storefront
**Solution**: Ensure the API is running (`pnpm run dev:api`) before starting the storefront

## Architecture Decision Records

Key architectural decisions to respect:

1. **SQLite for development, PostgreSQL for production** — Prisma handles the abstraction; avoid provider-specific syntax in queries
2. **Soft deletes everywhere** — never hard-delete records that may be referenced by orders or audit logs
3. **WhatsApp-first checkout** — the primary payment flow redirects to WhatsApp; card payments are secondary
4. **Stateless API** — all auth state is in JWT; Redis is used for caching, not primary session storage
5. **Monorepo with strict module boundaries** — use Nx `@nx/enforce-module-boundaries` lint rule; cross-app imports are forbidden
6. **shadcn/ui in storefront, MUI in admin** — do not mix component libraries between apps

## Important Notes for AI Agents

### When Making Changes

1. **Run affected tests** after any code change: `bun nx affected:test`
2. **Follow the existing module pattern and e-commerce enterprise standards** in the codebase
3. **Run `bun run db:generate`** after any `prisma/schema.prisma` change
4. **Add `@ApiProperty()` decorators** to all DTO fields — the Swagger docs depend on them
5. **Use the order state machine** — never allow arbitrary `OrderStatus` transitions
6. **Respect soft-delete convention** — filter `deletedAt: null` in all Prisma queries on models that have it

### When Adding New Features

- **New API module**: create `modules/<name>/` with `<name>.module.ts`, `<name>.controller.ts`, `<name>.service.ts`, and `dto/`; register in `AppModule`
- **New storefront page**: create under `apps/storefront/src/app/<route>/page.tsx`; add TanStack Query hooks in `hooks/use-api.ts`
- **New admin page**: create under `apps/admin/src/app/<route>/page.tsx` using MUI components only
- **New shared type**: add to `libs/types/src/lib/types.ts` and export from `libs/types/src/index.ts`
- **New Prisma model**: add to `prisma/schema.prisma`, run `db:generate`, create and apply migration

### Before Committing

1. Run affected tests: `bunx nx affected:test`
2. Lint: `bun run lint`
3. Type check: `bun run typecheck`
4. Verify build: `bunx nx build <changed-project>`
5. If schema changed: verify `db:generate` and review generated migration

### When Doing a Code Review

1. Use the PR description (if available) and a summary of the changes to understand the context and scope of changes
2. Check that all DTO fields use `class-validator` decorators and `@ApiProperty()`
3. Ensure no hardcoded secrets or credentials in source code
4. Verify JWT-protected routes use appropriate guards and role decorators
5. Check that new Nx library imports use path aliases — no cross-boundary relative imports
6. Ensure push notification and WebSocket events follow the established payload contracts
7. Validate that React hooks in frontends follow the TanStack Query + Zustand patterns
8. Check for potential OWASP Top 10 issues: injection, broken auth, sensitive data exposure, etc.

### Working with Nx

- Use `bunx nx` commands for better caching and dependency management
- Run `bunx nx reset` if you encounter cache issues
- Use `bunx nx graph` to visualize project dependencies
- Leverage affected commands: `bunx nx affected:test`, `bunx nx affected:build`, `bunx nx affected:lint`

## Useful References

- **Nx Documentation**: https://nx.dev
- **NestJS Documentation**: https://docs.nestjs.com
- **Next.js Documentation**: https://nextjs.org/docs
- **Prisma Documentation**: https://www.prisma.io/docs
- **TanStack Query**: https://tanstack.com/query
- **shadcn/ui**: https://ui.shadcn.com
- **Material-UI**: https://mui.com
- **Socket.io**: https://socket.io/docs
- **web-push**: https://github.com/web-push-libs/web-push

---

**Last Updated**: 2026-04-24
**Platform**: ShopPk E-Commerce
**Nx Package Scope**: `@ecommerce-platform`
