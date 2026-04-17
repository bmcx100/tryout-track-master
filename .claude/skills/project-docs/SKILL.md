# Project Docs

**Description:** Manages the living documentation for Track Master. Operates in two modes: CREATE mode generates the full documentation set from scratch, and UPDATE mode syncs existing documentation with code changes.

**Trigger:** Use this skill when:
- The user asks to generate or create project documentation
- The user asks to update or sync documentation after code changes
- The user asks to review whether documentation is current
- `docs/index.md` needs to be created or refreshed

---

## Mode Detection

**Step 1:** Check whether `docs/index.md` exists in the project root.

- **If `docs/index.md` does NOT exist** -> Enter CREATE mode
- **If `docs/index.md` exists** -> Enter UPDATE mode

---

## CREATE Mode

When `docs/index.md` does not exist, generate the full documentation set. Create the following 7 files:

### File 1: `docs/index.md` -- Documentation Hub

The central navigation page for all project documentation.

**Required content:**
- Project name and one-line description
- Table of contents linking to all 6 sub-files
- Quick-start command reference (dev server, build, lint)
- Link to CLAUDE.md for AI coding assistant instructions

**Template structure:**
```markdown
# Track Master Documentation

> Hockey tryout tracker for parents -- helping families stay informed during tryout season.

## Documentation Index

| Document | Description |
|----------|-------------|
| [Business Context](./business.md) | Product vision, user roles, and business rules |
| [Architecture](./architecture.md) | System architecture, data model, and auth flows |
| [Codebase Structure](./structure.md) | Directory layout and file organization |
| [Development Workflow](./development.md) | Git workflow, CI/CD, and deployment |
| [Tech Stack](./tech-stack.md) | Technology choices, versions, and rationale |
| [Local Setup](./local-setup.md) | Getting the project running locally |

## Quick Reference

- **Dev server:** `npm run dev` (port 3000)
- **Build:** `npm run build`
- **Lint:** `npm run lint`

## AI Coding Assistant

See [CLAUDE.md](../CLAUDE.md) for instructions used by Claude Code.
```

---

### File 2: `docs/business.md` -- Business Context

**Required sections:**
- Product overview (what Track Master does, who it serves)
- User roles and permissions (admin, group_admin, member)
- Key workflows (player tracking, corrections, scraping, CSV import)
- Association model (multi-tenant, join codes)
- Player status lifecycle (registered -> trying_out -> cut/made_team/etc.)
- Privacy and compliance summary (PIPEDA, data minimization, 90-day purge)
- Target market (Ontario hockey associations)

---

### File 3: `docs/architecture.md` -- Architecture Overview

**Required sections:**
- System architecture diagram (text-based)
- Data flow summary (read path, write path, scrape path, auth path)
- Database schema overview (tables, relationships, enums)
- Authentication architecture (proxy.ts, Supabase Auth, OAuth, PKCE)
- Multi-tenancy strategy (association_id, RLS)
- Scraping architecture (Cheerio, configurable selectors, preview-then-confirm)
- Performance strategy (RSC, streaming, client-side filtering)

**Note:** If `docs/architecture.md` already exists from the architecture design phase, preserve its content and enhance rather than replace it.

---

### File 4: `docs/structure.md` -- Codebase Structure

**Required sections:**
- Monorepo layout (`frontend/`, `backend/`, `infrastructure/`, `docs/`)
- App Router directory structure with route groups
- Component directory organization (by domain)
- Library directory layout (`lib/supabase/`, `lib/scraper/`, etc.)
- Key configuration files and their purposes
- Path alias explanation (`@/*`)

---

### File 5: `docs/development.md` -- Development Workflow

**Required sections:**
- Git branching strategy (trunk-based, feature/fix/chore branches)
- Branch naming conventions
- PR workflow (create branch, open PR, CI checks, preview deploy, merge)
- CI pipeline stages (lint, typecheck, build)
- Coding standards summary (no semicolons, @apply, images in public/images/)
- Commit message conventions
- How to add shadcn/ui components

---

### File 6: `docs/tech-stack.md` -- Technology Stack Details

**Required sections:**
- Stack summary table (technology, version, purpose)
- Framework details (Next.js 16, React 19, App Router)
- Styling approach (Tailwind CSS v4, @apply, OKLCH, shadcn/ui)
- Backend services (Supabase, PostgreSQL, RLS, Auth)
- Auth library details (@supabase/ssr, cookie API, getClaims vs getUser)
- Scraping stack (Cheerio, Puppeteer-core fallback)
- Hosting and deployment (Vercel hobby tier, limits)
- Development tools (ESLint flat config, TypeScript strict mode)

---

### File 7: `docs/local-setup.md` -- Local Development Setup

**Required sections:**
- Prerequisites (Node.js version, npm, Git)
- Clone and install steps
- Environment variable setup (which vars, where to get them)
- Supabase local setup (if applicable)
- Running the dev server
- Running the linter and type checker
- Common troubleshooting (port conflicts, env var issues, build errors)

---

## UPDATE Mode

When `docs/index.md` already exists, sync documentation with the current state of the codebase.

### Update Process

**Step 1: Audit the codebase for changes**
- Read recent git commits since the docs were last updated
- Scan the directory structure for new files, directories, or reorganizations
- Check `package.json` for dependency changes
- Review `CLAUDE.md` for updated coding standards
- Check for new or modified database migrations

**Step 2: Compare documentation against codebase**
For each documentation file, identify:
- **Stale content:** Descriptions that no longer match the code
- **Missing content:** New features, files, or patterns not documented
- **Incorrect content:** Outdated version numbers, wrong file paths, deprecated patterns

**Step 3: Update each file**
- Fix stale and incorrect content
- Add sections for new features or patterns
- Remove sections for deleted features
- Update version numbers and file paths
- Preserve the overall structure and formatting

**Step 4: Update `docs/index.md`**
- Ensure all sub-file links are correct
- Update the quick reference if commands have changed
- Add entries for any new documentation files

### What to Look For

| Change Type | Where to Look | Docs to Update |
|-------------|---------------|----------------|
| New pages/routes | `app/` directory | structure.md, architecture.md |
| New components | `components/` directory | structure.md |
| New dependencies | `package.json` | tech-stack.md |
| Schema changes | `backend/supabase/migrations/` | architecture.md |
| New env vars | `.env.local.example` | local-setup.md |
| Workflow changes | `.github/workflows/` | development.md |
| Coding standard changes | `CLAUDE.md` | development.md |
| New user features | Various | business.md |

---

## Documentation Standards

All documentation files must follow these standards:

- **Format:** Markdown with GitHub-Flavored Markdown extensions
- **Headings:** Use `##` for top-level sections, `###` for subsections
- **Code blocks:** Use fenced code blocks with language identifiers
- **Tables:** Use Markdown tables for structured data
- **Links:** Use relative links between documentation files
- **Diagrams:** Use text-based diagrams (ASCII art or Mermaid if supported)
- **No hanging words:** Ensure at least 3 words remain together on the last line of any paragraph (use `&nbsp;` or reword if needed)
- **No emojis:** Keep documentation professional and plain-text compatible
- **Accuracy:** Every file path, command, and version number must match the actual codebase
- **Conciseness:** Write for developers who need to find information quickly. Avoid unnecessary narrative.
