# ShopNx Scaling Strategy

## Overview

This document outlines the scaling strategy for the ShopNx e-commerce platform, covering horizontal scaling, database optimization, CDN configuration, and caching strategies.

---

## Architecture for Scale

```
                                    ┌─────────────────────────────────────┐
                                    │           CDN Layer                 │
                                    │   (CloudFlare / CloudFront)        │
                                    │   - Static assets caching           │
                                    │   - Edge caching                    │
                                    │   - DDoS protection                 │
                                    └─────────────────────────────────────┘
                                                    │
                                    ┌─────────────────────────────────────┐
                                    │        Load Balancer Layer          │
                                    │   (nginx / ALB / CloudFlare)        │
                                    │   - SSL termination                 │
                                    │   - Rate limiting                   │
                                    │   - Health checks                   │
                                    └─────────────────────────────────────┘
                                                    │
                    ┌───────────────────────────────┼───────────────────────────────┐
                    │                               │                               │
                    ▼                               ▼                               ▼
        ┌─────────────────────┐       ┌─────────────────────┐       ┌─────────────────────┐
        │   Storefront (x3)   │       │     Admin (x2)      │       │      API (x5)       │
        │   Next.js SSR       │       │   Next.js SSR       │       │     NestJS          │
        │   Auto-scaling      │       │   Auto-scaling      │       │   Auto-scaling      │
        └─────────────────────┘       └─────────────────────┘       └─────────────────────┘
                    │                               │                               │
                    └───────────────────────────────┼───────────────────────────────┘
                                                    │
                    ┌───────────────────────────────┼───────────────────────────────┐
                    │                               │                               │
                    ▼                               ▼                               ▼
        ┌─────────────────────┐       ┌─────────────────────┐       ┌─────────────────────┐
        │   PostgreSQL        │       │       Redis         │       │   Object Storage    │
        │   Primary +         │       │    Cluster Mode     │       │   (S3 / GCS / R2)   │
        │   Read Replicas     │       │                     │       │                     │
        └─────────────────────┘       └─────────────────────┘       └─────────────────────┘
```

---

## Horizontal Scaling

### Application Tier

#### API Service (NestJS)

```yaml
# Recommended configuration
replicas:
  min: 2
  max: 10
  target: 3

autoscaling:
  metrics:
    - type: cpu
      target: 70%
    - type: memory
      target: 80%
    - type: http_requests
      target: 1000 per second

resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 1000m
    memory: 512Mi
```

**Key Design Principles:**
- Stateless design - no local state
- JWT tokens - no server-side sessions
- Redis for distributed caching
- Database connection pooling

#### Storefront (Next.js)

```yaml
# Recommended configuration
replicas:
  min: 2
  max: 10
  target: 3

autoscaling:
  metrics:
    - type: cpu
      target: 70%

resources:
  requests:
    cpu: 250m
    memory: 256Mi
  limits:
    cpu: 500m
    memory: 512Mi
```

**Optimization Strategies:**
- ISR (Incremental Static Regeneration) for product pages
- Edge caching for static assets
- Image optimization with Next.js Image component

#### Admin Panel (Next.js)

```yaml
# Recommended configuration
replicas:
  min: 1
  max: 3
  target: 2

resources:
  requests:
    cpu: 100m
    memory: 256Mi
  limits:
    cpu: 300m
    memory: 512Mi
```

---

## Database Scaling

### PostgreSQL Optimization

#### Connection Pooling

```typescript
// Prisma configuration
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  
  // Connection pooling
  relationMode = "prisma"
}

// Database URL with pooling
// postgresql://user:pass@host:5432/db?pgbouncer=true&connection_limit=20
```

#### Read Replicas

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                        │
│                  (Prisma Client)                            │
└─────────────────────────────────────────────────────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
          ▼                               ▼
┌─────────────────────┐       ┌─────────────────────┐
│      PRIMARY        │       │    READ REPLICA     │
│   (Write + Read)    │──────▶│     (Read Only)     │
│                     │       │                     │
│  host: db-primary   │       │  host: db-replica   │
│  port: 5432         │       │  port: 5432         │
└─────────────────────┘       └─────────────────────┘
```

**Implementation:**

```typescript
// prisma/schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")           // Primary
  directUrl = env("DATABASE_DIRECT_URL")    // Direct connection for migrations
}

// Read from replica in application code
const prismaRead = new PrismaClient({
  datasources: {
    db: { url: process.env.DATABASE_READ_REPLICA_URL }
  }
})
```

#### Database Configuration

```sql
-- PostgreSQL tuning for production
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '768MB';
ALTER SYSTEM SET maintenance_work_mem = '64MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET wal_buffers = '16MB';
ALTER SYSTEM SET default_statistics_target = 100;
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET effective_io_concurrency = 200;
ALTER SYSTEM SET work_mem = '2621kB';
ALTER SYSTEM SET min_wal_size = '1GB';
ALTER SYSTEM SET max_wal_size = '4GB';
```

### Index Strategy

```sql
-- Critical indexes for performance

-- Products
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active) WHERE is_active = true;
CREATE INDEX idx_products_featured ON products(is_featured) WHERE is_featured = true;
CREATE INDEX idx_products_search ON products USING gin(to_tsvector('english', name || ' ' || description));

-- Orders
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_customer ON orders(customer_id);

