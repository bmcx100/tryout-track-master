# Infrastructure CLAUDE.md

Guidance for Claude Code when working in the `infrastructure/` directory of Track Master. This directory contains CI/CD pipelines, deployment configuration, and environment setup.

## Directory Structure

```
infrastructure/
|-- .github/
|   |-- workflows/
|       |-- ci.yml               # Lint + type-check + build on PR
|       |-- deploy-preview.yml   # Vercel preview deployment on PR
|-- vercel.json                  # Vercel project configuration
```

## GitHub Actions CI Pipeline

### ci.yml -- Runs on Pull Requests to main

```yaml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npx eslint .
      - run: npx tsc --noEmit
      - run: npm run build
```

**Key points:**
- All frontend steps set `working-directory: frontend`
- Cache is keyed on `frontend/package-lock.json`
- Three quality gates: lint, type-check, build
- Node.js 20.x matches the Vercel runtime

### Adding New Workflow Steps

When adding steps:
- Keep the `working-directory: frontend` default for frontend jobs
- Use `actions/cache` for any additional dependencies
- Pin action versions to `@v4` (major version)
- Never store secrets in workflow files -- use GitHub repository secrets

## Vercel Deployment Configuration

### Project Settings

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Root Directory | `frontend/` |
| Build Command | `npm run build` (default) |
| Output Directory | `.next` (default) |
| Node.js Version | 20.x |
| Install Command | `npm install` (default) |

### vercel.json

```json
{
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

This file lives in `infrastructure/` but Vercel reads from the root directory setting. If Vercel requires it at the repo root or in `frontend/`, adjust accordingly.

### Deployment Strategy

| Trigger | Environment | URL |
|---------|-------------|-----|
| Push to `main` | Production | `trackmaster.app` (custom domain) |
| Pull request | Preview | `track-master-<hash>.vercel.app` (auto-generated) |
| Manual | N/A | Not used. All deployments go through Git. |

## Environment Variables

### Where Variables Live

| Variable | Vercel | Frontend `.env.local` | Backend `.env.local` |
|----------|--------|-----------------------|----------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | All environments | Yes | No |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | All environments | Yes | No |
| `SUPABASE_SERVICE_ROLE_KEY` | All (server only) | Yes | No |
| `NEXT_PUBLIC_APP_URL` | Per environment | Yes | No |
| `SUPABASE_ACCESS_TOKEN` | No | No | Yes |
| `SUPABASE_PROJECT_ID` | No | No | Yes |
| `SUPABASE_DB_PASSWORD` | No | No | Yes |

### Vercel Variable Scoping

| Variable | Exposed to Client | Environments |
|----------|-------------------|--------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Yes | Production, Preview, Development |
| `SUPABASE_SERVICE_ROLE_KEY` | No (server only) | Production, Preview, Development |
| `NEXT_PUBLIC_APP_URL` | Yes | Different value per environment |

**Rules:**
- Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser. Never put secrets in these.
- `SUPABASE_SERVICE_ROLE_KEY` must never be prefixed with `NEXT_PUBLIC_`. It bypasses RLS.
- Preview deployments should use the same Supabase project as production for simplicity, or a separate staging project if data isolation is needed.

### Setting Variables in Vercel

```bash
# Via Vercel CLI
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Or via Vercel dashboard:
# Project Settings > Environment Variables
```

## Branch Strategy

**Trunk-based development** with short-lived feature branches:

```
main (production)
  |
  |-- feature/player-list       # Short-lived, merged via PR
  |-- fix/rls-policy-typo       # Bug fix branch
  |-- chore/update-deps         # Maintenance branch
```

**Rules:**
- `main` is the production branch. It is always deployable.
- Feature branches are created with `git switch -c feature/name` (not `git checkout`).
- All changes go through pull requests with CI checks passing.
- No long-lived branches. Merge within 1-2 days.
- No release branches. Every merge to `main` is a production deployment.
- Use squash merges to keep `main` history clean.

## Preview Deployments

Every pull request automatically gets a Vercel preview deployment:

- **URL format:** `track-master-<git-hash>.vercel.app`
- **Environment:** Uses Preview environment variables from Vercel
- **Lifecycle:** Created on PR open/update, removed when PR is closed
- **Use case:** Review UI changes, test auth flows, verify builds

Preview deployments share the same Supabase backend. Test with care to avoid polluting production data. Use seed data or a separate Supabase project for isolated testing.

## Adding Infrastructure

When adding new infrastructure configuration:
- CI workflows go in `.github/workflows/`
- Vercel config stays in `vercel.json`
- Do not add Terraform, Docker Compose, or other IaC tools unless explicitly requested -- the architecture is intentionally simple (Vercel + Supabase managed services)
- Keep workflows minimal. The project is maintained by a solo developer.
