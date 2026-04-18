# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Product Overview

**Track Master** is a hockey tryout tracking app for parents in Ontario, Canada. Parents join their child's hockey association via a join code and can view player statuses, team projections, and submit corrections. Association admins manage players, import data via CSV or web scraping, and review corrections. The system serves 2-3 associations at launch with a target of 200 concurrent users.

## Commands

- **Dev server:** `cd frontend && npm run dev` (Next.js on port 3000)
- **Build:** `cd frontend && npm run build`
- **Start production:** `cd frontend && npm start`
- **Lint:** `cd frontend && npm run lint` (ESLint with Next.js TypeScript + core web vitals rules)
- **Supabase local:** `cd backend && supabase start`
- **Apply migrations:** `cd backend && supabase db push`
- **Generate types:** `cd backend && supabase gen types typescript --local > ../frontend/types/database.ts`

## Architecture

- **Framework:** Next.js 16.1.6 with React 19, TypeScript 5, App Router
- **Styling:** Tailwind CSS v4 via `@tailwindcss/postcss` plugin
- **Component library:** shadcn/ui (New York style, Lucide icons, RSC-enabled)
- **Theming:** CSS variables defined in `app/globals.css` using OKLCH color space, with light/dark mode support
- **Backend:** Supabase (PostgreSQL with RLS, Auth, Edge Functions, cron)
- **Auth:** `@supabase/ssr` with `proxy.ts` and `getClaims()` for session management
- **Scraping:** Cheerio for static HTML parsing with configurable CSS selectors
- **Hosting:** Vercel (Hobby tier), auto-deploy from `main` branch
- **VCS:** Git + GitHub, trunk-based development

### Monorepo Structure

```
track-master/
|-- frontend/          # Next.js application (Vercel deployment root)
|-- backend/           # Supabase config: migrations, seed data, Edge Functions
|-- infrastructure/    # GitHub Actions workflows, Vercel config
|-- docs/              # PRD, architecture document
|-- CLAUDE.md          # This file (root-level instructions)
```

### Key Paths (frontend/)

- `app/` -- Next.js App Router pages and layouts
- `components/ui/` -- shadcn/ui components (add via `npx shadcn@latest add <component>`)
- `components/{domain}/` -- Domain components organized by feature (players, teams, corrections, scraper, import, dashboard, auth, layout, shared)
- `lib/supabase/` -- Supabase client factories (client.ts, server.ts, proxy.ts, admin.ts)
- `lib/utils.ts` -- `cn()` helper (clsx + tailwind-merge)
- `types/database.ts` -- Auto-generated Supabase types
- `proxy.ts` -- Root proxy for session refresh
- `components.json` -- shadcn/ui configuration

### Path Aliases

`@/*` maps to the `frontend/` project root (configured in `tsconfig.json`).

### Adding shadcn/ui Components

```bash
cd frontend
npx shadcn@latest add <component-name>
```

Components are placed in `components/ui/` and use `class-variance-authority` for variants, `radix-ui` for primitives, and the `cn()` utility for class merging.

## Three-Tier Role System

Roles are scoped per association via the `user_associations` table. A user can hold different roles in different associations.

| Role | Scope | Permissions |
|------|-------|-------------|
| **Admin** | Site-level | Full system access, can create associations |
| **Group Admin** | Association-level | Full read/write within their association (player CRUD, imports, scraping, correction review, member management, audit log) |
| **Member (Parent)** | Association-level | Read access to players/teams within their association, submit corrections |

Role enforcement happens at three layers:
1. **Database (RLS):** Ground truth via `user_is_admin()` and `user_belongs_to_association()` SECURITY DEFINER helpers
2. **Server layouts:** `(admin)/layout.tsx` checks role and redirects non-admins
3. **proxy.ts:** Validates session only (not roles), redirects unauthenticated users

## Database Conventions

