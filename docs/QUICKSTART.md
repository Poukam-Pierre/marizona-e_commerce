# ShopPk Quick Deployment Guide

Get ShopPk up and running in under 10 minutes.

## Prerequisites

- Docker 24.0+
- Docker Compose 2.20+
- 4GB RAM minimum
- 10GB disk space

## Quick Start (5 minutes)

### 1. Clone & Configure

```bash
# Clone repository
git clone https://github.com/your-org/shoppk.git
cd shoppk

# Create environment file
cp .env.example .env
```

### 2. Edit Environment

```bash
# Edit .env with your settings
nano .env
```

Minimum required changes:
```env
# Change these secrets for production!
JWT_SECRET=your-secure-secret-here
JWT_REFRESH_SECRET=your-secure-refresh-secret-here
```

### 3. Deploy

```bash
# Build and start all services
bun run docker:build && bun run docker:up

# Initialize database
docker-compose exec api bun run db:migrate:deploy
docker-compose exec api bun run db:seed
```

### 4. Access

| Service | URL |
|---------|-----|
| Storefront | http://localhost:3000 |
| Admin Panel | http://localhost:3001 |
| API | http://localhost:3002/api/v1 |
| API Docs | http://localhost:3002/api/docs |

**Default Admin Login:**
- Email: `superadmin@shoppk.com`
- Password: `admin123`

---

## Development Setup (3 minutes)

### Using Local Database

```bash
# Start infrastructure only
bun run docker:dev

# Install dependencies
bun install

# Setup database
bun run db:push
bun run db:seed

# Start all apps locally
bun run dev:all
```

### Using SQLite (No Docker needed)

```bash
# Install dependencies
bun install

# Setup SQLite database
bun run db:push
bun run db:seed

# Start all apps
bun run dev:all
```

---

## Production Deployment

### Minimum Production Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4GB | 8GB+ |
| Disk | 20GB | 50GB+ SSD |
| PostgreSQL | - | Managed (RDS, Cloud SQL) |
| Redis | - | Managed (ElastiCache, Memorystore) |

### Production Environment Variables

```env
# Database (Managed PostgreSQL)
DATABASE_URL=postgresql://user:pass@host:5432/shoppk?schema=public

# Redis (Managed Redis)
REDIS_URL=redis://:password@host:6379

# JWT Secrets (256-bit)
JWT_SECRET=<openssl rand -base64 32>
JWT_REFRESH_SECRET=<openssl rand -base64 32>

# Web Push
VAPID_PUBLIC_KEY=<from npx web-push generate-vapid-keys>
VAPID_PRIVATE_KEY=<from npx web-push generate-vapid-keys>

# URLs
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api/v1
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Deploy Commands

```bash
# Build production images
bun run docker:build

# Deploy with production compose
bun run docker:up

# Run migrations
docker-compose exec api bun run db:migrate:deploy
```

---

## Kubernetes Deployment

### Quick Deploy

```bash
# Set your context
kubectl config use-context your-cluster

# Create namespace and secrets
kubectl create namespace shoppk
kubectl create secret generic shoppk-secrets \
  --from-literal=database-url='postgresql://...' \
  --from-literal=redis-url='redis://...' \
  --from-literal=jwt-secret='...' \
  --from-literal=jwt-refresh-secret='...' \
  -n shoppk

# Deploy
kubectl apply -k k8s/overlays/production

# Check status
kubectl get pods -n shoppk
```

---

## Verify Deployment

```bash
# Check all services are healthy
curl http://localhost:3000/           # Storefront
curl http://localhost:3001/           # Admin
curl http://localhost:3002/api/v1/health  # API

# Expected: All should return 200 OK
```

---

## Troubleshooting

### Port Already in Use

```bash
# Find and kill process using port
lsof -i :3000
kill -9 <PID>
```

### Database Connection Error

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check connection
docker-compose exec postgres pg_isready
```

### Docker Build Fails

```bash
# Clear Docker cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache
```

---

## Next Steps

1. Configure SSL/HTTPS
2. Set up CDN for static assets
3. Configure monitoring (Sentry, Prometheus)
4. Set up database backups
5. Configure email notifications

For detailed documentation, see [DEPLOYMENT.md](./DEPLOYMENT.md).