-- Full-text search
CREATE INDEX idx_categories_search ON categories USING gin(to_tsvector('english', name));
```

---

## Caching Strategy

### Redis Caching

```typescript
// Cache configuration
const CACHE_CONFIG = {
  // Product data - short TTL for freshness
  products: {
    ttl: 300, // 5 minutes
    staleWhileRevalidate: 60, // 1 minute
  },
  
  // Categories - longer TTL, changes less frequently
  categories: {
    ttl: 3600, // 1 hour
    staleWhileRevalidate: 300, // 5 minutes
  },
  
  // User sessions
  sessions: {
    ttl: 86400, // 24 hours
  },
  
  // Rate limiting
  rateLimit: {
    ttl: 60, // 1 minute window
  },
};

// Cache key patterns
const CACHE_KEYS = {
  product: (id: string) => `product:${id}`,
  products: (page: number) => `products:page:${page}`,
  categories: () => 'categories:all',
  category: (id: string) => `category:${id}`,
};
```

### CDN Configuration

#### CloudFlare Page Rules

| Pattern | Setting | Value |
|---------|---------|-------|
| `shopnx.com/_next/static/*` | Cache Level | Cache Everything |
| `shopnx.com/_next/static/*` | Edge Cache TTL | 1 year |
| `shopnx.com/images/*` | Cache Level | Cache Everything |
| `shopnx.com/images/*` | Edge Cache TTL | 30 days |
| `shopnx.com/api/*` | Cache Level | Bypass |
| `shopnx.com/sw.js` | Cache Level | Bypass |

#### Cache Headers

```nginx
# Static assets - immutable, 1 year
location /_next/static {
    add_header Cache-Control "public, max-age=31536000, immutable";
}

# Images - cache with revalidation
location /images {
    add_header Cache-Control "public, max-age=2592000, stale-while-revalidate=86400";
}

# API responses - short cache
location /api/v1/products {
    add_header Cache-Control "public, max-age=300, stale-while-revalidate=60";
}

# PWA service worker - no cache
location /sw.js {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}
```

---

## Performance Targets

### Response Time SLAs

| Endpoint | Target (p50) | Target (p99) |
|----------|--------------|--------------|
| Homepage | < 200ms | < 500ms |
| Product page | < 150ms | < 300ms |
| Category page | < 150ms | < 300ms |
| API GET | < 100ms | < 200ms |
| API POST | < 200ms | < 400ms |
| Checkout | < 300ms | < 600ms |

### Throughput Targets

| Metric | Target | Peak Capacity |
|--------|--------|---------------|
| Concurrent Users | 1,000 | 5,000 |
| Requests/second | 500 | 2,000 |
| Orders/hour | 1,000 | 5,000 |

### Availability

- **Uptime SLA:** 99.9% (8.76 hours downtime/year)
- **Recovery Time Objective (RTO):** 15 minutes
- **Recovery Point Objective (RPO):** 5 minutes

---

## Monitoring for Scale

### Key Metrics

```yaml
# Prometheus alerts
groups:
  - name: shopnx-scaling
    rules:
      - alert: HighCPUUsage
        expr: container_cpu_usage_seconds_total{container="api"} > 0.8
        for: 5m
        annotations:
          summary: "High CPU usage on API"
          
      - alert: HighMemoryUsage
        expr: container_memory_working_set_bytes{container="api"} / container_spec_memory_limit_bytes{container="api"} > 0.85
        for: 5m
        annotations:
          summary: "High memory usage on API"
          
      - alert: HighResponseTime
        expr: histogram_quantile(0.99, http_request_duration_seconds_bucket) > 0.5
        for: 2m
        annotations:
          summary: "High response time (p99 > 500ms)"
          
      - alert: DatabaseConnectionsHigh
        expr: pg_stat_activity_count > 150
        for: 2m
        annotations:
          summary: "Database connection pool nearly exhausted"
```

### Dashboards

- **Application Dashboard:** Request rate, latency, error rate
- **Infrastructure Dashboard:** CPU, memory, network, disk
- **Database Dashboard:** Connections, queries, slow queries
- **Cache Dashboard:** Hit rate, memory usage, evictions

---

## Scaling Triggers

### Scale Up When

- CPU usage > 70% for 5 minutes
- Memory usage > 80% for 5 minutes
- Response time p99 > 400ms
- Request queue depth > 100

### Scale Down When

- CPU usage < 30% for 15 minutes
- Memory usage < 50% for 15 minutes
- Response time p99 < 100ms
- All services healthy with minimal load

---

## Cost Optimization

### Right-Sizing Instances

| Service | Development | Staging | Production |
|---------|-------------|---------|------------|
| API | 0.5 CPU, 512MB | 1 CPU, 1GB | 2 CPU, 2GB |
| Storefront | 0.5 CPU, 512MB | 1 CPU, 1GB | 1 CPU, 2GB |
| Admin | 0.25 CPU, 512MB | 0.5 CPU, 1GB | 0.5 CPU, 1GB |
| PostgreSQL | 1 CPU, 2GB | 2 CPU, 4GB | 4 CPU, 8GB |
| Redis | 0.5 CPU, 1GB | 1 CPU, 2GB | 2 CPU, 4GB |

### Cost Reduction Strategies

1. **Use Spot/Preemptible instances** for non-critical workloads
2. **Enable auto-scaling** to scale down during low traffic
3. **Use CDN** to reduce origin server load
4. **Implement caching** to reduce database queries
5. **Optimize images** to reduce bandwidth costs
