# ShopNx Production Deployment Guide

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Docker Deployment](#docker-deployment)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Environment Management](#environment-management)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Scaling Strategy](#scaling-strategy)
8. [Monitoring & Observability](#monitoring--observability)
9. [Security Checklist](#security-checklist)
10. [Troubleshooting](#troubleshooting)

---

## Architecture Overview

### High-Level Architecture

```
                          ┌─────────────────────────────────────────────────────────┐
                          │                    CDN (CloudFlare)                     │
                          │         Static Assets, Images, Edge Caching            │
                          └─────────────────────────────────────────────────────────┘
                                                       │
                                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                  Load Balancer / Ingress                            │
│                              (nginx-ingress / ALB / CloudFlare)                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
                    ▼                      ▼                      ▼
        ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
        │    Storefront     │  │      Admin        │  │       API         │
        │   (Next.js SSR)   │  │  (Next.js SSR)    │  │    (NestJS)       │
        │   Port: 3000      │  │   Port: 3001      │  │   Port: 3002      │
        │   Replicas: 2-10  │  │   Replicas: 1-3   │  │   Replicas: 2-10  │
        └───────────────────┘  └───────────────────┘  └───────────────────┘
                    │                      │                      │
                    └──────────────────────┼──────────────────────┘
                                           │
                    ┌──────────────────────┼──────────────────────┐
                    │                      │                      │
                    ▼                      ▼                      ▼
        ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐
        │    PostgreSQL     │  │      Redis        │  │   Object Storage  │
        │   (Primary +      │  │   (Cluster Mode)  │  │   (S3/GCS/R2)     │
        │    Read Replica)  │  │                   │  │                   │
        └───────────────────┘  └───────────────────┘  └───────────────────┘
```

### Container Images

| Service | Base Image | Size (Compressed) |
|---------|------------|-------------------|
| API | oven/bun:1-slim | ~150MB |
| Storefront | oven/bun:1-slim | ~120MB |
| Admin | oven/bun:1-slim | ~120MB |

---

## Prerequisites

### Required Tools

| Tool | Version | Purpose |
|------|---------|---------|
| Docker | 24.0+ | Container runtime |
| Docker Compose | 2.20+ | Local orchestration |
| kubectl | 1.28+ | Kubernetes CLI |
| Helm | 3.12+ | Package manager |
| Bun | 1.0+ | Runtime |

### Infrastructure Requirements

| Environment | CPU | Memory | Storage | Services |
|-------------|-----|--------|---------|----------|
| Development | 2 cores | 4GB | 20GB | SQLite, Local |
| Staging | 4 cores | 8GB | 50GB | PostgreSQL, Redis |
| Production | 8+ cores | 16GB+ | 100GB+ SSD | PostgreSQL HA, Redis Cluster |

---

## Docker Deployment

### Quick Start (Local Development)

```bash
# Start infrastructure (PostgreSQL, Redis)
docker-compose -f docker-compose.dev.yml up -d

# Run applications locally
bun install
bun run db:push
bun run dev:all
```

### Production Docker Compose

```bash
# Build and deploy all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Scale services
docker-compose up -d --scale api=3 --scale storefront=3
```

### Container Registry

Images are published to GitHub Container Registry:

```bash
# Pull images
docker pull ghcr.io/shopnx/shopnx/api:latest
docker pull ghcr.io/shopnx/shopnx/storefront:latest
docker pull ghcr.io/shopnx/shopnx/admin:latest
```

---

## Kubernetes Deployment

### Deploy with Kustomize

```bash
# Staging
kubectl apply -k k8s/overlays/staging

# Production
kubectl apply -k k8s/overlays/production
```

### Deploy with Helm (Alternative)

```bash
# Add required Helm repos
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add nginx-ingress https://kubernetes.github.io/ingress-nginx

# Install ingress controller
helm install nginx-ingress nginx-ingress/ingress-nginx \
  --namespace ingress-nginx --create-namespace

# Deploy application
helm upgrade --install shopnx ./helm \
  -f helm/values-production.yaml \
  --namespace shopnx-production --create-namespace
```

### Required Kubernetes Resources

```bash
# Create namespace
kubectl create namespace shopnx-production

# Create secrets (use external-secrets-operator in production)
kubectl create secret generic shopnx-secrets \
  --from-literal=database-url='postgresql://...' \
  --from-literal=redis-url='redis://...' \
  --from-literal=jwt-secret='...' \
  --from-literal=jwt-refresh-secret='...' \
  -n shopnx-production
```

---

## Environment Management

### Secrets Management Strategy

| Environment | Secrets Solution | Notes |
|-------------|------------------|-------|
| Development | .env file | Local development only |
| Staging | GitHub Actions Secrets + K8s Secrets | Encrypted at rest |
| Production | HashiCorp Vault / AWS Secrets Manager | Auto-rotation enabled |

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db?schema=public
DATABASE_READ_REPLICA_URL=postgresql://user:pass@replica:5432/db?schema=public

# Redis
REDIS_URL=redis://:password@host:6379

# JWT Authentication
JWT_SECRET=<256-bit-secret>
JWT_REFRESH_SECRET=<256-bit-secret>
JWT_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Web Push (VAPID)
VAPID_PUBLIC_KEY=<public-key>
VAPID_PRIVATE_KEY=<private-key>
VAPID_SUBJECT=mailto:admin@shopnx.com

# Frontend URLs
NEXT_PUBLIC_API_URL=https://api.shopnx.com/api/v1
NEXT_PUBLIC_APP_URL=https://shopnx.com
```

### Generate Secure Secrets

```bash
# Generate JWT secrets (256-bit)
openssl rand -base64 32

# Generate VAPID keys
npx web-push generate-vapid-keys
```

---

## CI/CD Pipeline

### Pipeline Stages

```
┌──────────┐   ┌──────────────┐   ┌──────────┐   ┌───────────┐   ┌──────────┐
│   Lint   │──▶│  Type Check  │──▶│   Test   │──▶│   Build   │──▶│  Docker  │──▶ Deploy
└──────────┘   └──────────────┘   └──────────┘   └───────────┘   └──────────┘
    │                  │                │               │               │
    └──────────────────┴────────────────┴───────────────┴───────────────┘
                              All must pass before proceeding
```

### Trigger Workflows

| Event | Branch | Stages |
|-------|--------|--------|
| Pull Request | any | Lint, Type Check, Test, Build |
| Push | develop | Full pipeline + Docker + Staging Deploy |
| Push | main | Full pipeline + Docker + Production Deploy |
| Manual | - | Production Deploy |

### Manual Deployment

```bash
# Trigger via GitHub UI or CLI
gh workflow run ci-cd.yml -f environment=production
```

---

## Scaling Strategy

### Horizontal Scaling

| Service | Min Replicas | Max Replicas | Scaling Trigger |
|---------|--------------|--------------|-----------------|
| API | 2 | 10 | CPU > 70%, Memory > 80% |
| Storefront | 2 | 10 | CPU > 70% |
| Admin | 1 | 3 | CPU > 70% |

### Database Scaling

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                       │
│                 (Read/Write Split via Prisma)               │
└─────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
          ▼                               ▼
┌─────────────────────┐       ┌─────────────────────┐
│      Primary        │       │    Read Replica     │
│   (Write + Read)    │──────▶│     (Read Only)     │
│                     │       │                     │
└─────────────────────┘       └─────────────────────┘
```

### CDN Strategy

| Content Type | CDN Location | TTL | Cache Strategy |
|--------------|--------------|-----|----------------|
| Static Assets (`/_next/static`) | Edge | 1 year | Immutable |
| Product Images | CDN | 30 days | Stale-while-revalidate |
| PWA Manifest | Edge | 1 hour | No-cache fallback |
| API Responses | Redis | 5 min | Stale-while-revalidate |

### Caching Headers

```
# Static assets
Cache-Control: public, max-age=31536000, immutable

# HTML pages
Cache-Control: public, max-age=0, must-revalidate

# API responses (cacheable)
Cache-Control: public, max-age=300, stale-while-revalidate=60
```

---

## Monitoring & Observability

### Recommended Stack

| Component | Tool | Purpose |
|-----------|------|---------|
| Metrics | Prometheus + Grafana | Infrastructure & app metrics |
| Logging | Loki + Grafana | Centralized logging |
| Tracing | Jaeger / Zipkin | Distributed tracing |
| Errors | Sentry | Error tracking |
| Uptime | Uptime Robot / Pingdom | External monitoring |

### Health Endpoints

```bash
# API Health
GET /api/v1/health
Response: { "status": "ok", "timestamp": "...", "version": "1.0.0" }

# Storefront / Admin
GET /
Response: 200 OK
```

### Key Metrics to Monitor

| Metric | Alert Threshold |
|--------|-----------------|
| CPU Usage | > 80% for 5min |
| Memory Usage | > 85% for 5min |
| Response Time (p99) | > 500ms |
| Error Rate | > 1% |
| Database Connections | > 80% of pool |

---

## Security Checklist

### Pre-Deployment

- [ ] All secrets stored in secrets manager
- [ ] HTTPS enabled with valid certificates
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Input validation on all endpoints
- [ ] JWT tokens have appropriate expiration
- [ ] Database backups configured
- [ ] CORS configured correctly

### Container Security

- [ ] Images scanned for vulnerabilities
- [ ] Running as non-root user
- [ ] No sensitive data in image layers
- [ ] Minimal base images used

### Runtime Security

- [ ] Network policies configured
- [ ] RBAC enabled in Kubernetes
- [ ] Secrets rotation schedule
- [ ] Audit logging enabled

---

## Troubleshooting

### Common Issues

#### Database Connection Failed

```bash
# Check database connectivity
kubectl exec -it deployment/api -- nc -zv postgres 5432

# Check connection string
kubectl get secret shopnx-secrets -o jsonpath='{.data.database-url}' | base64 -d
```

#### High Memory Usage

```bash
# Check container metrics
kubectl top pods

# View memory profile
kubectl exec -it deployment/api -- curl localhost:3002/debug/pprof/heap
```

#### PWA Not Working

```bash
# Check service worker registration
curl -I https://shopnx.com/sw.js
# Should return: Service-Worker-Allowed: /

# Check manifest
curl https://shopnx.com/manifest.json | jq
```

### Useful Commands

```bash
# View logs
kubectl logs -f deployment/api -n shopnx-production

# Check pod status
kubectl get pods -n shopnx-production

# Execute into container
kubectl exec -it deployment/api -- /bin/sh

# Port forward for debugging
kubectl port-forward svc/api 3002:3002 -n shopnx-production
```

---

## Quick Reference

### Ports

| Service | Port | Description |
|---------|------|-------------|
| Storefront | 3000 | E-commerce storefront |
| Admin | 3001 | Admin dashboard |
| API | 3002 | REST API |
| PostgreSQL | 5432 | Database |
| Redis | 6379 | Cache |

### NPM Scripts

```bash
bun run dev           # Start storefront
bun run dev:admin     # Start admin
bun run dev:api       # Start API
bun run build         # Build all
bun run lint          # Run ESLint
bun run test          # Run tests
bun run docker:dev    # Start Docker dev
```

### Useful Links

- [Next.js Documentation](https://nextjs.org/docs)
- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Kubernetes Documentation](https://kubernetes.io/docs)
