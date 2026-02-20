# ShopNx Deployment Checklist

## Pre-Deployment Checklist

### 1. Code Quality

- [ ] All tests passing (`bun run test`)
- [ ] Linting passes (`bun run lint`)
- [ ] Type checking passes (`bun run typecheck`)
- [ ] No security vulnerabilities (`bun audit`)
- [ ] Build succeeds (`bun run build`)

### 2. Environment Variables

#### Required Secrets

| Secret | Description | Generate Command |
|--------|-------------|------------------|
| `JWT_SECRET` | JWT signing key (256-bit) | `openssl rand -base64 32` |
| `JWT_REFRESH_SECRET` | Refresh token key | `openssl rand -base64 32` |
| `DATABASE_URL` | PostgreSQL connection string | - |
| `REDIS_URL` | Redis connection string | - |
| `VAPID_PUBLIC_KEY` | Web push public key | `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | Web push private key | `npx web-push generate-vapid-keys` |

#### Environment-Specific Variables

- [ ] Development: `.env` configured
- [ ] Staging: Secrets stored in CI/CD or orchestration platform
- [ ] Production: Secrets stored in secrets manager (Vault, AWS Secrets Manager, etc.)

### 3. Infrastructure

- [ ] PostgreSQL database provisioned
- [ ] Redis instance provisioned
- [ ] SSL certificates obtained
- [ ] CDN configured (optional but recommended)
- [ ] DNS records configured

### 4. Security

- [ ] HTTPS enforced
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] CORS configured correctly
- [ ] Database backups configured
- [ ] Secrets not in code repository

### 5. Monitoring

- [ ] Health check endpoints accessible
- [ ] Logging configured
- [ ] Error tracking enabled (Sentry)
- [ ] Uptime monitoring configured

---

## Deployment Steps

### Option A: Docker Compose (VPS/Single Server)

```bash
# 1. Clone repository
git clone https://github.com/your-org/shopnx.git
cd shopnx

# 2. Create environment file
cp .env.example .env
# Edit .env with production values

# 3. Build and deploy
bun run docker:build
bun run docker:up

# 4. Run database migrations
docker-compose exec api bun run db:migrate:deploy

# 5. Seed database (first deployment only)
docker-compose exec api bun run db:seed

# 6. Verify deployment
curl http://localhost:3000/
curl http://localhost:3001/
curl http://localhost:3002/api/v1/health
```

### Option B: Kubernetes (Production)

```bash
# 1. Configure kubectl
kubectl config use-context production-cluster

# 2. Create namespace
kubectl create namespace shopnx-production

# 3. Create secrets
kubectl create secret generic shopnx-secrets \
  --from-literal=database-url='postgresql://...' \
  --from-literal=redis-url='redis://...' \
  --from-literal=jwt-secret='...' \
  --from-literal=jwt-refresh-secret='...' \
  -n shopnx-production

# 4. Deploy with Kustomize
kubectl apply -k k8s/overlays/production

# 5. Verify deployment
kubectl get pods -n shopnx-production
kubectl get services -n shopnx-production
kubectl get ingress -n shopnx-production

# 6. Check logs
kubectl logs -f deployment/api -n shopnx-production
```

### Option C: CI/CD Pipeline (Recommended)

1. Push code to `main` branch
2. GitHub Actions will automatically:
   - Run lint and type checks
   - Run tests
   - Build Docker images
   - Push to container registry
   - Deploy to staging/production

---

## Post-Deployment Verification

### Health Checks

```bash
# API Health
curl https://api.shopnx.com/api/v1/health
# Expected: {"status":"ok","timestamp":"..."}

# Storefront
curl -I https://shopnx.com/
# Expected: HTTP/2 200

# Admin
curl -I https://admin.shopnx.com/
# Expected: HTTP/2 200
```

### Functional Tests

- [ ] User can browse products
- [ ] User can add items to cart
- [ ] User can create order
- [ ] Admin can login
- [ ] Admin can manage products
- [ ] PWA install prompt appears (mobile)

### Performance Checks

```bash
# Response time (should be < 500ms)
curl -w "@curl-format.txt" -o /dev/null -s https://shopnx.com/

# Lighthouse score (should be > 90)
npx lighthouse https://shopnx.com/ --output html --output-path lighthouse.html
```

---

## Rollback Procedure

### Docker Compose Rollback

```bash
# 1. Pull previous image version
docker pull ghcr.io/shopnx/shopnx/api:PREVIOUS_SHA

# 2. Update docker-compose with previous version
# Edit image tag in docker-compose.prod.yml

# 3. Restart services
bun run docker:down
bun run docker:up
```

### Kubernetes Rollback

```bash
# 1. List deployment history
kubectl rollout history deployment/api -n shopnx-production

# 2. Rollback to previous version
kubectl rollout undo deployment/api -n shopnx-production

# 3. Or rollback to specific revision
kubectl rollout undo deployment/api --to-revision=2 -n shopnx-production

# 4. Verify rollback
kubectl rollout status deployment/api -n shopnx-production
```

---

## Common Issues & Solutions

### Database Connection Failed

**Symptoms:** API crashes, connection timeout errors

**Solution:**
```bash
# Check database is accessible
kubectl exec -it deployment/api -- nc -zv postgres 5432

# Verify connection string
kubectl get secret shopnx-secrets -o jsonpath='{.data.database-url}' | base64 -d

# Check database credentials
psql $DATABASE_URL -c "SELECT 1"
```

### Redis Connection Failed

**Symptoms:** Session errors, cache misses

**Solution:**
```bash
# Test Redis connection
redis-cli -h redis-host ping

# Check Redis auth
redis-cli -h redis-host -a password ping
```

### High Memory Usage

**Symptoms:** OOMKilled pods, slow responses

**Solution:**
```bash
# Check memory usage
kubectl top pods -n shopnx-production

# Increase memory limits in deployment
kubectl patch deployment api -p '{"spec":{"template":{"spec":{"containers":[{"name":"api","resources":{"limits":{"memory":"1Gi"}}}]}}}}'
```

### SSL Certificate Issues

**Symptoms:** Browser warnings, HTTPS not working

**Solution:**
```bash
# Check certificate
kubectl get certificate -n shopnx-production

# Check cert-manager logs
kubectl logs -n cert-manager deployment/cert-manager

# Force certificate renewal
kubectl renew certificate shopnx-tls -n shopnx-production
```

---

## Deployment Contacts

| Role | Contact | Responsibility |
|------|---------|----------------|
| DevOps Lead | devops@shopnx.com | Infrastructure |
| Backend Lead | backend@shopnx.com | API issues |
| Frontend Lead | frontend@shopnx.com | Storefront/Admin issues |
| SRE | sre@shopnx.com | Production incidents |

---

## Emergency Procedures

### Production Incident

1. **Assess Impact** - Is the site down or degraded?
2. **Communicate** - Alert team in #incidents channel
3. **Mitigate** - Rollback if needed
4. **Investigate** - Check logs and metrics
5. **Resolve** - Apply fix
6. **Post-mortem** - Document and learn

### Emergency Contacts

- **On-call Engineer:** +1-xxx-xxx-xxxx
- **Incident Commander:** @incident-commander
- **Status Page:** https://status.shopnx.com
