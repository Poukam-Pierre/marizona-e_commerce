# ShopPk - Production-Ready E-Commerce Platform

A full-stack e-commerce platform built with Nx monorepo, featuring Next.js storefront, admin panel, and NestJS API.

## 🚀 Quick Start

```bash
# Development
bun install
bun run db:push
bun run db:seed
bun run dev:all

# Docker
bun run docker:dev   # Start PostgreSQL & Redis
bun run dev:all      # Start applications

# Production
bun run docker:build
bun run docker:up
```

**Access Points:**
- Storefront: http://localhost:3000
- Admin: http://localhost:3001
- API: http://localhost:3002/api/v1
- API Docs: http://localhost:3002/api/docs

**Default Admin:**
- Email: `superadmin@shoppk.com`
- Password: `admin123`

## 📁 Project Structure

```
shoppk/
├── apps/
│   ├── storefront/     # Next.js 16 e-commerce storefront
│   ├── admin/          # Next.js 16 admin dashboard (MUI)
│   └── api/            # NestJS REST API
├── libs/
│   ├── types/          # Shared TypeScript types
│   ├── config/         # Configuration utilities
│   ├── utils/          # Shared utilities
│   └── database/       # Database utilities
├── prisma/
│   ├── schema.prisma   # Database schema
│   └── seed.ts         # Database seeding
├── docker/
│   ├── Dockerfile.api
│   ├── Dockerfile.storefront
│   ├── Dockerfile.admin
│   └── nginx.conf
├── k8s/
│   ├── base/           # Kubernetes base manifests
│   └── overlays/
│       ├── staging/    # Staging environment
│       └── production/ # Production environment
├── .github/
│   └── workflows/
│       └── ci-cd.yml   # CI/CD pipeline
└── docs/
    ├── DEPLOYMENT.md
    ├── DEPLOYMENT_CHECKLIST.md
    ├── QUICKSTART.md
    └── SCALING.md
```

## 🛠️ Tech Stack

### Frontend
- **Next.js 16** - App Router, SSR, ISR
- **React 19** - UI framework
- **Tailwind CSS** - Styling (storefront)
- **MUI** - UI components (admin)
- **TanStack Query** - Data fetching
- **Zustand** - State management

### Backend
- **NestJS** - API framework
- **Prisma** - ORM
- **PostgreSQL** - Primary database
- **Redis** - Caching & sessions
- **JWT** - Authentication

### Infrastructure
- **Docker** - Containerization
- **Kubernetes** - Orchestration
- **GitHub Actions** - CI/CD
- **Nx** - Monorepo tooling

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Quick Start](./docs/QUICKSTART.md) | Get up and running quickly |
| [Deployment Guide](./docs/DEPLOYMENT.md) | Comprehensive deployment instructions |
| [Deployment Checklist](./docs/DEPLOYMENT_CHECKLIST.md) | Pre-flight checklist |
| [Scaling Strategy](./docs/SCALING.md) | Horizontal scaling & optimization |

## 🔧 Available Scripts

```bash
# Development
bun run dev           # Start storefront
bun run dev:admin     # Start admin
bun run dev:api       # Start API
bun run dev:all       # Start all apps

# Build
bun run build         # Build all apps
bun run build:prod    # Production build

# Testing
bun run lint          # Run ESLint
bun run test          # Run tests
bun run typecheck     # Type check

# Database
bun run db:push       # Push schema changes
bun run db:migrate    # Create migration
bun run db:seed       # Seed database
bun run db:studio     # Open Prisma Studio

# Docker
bun run docker:dev    # Start dev infrastructure
bun run docker:build  # Build images
bun run docker:up     # Start production stack

# Kubernetes
bun run k8s:staging   # Deploy to staging
bun run k8s:production # Deploy to production
```

## 🌐 Ports

| Service | Port |
|---------|------|
| Storefront | 3000 |
| Admin | 3001 |
| API | 3002 |
| PostgreSQL | 5432 |
| Redis | 6379 |

## 🔐 Security

- JWT authentication with refresh tokens
- Password hashing with bcrypt
- Rate limiting on API endpoints
- CORS configuration
- Security headers (XSS, CSRF, etc.)
- Input validation with class-validator

## 📦 PWA Features

- Service worker with offline support
- Installable on mobile devices
- Push notifications ready
- Background sync capability

## 🚢 Deployment

### Docker Compose (VPS)

```bash
bun run docker:build
bun run docker:up
```

### Kubernetes (Production)

```bash
kubectl apply -k k8s/overlays/production
```

### CI/CD

Push to `main` branch to trigger automatic deployment.

## 📊 Monitoring

- Health check endpoints
- Prometheus metrics ready
- Sentry error tracking
- Structured logging

## 📄 License

MIT

---

Built with ❤️ using Nx, Next.js, and NestJS