- **RLS on all tables.** No exceptions. Every table with user or association data has Row-Level Security enabled.
- **`association_id` FK pattern.** Every data table (`tryout_players`, `teams`, `corrections`, `scraper_configs`, `audit_log`) has an `association_id` foreign key for multi-tenant isolation.
- **SECURITY DEFINER helpers.** `user_belongs_to_association(assoc_id)` and `user_is_admin(assoc_id)` centralize access logic for RLS policies.
- **Enums:** `player_status` (registered, trying_out, cut, made_team, moved_up, moved_down, withdrew), `app_role` (admin, parent), `correction_status` (pending, approved, rejected).
- **Soft deletes.** `tryout_players` uses a `deleted_at` column. Partial indexes filter on `WHERE deleted_at IS NULL`.
- **Audit logging.** All admin actions are recorded in `audit_log` via database triggers.
- **UUIDs.** All primary keys are `uuid` with `gen_random_uuid()` defaults.

## Auth Patterns

**STOP: Before changing any auth code, read `/home/data/Documents/webapps/documentation/supabase-auth-nextjs-examples.md` first.**

- **Session refresh:** `proxy.ts` calls `updateSession()` which uses `getClaims()` for local JWT validation (no network call). Never use `getUser()` or `getSession()` in the proxy.
- **Client creation:** Use `@supabase/ssr` exclusively. Browser: `createBrowserClient()`. Server: `createServerClient()` with async `cookies()`. Never use `@supabase/supabase-js` `createClient` directly.
- **OAuth callback:** `/auth/callback` route handler exchanges code via `exchangeCodeForSession()`.
- **Logout:** `/logout` server component calls `signOut()` and redirects.
- **Cookie management:** HttpOnly, Secure, SameSite=Lax cookies managed by `@supabase/ssr`. Never store tokens in localStorage.

## Domain Terms

| Term | Definition |
|------|-----------|
| **Association** | A hockey organization that runs tryouts. Top-level tenant in the system. |
| **Division** | Age-based grouping (e.g., U11, U13, U15). |
| **Team** | A specific team within a division (e.g., U13 AA, U13 A). |
| **Tryout Status** | Player state: Registered, Trying Out, Cut, Made Team, Moved Up, Moved Down, Withdrew. |
| **Correction** | A change request from a parent, requiring admin approval. |
| **Scraper Config** | Saved CSS selectors and URL for extracting player data from association websites. |
| **Join Code** | Short unique code parents use to join an association. |

## Testing Conventions

- **Type checking:** `npx tsc --noEmit` (run from `frontend/`)
- **Linting:** `npx eslint .` (run from `frontend/`)
- **Build verification:** `npm run build` (run from `frontend/`)
- **Manual testing:** Use Supabase local dev (`supabase start`) with seed data
- **RLS testing:** Verify policies using Supabase dashboard SQL editor with different user contexts

## Additional Coding Preferences

- Do NOT use semicolons for JavaScript or TypeScript code.
- Do NOT apply Tailwind classes directly in component templates unless essential or just 1 at most. If an element needs more than a single Tailwind class, combine them into a custom class using the `@apply` directive.
- Use minimal project dependencies where possible.
- Use the `git switch -c` command to switch to new branches, not `git checkout`.
- No hanging words (widows/orphans) in rendered text. Use `text-wrap: balance`, `&nbsp;`, or manual line breaks.
- All images go in `public/images/` with subfolders by category.

## Reference Documentation (MANDATORY)

**CRITICAL: Before writing or modifying ANY auth, proxy, or Supabase code, you MUST read the relevant documentation file below. Do NOT guess, do NOT rely on training data, do NOT use patterns from older Next.js versions. Read the file first, then follow the patterns exactly.**

| When you are touching... | You MUST read this file FIRST |
|--------------------------|-------------------------------|
| `proxy.ts`, session refresh, route protection | `/home/data/Documents/webapps/documentation/nextjs-16-proxy.md` |
| Auth flows, login, signup, OAuth, cookies, `@supabase/ssr` | `/home/data/Documents/webapps/documentation/supabase-auth-nextjs-examples.md` |
| Next.js 16 migration, breaking changes, async APIs | `/home/data/Documents/webapps/documentation/nextjs-16-upgrade-guide.md` |

**Rules:**
- The documentation files are the **source of truth** -- not your training data
- Follow the official patterns **exactly** -- do not invent alternative approaches
- If the docs conflict with your intuition, **the docs win**
- If you are unsure, **read the doc again** before proceeding

**Project documentation:**
- `docs/prd/PRD.md` -- Full product requirements document
- `docs/prd/ARCHITECTURE.md` -- System architecture, ER diagrams, ADRs, deployment config
- `docs/prd/ER.md` -- Entity-relationship diagrams and database schema
