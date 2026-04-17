# Project CI/CD

**Description:** Enforces CI/CD patterns for Track Master, including GitHub Actions workflow structure, build pipeline configuration, Vercel deployment setup, branching strategy, and preview deployment workflows.

**Trigger:** Use this skill when:
- Creating or modifying GitHub Actions workflows
- Setting up or changing the build/deploy pipeline
- Configuring Vercel project settings
- Creating branches or managing the branching strategy
- Setting up preview or staging deployments

---

## Enforcement Rules

### 1. GitHub Actions Workflow Structure

All CI/CD workflows live in `infrastructure/.github/workflows/`. The project uses two primary workflows.

**Workflow 1: CI (`ci.yml`)**
Runs on every pull request and push to `main`.

```yaml
# infrastructure/.github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

      - name: Build
        run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_ANON_KEY }}
```

**Workflow 2: Preview Deployment (`deploy-preview.yml`)**
Triggers a Vercel preview deployment on pull requests.

```yaml
# infrastructure/.github/workflows/deploy-preview.yml
name: Preview Deployment

on:
  pull_request:
    branches: [main]

jobs:
  deploy-preview:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Deploy to Vercel Preview
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: frontend
```

**Rules:**
- Workflows must set `working-directory: frontend` since the Next.js app lives in the monorepo's `frontend/` directory
- Use `npm ci` (not `npm install`) for reproducible installs
- Cache `node_modules` via `actions/setup-node` with the `cache` option
- Pin action versions to major versions (e.g., `@v4`, not `@latest`)
- Store secrets in GitHub repository settings, never in workflow files

---

### 2. Lint + Typecheck + Build Pipeline

The CI pipeline runs three sequential checks. All must pass before a PR can be merged.

**Pipeline stages:**

| Stage | Command | Purpose | Failure action |
|-------|---------|---------|----------------|
| **Lint** | `npm run lint` | ESLint flat config with Next.js rules | Fix lint errors before merging |
| **Type check** | `npx tsc --noEmit` | TypeScript strict mode validation | Fix type errors before merging |
| **Build** | `npm run build` | Full Next.js production build | Fix build errors before merging |

**Rules:**
- All three stages must pass. Do not skip any stage.
- Lint runs first because it is the fastest and catches the most common issues.
- Type check runs second to catch type errors before attempting a full build.
- Build runs last because it is the slowest and depends on lint and types being clean.
- Do not add `--fix` to the lint command in CI. Developers must fix lint issues locally.
- Do not use `// @ts-ignore` or `// @ts-expect-error` to silence type errors unless there is a documented reason in a code comment.

**Correct:**
```json
// package.json scripts
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  }
}
```

**Incorrect:**
```json
// WRONG: lint with auto-fix in CI
{
  "scripts": {
    "lint": "next lint --fix"
  }
}
```

---

### 3. Vercel Deployment Configuration

The project deploys to Vercel's hobby tier. Vercel auto-deploys from the `main` branch.

**Configuration:**

| Setting | Value |
|---------|-------|
| Framework | Next.js (auto-detected) |
| Root directory | `frontend/` |
| Build command | `npm run build` |
| Output directory | `.next` |
| Node.js version | 22.x |
| Install command | `npm ci` |

**Environment variables required on Vercel:**

| Variable | Source |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project dashboard |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project dashboard (server-only) |

**Rules:**
- The root directory in Vercel must be set to `frontend/` (monorepo)
- `SUPABASE_SERVICE_ROLE_KEY` must never be prefixed with `NEXT_PUBLIC_` (it would expose the service role key to the browser)
- Preview deployments are created automatically for every PR
- Production deployments happen on merge to `main`
- Do not configure custom Vercel build commands unless absolutely necessary
- Use Vercel's built-in environment variable management, not `.env` files in the repo

**Correct:**
```
# vercel.json (if needed)
{
  "buildCommand": "npm run build",
  "installCommand": "npm ci",
  "framework": "nextjs"
}
```

**Incorrect:**
```
# WRONG: service role key exposed as public
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

### 4. Trunk-Based Branching Rules

The project uses trunk-based development with short-lived feature branches.

**Branch structure:**

| Branch | Purpose | Lifetime |
|--------|---------|----------|
| `main` | Production branch, always deployable | Permanent |
| `feature/*` | New features | Short-lived (days, not weeks) |
| `fix/*` | Bug fixes | Short-lived |
| `chore/*` | Maintenance, dependency updates | Short-lived |

**Rules:**
- `main` is the single source of truth. All work branches from and merges back to `main`.
- Feature branches must be short-lived. Aim to merge within 1-3 days.
- Use `git switch -c feature/description` to create branches (not `git checkout -b`).
- Every PR must pass CI before merging.
- Squash-merge PRs to keep the `main` history clean.
- Never force-push to `main`.
- Delete feature branches after merging.
- Do not create `develop`, `staging`, or `release` branches. The project uses Vercel preview deployments instead of staging environments.

**Correct:**
```bash
git switch -c feature/player-search
# ... make changes, commit ...
# Open PR to main
# CI passes, squash-merge
# Delete feature/player-search
```

**Incorrect:**
```bash
git checkout -b develop          # WRONG: no develop branch
git checkout -b feature/player-search  # WRONG: use git switch -c
git push --force origin main     # WRONG: never force-push main
```

---

### 5. Preview Deployment Workflow

Every pull request gets a Vercel preview deployment. This is the primary way to test changes before merging.

**Workflow:**

1. Developer creates a feature branch and opens a PR to `main`
2. GitHub Actions runs the CI pipeline (lint, typecheck, build)
3. Vercel creates a preview deployment with a unique URL
4. The preview URL is posted as a comment on the PR
5. Developer and reviewers test the preview deployment
6. After approval and CI pass, the PR is squash-merged to `main`
7. Vercel deploys the production build from `main`

**Rules:**
- Preview deployments must use the same environment variables as production (except they may use a separate Supabase project for testing)
- Do not merge PRs without verifying the preview deployment works
- Preview deployments are ephemeral and are cleaned up by Vercel automatically
- If a preview deployment fails, fix the issue before merging

---

## Required GitHub Repository Settings

| Setting | Value |
|---------|-------|
| Default branch | `main` |
| Branch protection on `main` | Require PR, require CI pass, require 1 approval (if team > 1) |
| Merge strategy | Squash and merge |
| Auto-delete head branches | Enabled |
| Required status checks | `ci` workflow |

---

## Secrets Inventory

The following secrets must be configured in GitHub repository settings:

| Secret | Description |
|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (for admin operations in CI) |
| `VERCEL_TOKEN` | Vercel personal access token |
| `VERCEL_ORG_ID` | Vercel organization ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |
