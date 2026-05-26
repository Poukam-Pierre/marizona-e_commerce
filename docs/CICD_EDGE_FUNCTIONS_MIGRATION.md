# CI/CD Migration: Docker/VM → Supabase Edge Functions

**Version:** 1.0  
**Date:** May 26, 2026  
**Status:** Planning Phase  
**Scope:** Replace Docker-based API deployment with Supabase Edge Functions deployment via GitHub Actions

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current CI/CD Architecture](#current-cicd-architecture)
3. [Target Serverless CI/CD Architecture](#target-serverless-cicd-architecture)
4. [Migration Strategy](#migration-strategy)
5. [Implementation Plan](#implementation-plan)
6. [GitHub Actions Workflow](#github-actions-workflow)
7. [Environment Variables & Secrets](#environment-variables--secrets)
8. [Supabase Directory Structure](#supabase-directory-structure)
9. [Rollout Plan](#rollout-plan)
10. [Troubleshooting](#troubleshooting)

---

## Executive Summary

This document outlines the migration from **Docker container-based API deployment** (OCI VM via SSH) to **Supabase Edge Functions deployment** via GitHub Actions. This migration enables:

- ✅ **Serverless Delivery**: No VM management, scaling, or container orchestration
- ✅ **Simplified CI/CD**: Direct function deployment via Supabase CLI instead of Docker build/push/pull
- ✅ **Faster Deployments**: No Docker image builds (5-10 min) or SSH connection overhead
- ✅ **Cost Reduction**: No dedicated VM costs for API hosting
- ✅ **Global Distribution**: Supabase Edge Functions deploy to edge locations automatically
- ✅ **Zero Downtime**: Atomic function deployments with instant rollback capability

### Why This Migration is Necessary

| Aspect                | Current (Docker/VM)                        | Target (Edge Functions)               |
| --------------------- | ------------------------------------------ | ------------------------------------- |
| **Deployment Time**   | ~10-15 min (build + push + pull + restart) | ~2-3 min (CLI deploy)                 |
| **Infrastructure**    | OCI VM + Docker + SSH keys                 | Supabase managed                      |
| **Scaling**           | Manual VM resize or load balancer          | Automatic edge scaling                |
| **Rollback**          | Re-deploy old image + container restart    | Instant version switch                |
| **Cost**              | VM instance + bandwidth                    | Pay-per-invocation                    |
| **Build Artifacts**   | Docker images in GHCR                      | TypeScript source in repo             |
| **Deployment Method** | SSH + Docker commands                      | `supabase functions deploy`           |
| **CI/CD Complexity**  | 4 jobs (lint, test, docker, deploy)        | 3 jobs (lint, test, deploy-functions) |

### Critical Changes

⚠️ **IMPORTANT**: This migration **removes** the following from the CI/CD pipeline:

- Docker build job for API
- GHCR image push for API
- OCI VM SSH deployment
- API container management

The migration **retains** the following:

- Lint, typecheck, and test jobs
- Frontend builds (Storefront + Admin)
- Vercel deployment hooks for web apps

---

## Current CI/CD Architecture

### Pipeline Overview

**File**: `.github/workflows/ci-cd.yml`

**Current Jobs**:

1. **lint** — ESLint validation across all projects
2. **typecheck** — TypeScript compilation checks (includes `db:generate` for Prisma)
3. **test** — Jest tests with PostgreSQL + Redis service containers
4. **build** — Nx builds for API, Storefront, and Admin
5. **docker** — Builds and pushes 3 Docker images to GHCR:
   - `ghcr.io/<org>/shoppk/api`
   - `ghcr.io/<org>/shoppk/storefront`
   - `ghcr.io/<org>/shoppk/admin`
6. **deploy-staging** — Deploys to staging (currently placeholder)
7. **deploy-production** — Two-phase deployment:
   - SSH to OCI VM and run API Docker container
   - Trigger Vercel deploy hooks for Storefront + Admin

### Current API Deployment Flow

```yaml
deploy-production:
  steps:
    - name: Deploy API to OCI Server
      uses: appleboy/ssh-action@v1.0.0
      with:
        host: ${{ secrets.OCI_HOST }}
        username: ubuntu
        key: ${{ secrets.OCI_SSH_PRIVATE_KEY }}
        script: |
          docker login ghcr.io -u ${{ github.actor }} --password-stdin
          docker pull ghcr.io/${{ github.repository_owner }}/shoppk/api:latest
          docker stop shoppk-api || true
          docker rm shoppk-api || true
          docker run -d \
            --name shoppk-api \
            --restart unless-stopped \
            --network host \
            -e DATABASE_URL="${{ secrets.SUPABASE_DATABASE_URL }}" \
            -e REDIS_URL="redis://localhost:6379" \
            -e JWT_SECRET="${{ secrets.JWT_SECRET }}" \
            ghcr.io/${{ github.repository_owner }}/shoppk/api:latest

    - name: Trigger Vercel Storefront Deploy
      run: curl -X POST "${{ secrets.VERCEL_STOREFRONT_DEPLOY_HOOK }}"

    - name: Trigger Vercel Admin Deploy
      run: curl -X POST "${{ secrets.VERCEL_ADMIN_DEPLOY_HOOK }}"
```

### Current Secrets Used

**GitHub Actions Secrets**:

- `OCI_HOST` — OCI VM IP address
- `OCI_SSH_PRIVATE_KEY` — SSH private key for VM access
- `GHCR_PAT` — GitHub Container Registry personal access token
- `SUPABASE_DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — NestJS JWT signing key
- `JWT_REFRESH_SECRET` — Refresh token key
- `VERCEL_STOREFRONT_DEPLOY_HOOK` — Vercel webhook URL
- `VERCEL_ADMIN_DEPLOY_HOOK` — Vercel webhook URL

### Pain Points Identified

1. **Long Build Times**: Docker multi-stage builds take 8-12 minutes
2. **Deployment Complexity**: SSH authentication + Docker commands prone to failures
3. **No Atomic Rollback**: Requires re-deploying old image and restarting container
4. **Manual Scaling**: VM must be manually resized for traffic spikes
5. **Single Point of Failure**: One VM instance, no built-in redundancy
6. **Configuration Drift**: Environment variables managed in multiple places

---

## Target Serverless CI/CD Architecture

### New Pipeline Overview

**Simplified Jobs**:

1. **lint** — ESLint (unchanged)
2. **typecheck** — TypeScript checks (unchanged)
3. **test** — Jest tests (keep for frontend/libs, deprecate API tests)
4. **build-frontend** — Nx builds for Storefront + Admin only
5. **deploy-functions** — Deploy Edge Functions via Supabase CLI (new!)
6. **deploy-frontend** — Trigger Vercel hooks (unchanged)

### Edge Function Deployment Flow

```yaml
deploy-functions:
  name: Deploy Edge Functions
  runs-on: ubuntu-latest
  needs: [lint, typecheck, test]
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  environment:
    name: production
    url: https://${{ secrets.SUPABASE_PROJECT_ID }}.supabase.co
  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
      with:
        bun-version: '1'

    - name: Install dependencies
      run: bun install --frozen-lockfile

    - name: Setup Supabase CLI
      uses: supabase/setup-cli@v1
      with:
        version: latest

    - name: Deploy Edge Functions
      run: |
        supabase functions deploy \
          --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
      env:
        SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

    - name: Verify Deployment
      run: |
        supabase functions list \
          --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
```

### Architecture Benefits

| Feature                    | Implementation                                              |
| -------------------------- | ----------------------------------------------------------- |
| **Authentication**         | Supabase CLI uses personal access token (secure, revocable) |
| **Deployment Speed**       | ~2-3 minutes (no Docker build)                              |
| **Rollback**               | `supabase functions deploy --version <previous>`            |
| **Environment Separation** | Separate Supabase projects for staging/production           |
| **Secrets Management**     | Supabase dashboard + `supabase secrets set`                 |
| **Monitoring**             | Supabase dashboard logs + metrics                           |
| **Cost Model**             | Pay-per-invocation (free tier: 500k requests/month)         |

---

## Migration Strategy

### Phase Overview

| Phase                    | Duration | Focus                  | Deliverables                          |
| ------------------------ | -------- | ---------------------- | ------------------------------------- |
| 1. Supabase Structure    | Week 1   | Create monorepo layout | `supabase/` directory, config         |
| 2. Update CI/CD Workflow | Week 1   | Simplify pipeline      | Updated `.github/workflows/ci-cd.yml` |
| 3. GitHub Secrets Setup  | Week 1   | Configure credentials  | Supabase tokens in GitHub             |
| 4. Remove Legacy Jobs    | Week 1   | Clean up Docker/SSH    | Simplified workflow                   |
| 5. Testing               | Week 2   | Validate deployments   | Smoke tests, rollback tests           |
| 6. Documentation         | Week 2   | Update runbooks        | Developer guide, ops guide            |

### Dependencies

This migration **depends on**:

- ✅ Supabase project provisioned (development + production)
- ✅ Edge Functions created in `supabase/functions/` directory
- ✅ SQL RPC functions deployed to Supabase database
- ✅ Supabase Auth configured (from AUTH_MIGRATION.md)
- ✅ Upstash Redis provisioned (from UPSTASH_MIGRATION.md)

This migration **is a prerequisite for**:

- Full retirement of NestJS API codebase
- Removal of `apps/api` from Nx workspace
- Decommissioning of OCI VM

---

## Implementation Plan

### Phase 1: Create Supabase Monorepo Structure (Week 1)

#### Step 1.1: Initialize Supabase Directory

**Objective**: Create the top-level Supabase workspace structure.

**Directory Structure**:

```
marizona/
├── supabase/
│   ├── functions/               # Edge Functions (Deno runtime)
│   │   ├── _shared/             # Shared helpers
│   │   │   ├── auth.ts          # Authentication middleware
│   │   │   ├── response.ts      # Standardized responses
│   │   │   ├── cors.ts          # CORS headers
│   │   │   ├── validation.ts    # Input validation
│   │   │   └── client.ts        # Supabase client factory
│   │   ├── health/              # Health check endpoint
│   │   │   └── index.ts
│   │   ├── products-list/       # Product listing
│   │   │   └── index.ts
│   │   ├── products-create/     # Product creation
│   │   │   └── index.ts
│   │   └── orders-create/       # Order creation
│   │       └── index.ts
│   ├── migrations/              # SQL migrations
│   │   └── 20260526_enable_realtime.sql
│   └── config.toml              # Local Supabase CLI config
├── apps/
│   ├── storefront/
│   ├── admin/
│   └── api/                     # To be deprecated
└── .github/
    └── workflows/
        └── ci-cd.yml            # Updated workflow
```

**Commands**:

```bash
# Create directory structure
mkdir -p supabase/functions/_shared
mkdir -p supabase/migrations

# Create config.toml
cat > supabase/config.toml << 'EOF'
# A string used to distinguish different Supabase projects on the same host.
project_id = "shoppk"

[api]
# Port to use for the API URL.
port = 54321
# Schemas to expose in your API. Tables, views and stored procedures in this schema will get API endpoints.
schemas = ["public", "storage", "graphql_public"]
# Extra schemas to add to the search_path of every request.
extra_search_path = ["public", "extensions"]
# The maximum number of rows returns from a view, table, or stored procedure.
max_rows = 1000

[db]
# Port to use for the local database URL.
port = 54322
# The database major version to use.
major_version = 15

[studio]
# Port to use for Supabase Studio.
port = 54323

[functions]
# Whether to verify JWT tokens for authenticated requests
verify_jwt = true
EOF
```

**Note**: The `config.toml` is for **local development only**. It does not contain secrets and is safe to commit.

**Deliverables**:

- [ ] `supabase/` directory created
- [ ] `supabase/functions/_shared/` exists
- [ ] `supabase/migrations/` exists
- [ ] `supabase/config.toml` created
- [ ] Directory structure committed to Git

---

#### Step 1.2: Add Shared Helper Modules

**Objective**: Create reusable Deno modules for Edge Functions.

**Example: Auth Helper**:

```typescript
// supabase/functions/_shared/auth.ts
import {
  createClient,
  SupabaseClient,
  User,
} from 'https://esm.sh/@supabase/supabase-js@2';

export enum AdminRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  VIEWER = 'VIEWER',
}

export interface AuthResult {
  user?: User;
  error?: string;
  status?: number;
}

export async function authenticate(
  req: Request,
  supabase: SupabaseClient,
): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return { error: 'Missing authorization header', status: 401 };
  }

  const token = authHeader.substring(7);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { error: 'Invalid or expired token', status: 401 };
  }

  return { user };
}

export function requireRole(
  user: User,
  minRole: AdminRole,
): { role?: AdminRole; error?: string; status?: number } {
  const userRole = user.app_metadata?.role as AdminRole | undefined;

  if (!userRole) {
    return { error: 'No role assigned', status: 403 };
  }

  const ROLE_LEVELS = {
    [AdminRole.SUPER_ADMIN]: 4,
    [AdminRole.ADMIN]: 3,
    [AdminRole.MANAGER]: 2,
    [AdminRole.VIEWER]: 1,
  };

  if (ROLE_LEVELS[userRole] < ROLE_LEVELS[minRole]) {
    return { error: 'Insufficient permissions', status: 403 };
  }

  return { role: userRole };
}
```

**Example: Response Helper**:

```typescript
// supabase/functions/_shared/response.ts
export function jsonResponse(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export function errorResponse(message: string, status = 400): Response {
  return jsonResponse({ error: message, statusCode: status }, status);
}

export function corsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
```

**Deliverables**:

- [ ] `supabase/functions/_shared/auth.ts` created
- [ ] `supabase/functions/_shared/response.ts` created
- [ ] `supabase/functions/_shared/cors.ts` created
- [ ] `supabase/functions/_shared/client.ts` created

---

#### Step 1.3: Create Health Check Function

**Objective**: Create a simple health check endpoint for deployment verification.

```typescript
// supabase/functions/health/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { jsonResponse, corsResponse } from '../_shared/response.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  return jsonResponse({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: Deno.env.get('FUNCTION_VERSION') || 'dev',
    runtime: 'Deno ' + Deno.version.deno,
  });
});
```

**Deliverables**:

- [ ] `supabase/functions/health/index.ts` created
- [ ] Function deployable locally: `supabase functions serve health`
- [ ] Health endpoint returns 200 OK

---

### Phase 2: Update CI/CD Workflow (Week 1)

#### Step 2.1: Remove Docker and VM Deployment Jobs

**Objective**: Simplify the workflow by removing Docker build and SSH deployment.

**File**: `.github/workflows/ci-cd.yml`

**Jobs to Remove**:

1. `docker` — Docker build and push for API, Storefront, Admin
2. `deploy-staging` — SSH deployment to staging VM
3. `deploy-production` (API portion) — SSH deployment to production VM

**Jobs to Keep**:

1. `lint` — ESLint (unchanged)
2. `typecheck` — TypeScript checks (unchanged)
3. `test` — Jest tests (unchanged)
4. `build` — Update to build frontend only

**Jobs to Add**:

1. `deploy-functions` — Deploy Edge Functions via Supabase CLI

---

#### Step 2.2: Update Build Job

**Before**:

```yaml
build:
  name: Build
  runs-on: ubuntu-latest
  needs: [test]
  steps:
    - name: Build API
      run: bunx nx build api --prod

    - name: Build Storefront
      run: bunx nx build storefront --prod

    - name: Build Admin
      run: bunx nx build admin --prod
```

**After**:

```yaml
build:
  name: Build Frontend
  runs-on: ubuntu-latest
  needs: [test]
  steps:
    # API build removed (no longer deploying via Docker)

    - name: Checkout
      uses: actions/checkout@v4

    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
      with:
        bun-version: '1'

    - name: Install dependencies
      run: bun install --frozen-lockfile

    - name: Build Storefront
      run: bunx nx build storefront --prod

    - name: Build Admin
      run: bunx nx build admin --prod

    - name: Upload build artifacts
      uses: actions/upload-artifact@v4
      with:
        name: frontend-builds
        path: |
          apps/storefront/.next/
          apps/admin/.next/
        retention-days: 1
```

---

#### Step 2.3: Add Supabase Functions Deployment Job

**New Job**:

```yaml
# ---------------------------------------------------------------------------
# Deploy Edge Functions to Supabase
# ---------------------------------------------------------------------------
deploy-functions:
  name: Deploy Edge Functions
  runs-on: ubuntu-latest
  needs: [lint, typecheck, test]
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
  environment:
    name: production
    url: https://${{ secrets.SUPABASE_PROJECT_ID }}.supabase.co
  steps:
    - name: Checkout
      uses: actions/checkout@v4

    - name: Setup Bun
      uses: oven-sh/setup-bun@v2
      with:
        bun-version: '1'

    - name: Install dependencies
      run: bun install --frozen-lockfile

    - name: Setup Supabase CLI
      uses: supabase/setup-cli@v1
      with:
        version: latest

    - name: Deploy Edge Functions
      run: |
        echo "Deploying Edge Functions to Supabase..."
        supabase functions deploy \
          --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
      env:
        SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

    - name: List Deployed Functions
      run: |
        supabase functions list \
          --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
      env:
        SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

    - name: Health Check
      run: |
        curl -f -X GET \
          "https://${{ secrets.SUPABASE_PROJECT_ID }}.supabase.co/functions/v1/health" \
          -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
          || (echo "Health check failed" && exit 1)
```

**Key Features**:

- ✅ Runs only on push to `main`
- ✅ Requires quality gates to pass first
- ✅ Uses GitHub environment for production
- ✅ Deploys all functions in `supabase/functions/`
- ✅ Verifies deployment with health check
- ✅ Fails CI if health check fails

---

#### Step 2.4: Update Frontend Deployment Job

**Before** (in `deploy-production`):

```yaml
deploy-production:
  steps:
    - name: Deploy API to OCI Server
      # ... SSH + Docker commands ...

    - name: Trigger Vercel Storefront Deploy
      run: curl -X POST "${{ secrets.VERCEL_STOREFRONT_DEPLOY_HOOK }}"

    - name: Trigger Vercel Admin Deploy
      run: curl -X POST "${{ secrets.VERCEL_ADMIN_DEPLOY_HOOK }}"
```

**After** (separate job):

```yaml
# ---------------------------------------------------------------------------
# Deploy Frontend to Vercel
# ---------------------------------------------------------------------------
deploy-frontend:
  name: Deploy Frontend
  runs-on: ubuntu-latest
  needs: [build, deploy-functions]
  if: github.ref == 'refs/heads/main'
  steps:
    - name: Trigger Vercel Storefront Deploy
      run: |
        curl -X POST "${{ secrets.VERCEL_STOREFRONT_DEPLOY_HOOK }}" \
          || (echo "Storefront deploy hook failed" && exit 1)

    - name: Trigger Vercel Admin Deploy
      run: |
        curl -X POST "${{ secrets.VERCEL_ADMIN_DEPLOY_HOOK }}" \
          || (echo "Admin deploy hook failed" && exit 1)

    - name: Verify Deployments
      run: |
        echo "✅ Frontend deployments triggered successfully"
        echo "Storefront: https://www.shoppk.com"
        echo "Admin: https://admin.shoppk.com"
```

**Deliverables**:

- [ ] Docker job removed from workflow
- [ ] SSH deployment removed
- [ ] `deploy-functions` job added
- [ ] `deploy-frontend` job separated
- [ ] Workflow validates successfully
- [ ] Workflow committed to Git

---

### Phase 3: GitHub Secrets Setup (Week 1)

#### Step 3.1: Generate Supabase Access Token

**Objective**: Create a personal access token for CI/CD deployments.

**Steps**:

1. **Sign in to Supabase**:
   - Go to https://supabase.com/dashboard
   - Sign in with your account

2. **Generate Access Token**:
   - Click your profile icon (top right)
   - Go to "Account Settings"
   - Navigate to "Access Tokens"
   - Click "Generate New Token"
   - Name: `GitHub Actions CI/CD`
   - Scopes: Select "All" or at minimum:
     - `functions.write` — Deploy functions
     - `functions.read` — List functions
     - `secrets.write` — Manage function secrets
   - Click "Generate"
   - **Copy the token immediately** (won't be shown again)

3. **Store in GitHub**:
   - Go to your GitHub repository
   - Navigate to `Settings` → `Secrets and variables` → `Actions`
   - Click "New repository secret"
   - Name: `SUPABASE_ACCESS_TOKEN`
   - Value: Paste the token from step 2
   - Click "Add secret"

**Security Note**: This token grants deployment access to your Supabase project. Keep it secure and rotate it periodically.

---

#### Step 3.2: Add Supabase Project Secrets

**Required GitHub Secrets**:

| Secret Name                 | Description                | Where to Find                                   |
| --------------------------- | -------------------------- | ----------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN`     | Personal access token      | Generated in Step 3.1                           |
| `SUPABASE_PROJECT_ID`       | Project reference ID       | Supabase Dashboard → Project Settings → General |
| `SUPABASE_URL`              | Project URL                | `https://<project-id>.supabase.co`              |
| `SUPABASE_ANON_KEY`         | Anonymous key (public)     | Supabase Dashboard → Project Settings → API     |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (private) | Supabase Dashboard → Project Settings → API     |

**Steps to Add Each Secret**:

1. Go to GitHub repository
2. `Settings` → `Secrets and variables` → `Actions`
3. Click "New repository secret"
4. Enter name and value
5. Click "Add secret"

**Deliverables**:

- [ ] `SUPABASE_ACCESS_TOKEN` added to GitHub
- [ ] `SUPABASE_PROJECT_ID` added to GitHub
- [ ] `SUPABASE_URL` added to GitHub
- [ ] `SUPABASE_ANON_KEY` added to GitHub
- [ ] `SUPABASE_SERVICE_ROLE_KEY` added to GitHub

---

#### Step 3.3: Remove Obsolete Secrets

**Secrets to Remove** (after full migration):

| Secret Name           | Reason for Removal                  |
| --------------------- | ----------------------------------- |
| `OCI_HOST`            | No longer using VM                  |
| `OCI_SSH_PRIVATE_KEY` | No longer SSH deploying             |
| `GHCR_PAT`            | No longer pushing API Docker images |
| `JWT_SECRET`          | Replaced by Supabase Auth           |
| `JWT_REFRESH_SECRET`  | Replaced by Supabase Auth           |

**Steps**:

1. Go to GitHub repository
2. `Settings` → `Secrets and variables` → `Actions`
3. Find the secret
4. Click "Remove"
5. Confirm removal

⚠️ **Wait to remove these until**:

- Edge Functions are fully deployed and tested
- NestJS API is confirmed retired
- No rollback to old deployment method is needed

---

### Phase 4: Remove Legacy Jobs (Week 1)

#### Step 4.1: Update package.json Scripts

**Objective**: Mark API-specific scripts as deprecated.

**File**: `package.json`

**Before**:

```json
{
  "scripts": {
    "dev:api": "nx serve api",
    "build:api": "nx build api",
    "start:api": "node dist/apps/api/main.js",
    "docker:build": "docker-compose -f docker-compose.prod.yml build",
    "docker:up": "docker-compose -f docker-compose.prod.yml up -d",
    "docker:down": "docker-compose -f docker-compose.prod.yml down",
    "k8s:production": "kubectl apply -k k8s/overlays/production"
  }
}
```

**After**:

```json
{
  "scripts": {
    "_deprecated:dev:api": "nx serve api",
    "_deprecated:build:api": "nx build api",
    "_deprecated:start:api": "node dist/apps/api/main.js",
    "_deprecated:docker:build": "docker-compose -f docker-compose.prod.yml build",
    "_deprecated:docker:up": "docker-compose -f docker-compose.prod.yml up -d",
    "_deprecated:docker:down": "docker-compose -f docker-compose.prod.yml down",
    "_deprecated:k8s:production": "kubectl apply -k k8s/overlays/production",

    "supabase:start": "supabase start",
    "supabase:stop": "supabase stop",
    "supabase:functions:serve": "supabase functions serve",
    "supabase:functions:deploy": "supabase functions deploy --project-ref ${SUPABASE_PROJECT_ID}",
    "supabase:db:push": "supabase db push"
  }
}
```

**Deliverables**:

- [ ] API scripts marked as deprecated
- [ ] Supabase CLI scripts added
- [ ] Updated `package.json` committed

---

#### Step 4.2: Add .gitignore Entries

**Objective**: Ignore Supabase local files.

**File**: `.gitignore`

**Add**:

```gitignore
# Supabase
.supabase/
supabase/.branches
supabase/.temp
```

**Deliverables**:

- [ ] `.gitignore` updated
- [ ] Local Supabase files not tracked

---

### Phase 5: Testing (Week 2)

#### Step 5.1: Local Function Testing

**Objective**: Verify functions work locally before deploying to production.

**Commands**:

```bash
# Start local Supabase stack
bun run supabase:start

# Serve functions locally
bun run supabase:functions:serve

# Test health endpoint
curl http://localhost:54321/functions/v1/health

# Expected output:
# {
#   "status": "healthy",
#   "timestamp": "2026-05-26T...",
#   "version": "dev",
#   "runtime": "Deno 1.x"
# }
```

**Deliverables**:

- [ ] Local Supabase stack starts successfully
- [ ] Functions serve locally
- [ ] Health check returns 200 OK
- [ ] All functions tested locally

---

#### Step 5.2: CI/CD Pipeline Testing

**Objective**: Validate the new workflow deploys successfully.

**Test Plan**:

1. **Create Test Branch**:

   ```bash
   git checkout -b test/cicd-edge-functions
   ```

2. **Make Trivial Change**:

   ```bash
   echo "# CI/CD Test" >> README.md
   git add README.md
   git commit -m "test: CI/CD pipeline validation"
   git push origin test/cicd-edge-functions
   ```

3. **Open Pull Request**:
   - Create PR to `main`
   - Verify workflow runs
   - Check that quality gates pass
   - Confirm no deployment job runs (not `main` branch)

4. **Merge to Main**:
   - Merge PR
   - Verify workflow runs again
   - Check that `deploy-functions` job runs
   - Verify health check passes

**Expected Behavior**:

- ✅ Lint, typecheck, test jobs pass
- ✅ Build job completes (frontend only)
- ✅ `deploy-functions` job runs on `main` only
- ✅ Functions deploy successfully
- ✅ Health check returns 200 OK
- ✅ Frontend deployments triggered

**Deliverables**:

- [ ] Test PR created and merged
- [ ] Workflow runs successfully
- [ ] Functions deployed to production
- [ ] Health check passes
- [ ] No errors in GitHub Actions logs

---

#### Step 5.3: Rollback Testing

**Objective**: Verify we can roll back to a previous function version.

**Commands**:

```bash
# List function versions
supabase functions list --project-ref <project-id>

# Deploy specific version
supabase functions deploy health \
  --project-ref <project-id> \
  --version <previous-version>

# Verify rollback
curl https://<project-id>.supabase.co/functions/v1/health
```

**Deliverables**:

- [ ] Can list function versions
- [ ] Can deploy previous version
- [ ] Rolled-back function works
- [ ] Health check returns expected response

---

### Phase 6: Documentation (Week 2)

#### Step 6.1: Update Developer Guide

**File**: `docs/DEVELOPER_GUIDE.md` (to create)

**Content**:

````markdown
# Developer Guide: Supabase Edge Functions

## Local Development

### Prerequisites

- Bun 1.0+
- Supabase CLI installed: `npm install -g @supabase/cli`
- Supabase account

### Setup

1. Clone repository
2. Install dependencies: `bun install`
3. Start Supabase: `bun run supabase:start`
4. Serve functions: `bun run supabase:functions:serve`

### Testing Functions Locally

```bash
# Health check
curl http://localhost:54321/functions/v1/health

# Authenticated endpoint
curl http://localhost:54321/functions/v1/products-list \
  -H "Authorization: Bearer <supabase-anon-key>"
```
````

### Deploying Functions

```bash
# Deploy all functions (uses CLI from PATH)
bun run supabase:functions:deploy

# Deploy specific function
supabase functions deploy <function-name> --project-ref <project-id>

# Deploy with function-specific secrets
supabase secrets set --env-file supabase/functions/<function-name>/.env
```

## CI/CD Pipeline

### Workflow Triggers

- **Pull Request**: Runs lint, typecheck, test, build
- **Push to `main`**: Runs full pipeline including function deployment

### Manual Deployment

1. Go to GitHub Actions
2. Select "ShopPk CI/CD" workflow
3. Click "Run workflow"
4. Select `main` branch
5. Click "Run workflow"

````

**Deliverables**:
- [ ] Developer guide created
- [ ] Local setup documented
- [ ] CI/CD workflow documented

---

#### Step 6.2: Update Operations Guide

**File**: `docs/OPS_GUIDE.md` (to create)

**Content**:
```markdown
# Operations Guide: Edge Functions Deployment

## Monitoring

### Supabase Dashboard
- URL: https://supabase.com/dashboard/project/<project-id>
- Navigate to: Functions → Logs

### Metrics to Monitor

| Metric | Target | Alert Threshold |
|--------|--------|----------------|
| Function invocations/min | Varies by endpoint | N/A |
| Error rate | < 1% | > 5% |
| Average response time (p95) | < 500ms | > 1000ms |
| Cold start frequency | < 10% of requests | > 25% |
| Cold start duration | < 500ms | > 1000ms |
| Database query time | < 200ms | > 500ms |

**Cold Start Targets**:
- **E-commerce context**: Cold starts over 500ms are noticeable to users
- **Acceptable**: < 10% of requests experience cold starts
- **Good**: Cold starts resolve in < 300ms
- **Action required**: If > 25% of requests are cold starts, consider:
  - Enabling "always-on" functions (paid feature)
  - Warming functions with scheduled pings
  - Optimizing function import size

## Troubleshooting

### Function Not Responding
1. Check Supabase status: https://status.supabase.com
2. View function logs in Supabase dashboard
3. Verify secrets are set correctly
4. Check database connectivity

### Deployment Failed
1. Review GitHub Actions logs
2. Verify `SUPABASE_ACCESS_TOKEN` is valid
3. Check Supabase project ID is correct
4. Ensure functions have no syntax errors

### Rollback Procedure
1. List versions: `supabase functions list`
2. Deploy previous version:
   ```bash
   supabase functions deploy <function-name> \
     --project-ref <project-id> \
     --version <previous-version>
````

3. Verify health check passes
4. Monitor error rates

## Emergency Contacts

- Supabase Support: support@supabase.io
- GitHub Actions: Check repository settings

````

**Deliverables**:
- [ ] Operations guide created
- [ ] Monitoring documented
- [ ] Rollback procedures documented

---

## GitHub Actions Workflow

### Complete Updated Workflow

**File**: `.github/workflows/ci-cd.yml`

```yaml
# ============================================================================
# ShopPk CI/CD Pipeline (Serverless)
# ============================================================================

name: ShopPk CI/CD

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        default: 'production'
        type: choice
        options:
          - production

env:
  NODE_VERSION: '20'
  BUN_VERSION: '1'

jobs:
  # ---------------------------------------------------------------------------
  # Lint Job
  # ---------------------------------------------------------------------------
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: ${{ env.BUN_VERSION }}

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run ESLint
        run: bun run lint

  # ---------------------------------------------------------------------------
  # Type Check Job
  # ---------------------------------------------------------------------------
  typecheck:
    name: Type Check
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: ${{ env.BUN_VERSION }}

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Type Check (Storefront)
        run: bunx tsc --noEmit -p apps/storefront/tsconfig.json

      - name: Type Check (Admin)
        run: bunx tsc --noEmit -p apps/admin/tsconfig.json

  # ---------------------------------------------------------------------------
  # Test Job
  # ---------------------------------------------------------------------------
  test:
    name: Test
    runs-on: ubuntu-latest
    needs: [lint, typecheck]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: ${{ env.BUN_VERSION }}

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run tests
        run: bun run test

  # ---------------------------------------------------------------------------
  # Build Frontend
  # ---------------------------------------------------------------------------
  build:
    name: Build Frontend
    runs-on: ubuntu-latest
    needs: [test]
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: ${{ env.BUN_VERSION }}

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Build Storefront
        run: bunx nx build storefront --prod

      - name: Build Admin
        run: bunx nx build admin --prod

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: frontend-builds
          path: |
            apps/storefront/.next/
            apps/admin/.next/
          retention-days: 1

  # ---------------------------------------------------------------------------
  # Deploy Edge Functions to Supabase
  # ---------------------------------------------------------------------------
  deploy-functions:
    name: Deploy Edge Functions
    runs-on: ubuntu-latest
    needs: [lint, typecheck, test]
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://${{ secrets.SUPABASE_PROJECT_ID }}.supabase.co
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: ${{ env.BUN_VERSION }}

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Deploy Edge Functions
        run: |
          echo "Deploying Edge Functions to Supabase..."
          supabase functions deploy \
            --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

      - name: List Deployed Functions
        run: |
          supabase functions list \
            --project-ref ${{ secrets.SUPABASE_PROJECT_ID }}
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}

      - name: Health Check
        run: |
          echo "Running health check..."
          curl -f -X GET \
            "https://${{ secrets.SUPABASE_PROJECT_ID }}.supabase.co/functions/v1/health" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            || (echo "❌ Health check failed" && exit 1)
          echo "✅ Health check passed"

  # ---------------------------------------------------------------------------
  # Deploy Frontend to Vercel
  # ---------------------------------------------------------------------------
  deploy-frontend:
    name: Deploy Frontend
    runs-on: ubuntu-latest
    needs: [build, deploy-functions]
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Trigger Vercel Storefront Deploy
        run: |
          echo "Triggering Storefront deployment..."
          curl -X POST "${{ secrets.VERCEL_STOREFRONT_DEPLOY_HOOK }}" \
            || (echo "❌ Storefront deploy hook failed" && exit 1)
          echo "✅ Storefront deployment triggered"

      - name: Trigger Vercel Admin Deploy
        run: |
          echo "Triggering Admin deployment..."
          curl -X POST "${{ secrets.VERCEL_ADMIN_DEPLOY_HOOK }}" \
            || (echo "❌ Admin deploy hook failed" && exit 1)
          echo "✅ Admin deployment triggered"

      - name: Deployment Summary
        run: |
          echo "🚀 Deployment Complete"
          echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
          echo "Edge Functions: https://${{ secrets.SUPABASE_PROJECT_ID }}.supabase.co/functions/v1"
          echo "Storefront: https://www.shoppk.com"
          echo "Admin: https://admin.shoppk.com"
````

**Key Changes from Original**:

- ❌ Removed `docker` job entirely
- ❌ Removed `deploy-staging` job
- ❌ Removed API build from `build` job
- ❌ Removed OCI SSH deployment
- ✅ Added `deploy-functions` job with Supabase CLI
- ✅ Simplified `deploy-frontend` job
- ✅ Added health check verification
- ✅ Improved logging and error handling

---

## Environment Variables & Secrets

### Secret Management Strategy

**Three Types of Configuration**:

1. **GitHub Actions Secrets** (CI/CD deployment credentials)
2. **Supabase Project Secrets** (Runtime function secrets)
3. **Local Development Config** (`supabase/config.toml`)

### GitHub Actions Secrets

**Purpose**: CI/CD deployment and verification

| Secret                          | Required | Description           | Example                         |
| ------------------------------- | -------- | --------------------- | ------------------------------- |
| `SUPABASE_ACCESS_TOKEN`         | ✅ Yes   | Personal access token | `sbp_xxxxx...`                  |
| `SUPABASE_PROJECT_ID`           | ✅ Yes   | Project reference ID  | `abc123xyz`                     |
| `SUPABASE_URL`                  | ✅ Yes   | Full project URL      | `https://abc123xyz.supabase.co` |
| `SUPABASE_ANON_KEY`             | ✅ Yes   | Anonymous/public key  | `eyJ0eXAiOi...`                 |
| `VERCEL_STOREFRONT_DEPLOY_HOOK` | ✅ Yes   | Vercel webhook URL    | `https://api.vercel.com/...`    |
| `VERCEL_ADMIN_DEPLOY_HOOK`      | ✅ Yes   | Vercel webhook URL    | `https://api.vercel.com/...`    |

### Supabase Project Secrets

**Purpose**: Runtime configuration for Edge Functions

**Set via Supabase Dashboard**:

1. Go to https://supabase.com/dashboard/project/<project-id>
2. Navigate to: Settings → Edge Functions → Secrets
3. Click "New secret"
4. Enter name and value
5. Click "Save"

**Or set via CLI**:

```bash
supabase secrets set UPSTASH_REDIS_REST_URL=https://... \
  --project-ref <project-id>
```

**Required Project-Level Secrets**:

| Secret                        | Description                   | Where to Get                                 |
| ----------------------------- | ----------------------------- | -------------------------------------------- |
| `SUPABASE_SERVICE_ROLE_KEY`   | Service role key (admin)      | Supabase Dashboard → Project Settings → API  |
| `UPSTASH_REDIS_REST_URL`      | Upstash Redis REST endpoint   | Upstash dashboard                            |
| `UPSTASH_REDIS_REST_TOKEN`    | Upstash auth token            | Upstash dashboard                            |
| `VAPID_PUBLIC_KEY`            | Push notification public key  | Generated via `web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY`           | Push notification private key | Same as above                                |
| `VAPID_SUBJECT`               | Push notification subject     | `mailto:admin@shoppk.com`                    |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | WhatsApp business number      | Your WhatsApp Business account               |

#### Function-Specific Secrets (Optional)

Supabase supports per-function environment variables for cases where secrets should not be shared across all functions.

**Use Cases**:

- Function-specific API keys (e.g., payment gateway for `orders-create` only)
- Different rate limits per function
- Feature flags for specific endpoints

**Setup via `.env` Files**:

```bash
# Create per-function .env file
cat > supabase/functions/orders-create/.env << 'EOF'
PAYMENT_GATEWAY_KEY=sk_live_xxxxx
MAX_ORDER_AMOUNT=1000000
EOF

# Deploy with function-specific secrets
supabase secrets set --env-file supabase/functions/orders-create/.env \
  --project-ref <project-id>
```

**Best Practices**:

- ✅ Use project-level secrets for shared config (database, cache, auth)
- ✅ Use function-specific secrets for isolated integrations
- ❌ Don't duplicate the same secret across multiple function `.env` files
- ❌ Don't commit `.env` files to Git (add to `.gitignore`)

**Note**: For initial deployment, project-level secrets are sufficient. Add function-specific secrets only when needed.

### Local Development Config

**File**: `supabase/config.toml`

**Purpose**: Local Supabase CLI configuration only

**Never Store**:

- ❌ Production secrets
- ❌ API keys
- ❌ Database credentials

**Safe to Store**:

- ✅ Local ports
- ✅ Feature flags
- ✅ Function configuration

**Example**:

```toml
project_id = "shoppk"

[api]
port = 54321
schemas = ["public", "storage"]

[db]
port = 54322
major_version = 15

[studio]
port = 54323

[functions]
verify_jwt = true
```

---

## Supabase Directory Structure

### Complete Structure Reference

```
supabase/
├── config.toml                       # Local CLI config
├── functions/                        # Edge Functions (Deno)
│   ├── _shared/                      # Shared utilities
│   │   ├── auth.ts                   # Authentication helpers
│   │   ├── response.ts               # Response builders
│   │   ├── cors.ts                   # CORS handlers
│   │   ├── validation.ts             # Input validation
│   │   └── client.ts                 # Supabase client factory
│   ├── health/                       # Health check
│   │   └── index.ts
│   ├── products-list/                # List products
│   │   └── index.ts
│   ├── products-create/              # Create product
│   │   └── index.ts
│   ├── products-update/              # Update product
│   │   └── index.ts
│   ├── products-delete/              # Delete product
│   │   └── index.ts
│   ├── orders-create/                # Create order
│   │   └── index.ts
│   ├── orders-list/                  # List orders
│   │   └── index.ts
│   ├── orders-update-status/         # Update order status
│   │   └── index.ts
│   ├── dashboard-stats/              # Dashboard statistics
│   │   └── index.ts
│   └── webhooks/                     # External webhooks
│       └── index.ts
└── migrations/                       # SQL migrations
    ├── 20260526_enable_realtime.sql
    ├── 20260526_rls_policies.sql
    └── 20260526_sql_functions.sql
```

### Function Naming Convention

**Pattern**: `<resource>-<action>`

**Examples**:

- ✅ `products-list` — GET /products
- ✅ `products-create` — POST /products
- ✅ `orders-update-status` — PATCH /orders/:id/status
- ✅ `dashboard-stats` — GET /dashboard/stats

**Avoid**:

- ❌ `getProducts` (camelCase)
- ❌ `list-all-products` (too verbose)
- ❌ `product` (ambiguous action)

---

## Rollout Plan

### Stage 1: Pre-Production Validation (Week 1)

**Objective**: Deploy to development Supabase project and validate.

**Steps**:

1. Create separate development Supabase project
2. Add development secrets to GitHub (separate environment)
3. Deploy functions to development
4. Run integration tests against development
5. Validate all endpoints work

**Success Criteria**:

- ✅ All functions deploy successfully
- ✅ Health check returns 200 OK
- ✅ Integration tests pass
- ✅ No deployment errors

**Deliverables**:

- [ ] Development Supabase project created
- [ ] Functions deployed to development
- [ ] Integration tests passing

---

### Stage 2: Production Deployment (Week 2)

**Objective**: Deploy to production Supabase project.

**Steps**:

1. Merge CI/CD changes to `main`
2. Workflow automatically deploys functions
3. Monitor deployment logs
4. Verify health check passes
5. Monitor function invocations for errors

**Success Criteria**:

- ✅ Workflow completes without errors
- ✅ All functions deployed
- ✅ Health check passes
- ✅ No 5xx errors in function logs
- ✅ Frontend deployments successful

**Rollback Trigger**:

- Deployment failure
- Health check failure
- Error rate > 5%

---

### Stage 3: Traffic Validation (Week 2)

**Objective**: Validate production traffic flows correctly.

**Monitoring Checklist**:

- [ ] Function invocation count increasing
- [ ] Response times < 500ms (p95)
- [ ] Error rate < 1%
- [ ] Database queries succeeding
- [ ] Cache hit rate (if using Upstash)
- [ ] Frontend API calls succeeding

**Tools**:

- Supabase Dashboard → Functions → Logs
- Supabase Dashboard → Functions → Metrics
- Frontend error tracking (Sentry/similar)

**Duration**: Monitor for 48 hours

---

### Stage 4: Cleanup (Week 3)

**Objective**: Remove legacy infrastructure and code.

**Tasks**:

1. **Remove GitHub Secrets**:
   - [ ] `OCI_HOST`
   - [ ] `OCI_SSH_PRIVATE_KEY`
   - [ ] `GHCR_PAT`
   - [ ] `JWT_SECRET`
   - [ ] `JWT_REFRESH_SECRET`

2. **Decommission OCI VM**:
   - [ ] Stop API container
   - [ ] Backup any logs
   - [ ] Terminate VM instance
   - [ ] Remove SSH keys

3. **Remove Docker Files**:
   - [ ] `docker/Dockerfile.api`
   - [ ] `docker-compose.prod.yml` (API portions)
   - [ ] `.dockerignore`

4. **Clean Up Repository**:
   - [ ] Remove `apps/api` directory (if fully migrated)
   - [ ] Update README.md
   - [ ] Update architecture diagrams
   - [ ] Archive Docker/Kubernetes configs

**Success Criteria**:

- ✅ No legacy secrets remain
- ✅ VM decommissioned
- ✅ Docker files removed
- ✅ Documentation updated

---

## Troubleshooting

### Issue: Deployment Fails with "Invalid Access Token"

**Symptoms**:

- GitHub Actions workflow fails at `Deploy Edge Functions` step
- Error: `Invalid access token` or `401 Unauthorized`

**Diagnosis**:

```bash
# Test token locally
export SUPABASE_ACCESS_TOKEN="sbp_xxxxx..."
supabase functions list --project-ref <project-id>
```

**Solutions**:

1. **Token Expired**: Regenerate token in Supabase dashboard
2. **Wrong Token Format**: Ensure token starts with `sbp_`
3. **Insufficient Permissions**: Regenerate with `functions.write` scope
4. **Secret Not Set**: Verify in GitHub → Settings → Secrets

---

### Issue: Health Check Fails After Deployment

**Symptoms**:

- Functions deploy successfully
- Health check curl command returns 404 or 500

**Diagnosis**:

```bash
# Check function logs
supabase functions logs health --project-ref <project-id>

# Test directly
curl https://<project-id>.supabase.co/functions/v1/health \
  -H "Authorization: Bearer <anon-key>"
```

**Solutions**:

1. **Function Not Deployed**: Verify in Supabase dashboard
2. **Incorrect URL**: Check project ID is correct
3. **Missing Anon Key**: Verify `SUPABASE_ANON_KEY` secret
4. **Function Error**: Check logs for runtime errors

---

### Issue: Functions Deploy But Don't Work

**Symptoms**:

- Deployment succeeds
- Functions return 500 errors when invoked

**Diagnosis**:

```bash
# View function logs
supabase functions logs <function-name> --project-ref <project-id>

# Check for common issues
# - Missing secrets
# - Database connection errors
# - Import/require errors
```

**Solutions**:

1. **Missing Secrets**: Set in Supabase dashboard
   ```bash
   supabase secrets set KEY=value --project-ref <project-id>
   ```
2. **Database Errors**: Check `SUPABASE_SERVICE_ROLE_KEY` is set
3. **Import Errors**: Verify Deno imports use `https://` URLs
4. **Syntax Errors**: Test function locally first

---

### Issue: Workflow Runs But Doesn't Deploy

**Symptoms**:

- Workflow completes successfully
- `deploy-functions` job doesn't run

**Diagnosis**:
Check the job condition:

```yaml
if: github.event_name == 'push' && github.ref == 'refs/heads/main'
```

**Solutions**:

1. **Not on `main` branch**: Job only runs on push to `main`
2. **Pull Request**: Job skipped for PRs (by design)
3. **Manual Trigger**: Use workflow_dispatch if needed

---

### Issue: Frontend Can't Reach Edge Functions

**Symptoms**:

- Functions work when tested directly
- Frontend API calls fail with CORS or 404 errors

**Diagnosis**:

```javascript
// Check frontend API URL
console.log(process.env.NEXT_PUBLIC_API_URL);
// Should be: https://<project-id>.supabase.co/functions/v1
```

**Solutions**:

1. **Update Frontend Env Vars** (Vercel):
   - Go to Vercel project settings
   - Update `NEXT_PUBLIC_API_URL`
   - Redeploy frontend

2. **CORS Issues**: Verify functions return CORS headers
   ```typescript
   return new Response(JSON.stringify(data), {
     headers: {
       'Content-Type': 'application/json',
       'Access-Control-Allow-Origin': '*',
     },
   });
   ```

---

## Appendix

### Complete Secret Checklist

**GitHub Actions Secrets** (6 required):

- [ ] `SUPABASE_ACCESS_TOKEN`
- [ ] `SUPABASE_PROJECT_ID`
- [ ] `SUPABASE_URL`
- [ ] `SUPABASE_ANON_KEY`
- [ ] `VERCEL_STOREFRONT_DEPLOY_HOOK`
- [ ] `VERCEL_ADMIN_DEPLOY_HOOK`

**Supabase Project Secrets** (7 required):

- [ ] `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `UPSTASH_REDIS_REST_URL`
- [ ] `UPSTASH_REDIS_REST_TOKEN`
- [ ] `VAPID_PUBLIC_KEY`
- [ ] `VAPID_PRIVATE_KEY`
- [ ] `VAPID_SUBJECT`
- [ ] `NEXT_PUBLIC_WHATSAPP_NUMBER`

**Secrets to Remove** (after migration):

- [ ] `OCI_HOST`
- [ ] `OCI_SSH_PRIVATE_KEY`
- [ ] `GHCR_PAT`
- [ ] `JWT_SECRET`
- [ ] `JWT_REFRESH_SECRET`

---

### Deployment Timeline

| Week   | Phase    | Key Deliverables                              |
| ------ | -------- | --------------------------------------------- |
| Week 1 | Setup    | Supabase structure, workflow updates, secrets |
| Week 1 | Cleanup  | Remove Docker/VM jobs, update scripts         |
| Week 2 | Testing  | Local tests, CI/CD validation, rollback tests |
| Week 2 | Deploy   | Production deployment, monitoring             |
| Week 3 | Finalize | Infrastructure cleanup, documentation         |

---

### Cost Comparison

**Current (Docker/VM)**:

- OCI VM: ~$50/month
- Egress bandwidth: ~$20/month
- Maintenance time: ~4 hours/month
- **Total**: ~$70/month + 4 hours

**Target (Edge Functions)**:

- Supabase Pro: $25/month (includes 2M function invocations)
- Estimated traffic: ~500k requests/month (within free tier)
- Maintenance time: ~1 hour/month
- **Total**: ~$25/month + 1 hour

**Savings**: $45/month + 3 hours/month

---

**Document Version:** 1.0  
**Last Updated:** May 26, 2026  
**Next Review:** After production deployment

**End of Document**
