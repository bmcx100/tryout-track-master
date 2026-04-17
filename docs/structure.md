# Track Master -- Codebase Structure

[Back to documentation hub](./index.md)

---

## Monorepo Layout

The repository uses directory-based separation with no workspace tooling
(no Turborepo or Nx). The `frontend/` directory is the Vercel
deployment&nbsp;root.

```
track-master/
|-- frontend/              # Next.js application (Vercel deployment root)
|-- backend/               # Supabase config: migrations, seed data, Edge Functions
|-- infrastructure/        # GitHub Actions workflows, Vercel config
|-- docs/                  # Developer documentation, PRD, architecture
|-- CLAUDE.md              # Root-level Claude Code instructions
|-- .gitignore
|-- README.md
```

> **Note:** The monorepo migration is in progress. Some Next.js files
> (app/, components/, lib/, package.json, etc.) currently live at the
> project root and will be moved into `frontend/` as part of the
> restructuring. The `@/*` path alias in `tsconfig.json` will map
> to `frontend/` after the&nbsp;migration.

---

## Frontend Directory (`frontend/`)

### App Router Structure

The App Router uses route groups to separate public, authenticated, and
admin pages. Route groups (parenthesized directories) do not affect
the&nbsp;URL&nbsp;path.

```
app/
|-- layout.tsx                 # Root layout (fonts, globals.css)
|-- globals.css                # Tailwind + shadcn theme variables (OKLCH)
|-- not-found.tsx              # Custom 404 page
|-- error.tsx                  # Global error boundary
|-- loading.tsx                # Global loading state
|
|-- (public)/                  # Unauthenticated pages
|   |-- layout.tsx             # Public layout (no nav)
|   |-- page.tsx               # Landing page (/)
|   |-- login/page.tsx         # Login page
|   |-- signup/page.tsx        # Signup page
|
|-- (app)/                     # Authenticated pages (all roles)
|   |-- layout.tsx             # App shell (nav, association context)
|   |-- dashboard/page.tsx     # Association dashboard
|   |-- players/
|   |   |-- page.tsx           # Player list (search, filter, sort)
|   |   |-- [playerId]/page.tsx # Player detail + correction form
|   |-- teams/page.tsx         # Team projections view
|   |-- corrections/page.tsx   # My submitted corrections
|   |-- join/page.tsx          # Join association via code
|   |-- settings/page.tsx      # User settings + privacy
|
|-- (admin)/                   # Group Admin + Admin pages
|   |-- layout.tsx             # Admin layout (sidebar, role check)
|   |-- admin/
|   |   |-- page.tsx           # Admin dashboard (stats overview)
|   |   |-- players/
|   |   |   |-- page.tsx       # Player management (CRUD, bulk ops)
|   |   |   |-- import/page.tsx # CSV import with preview
|   |   |-- teams/page.tsx     # Team management
|   |   |-- corrections/page.tsx # Correction review queue
|   |   |-- scraper/page.tsx   # Scraper config + run/preview
|   |   |-- members/page.tsx   # Member management (roles, join code)
|   |   |-- audit/page.tsx     # Audit log viewer
|   |   |-- association/page.tsx # Association settings
|
|-- auth/
|   |-- callback/route.ts     # OAuth/email callback handler
|   |-- auth-code-error/page.tsx # Auth error page
|
|-- logout/page.tsx            # Server component: sign out + redirect
|
|-- api/
|   |-- scrape/
|   |   |-- route.ts           # POST: run scrape, return preview
|   |   |-- confirm/route.ts   # POST: commit scraped data
|   |-- import/
|   |   |-- route.ts           # POST: CSV upload and parse
|   |   |-- confirm/route.ts   # POST: commit imported data
```

### Component Organization

Components are organized by domain, with shared UI primitives in
`components/ui/` (managed by&nbsp;shadcn/ui).

```
components/
|-- ui/                        # shadcn/ui components (auto-generated)
|   |-- button.tsx, input.tsx, badge.tsx, card.tsx, dialog.tsx,
|   |-- dropdown-menu.tsx, table.tsx, select.tsx, skeleton.tsx,
|   |-- toast.tsx, ...
|
|-- layout/                    # Layout components
|   |-- app-header.tsx         # Authenticated header (nav, user menu)
|   |-- admin-sidebar.tsx      # Admin sidebar navigation
|   |-- mobile-nav.tsx         # Mobile bottom nav or hamburger
|   |-- association-switcher.tsx # Association selector dropdown
|   |-- footer.tsx             # Footer with privacy link
|
|-- players/                   # Player-related components
|   |-- player-list.tsx        # Main player list (client component)
|   |-- player-card.tsx        # Individual player row/card
|   |-- player-filters.tsx     # Filter controls (status, division, team)
|   |-- player-search.tsx      # Search input (debounced)
|   |-- status-badge.tsx       # Colored status indicator
|   |-- player-form.tsx        # Group admin: add/edit player form
|   |-- bulk-status-bar.tsx    # Group admin: bulk selection toolbar
|
|-- teams/                     # Team-related components
|   |-- team-projection.tsx, team-card.tsx, team-form.tsx,
|   |-- roster-list.tsx
|
|-- corrections/               # Correction-related components
|   |-- correction-form.tsx, correction-queue.tsx, correction-card.tsx
|
|-- scraper/                   # Scraper-related components
|   |-- scraper-config-form.tsx, scrape-preview.tsx, scrape-progress.tsx
|
|-- import/                    # Import-related components
|   |-- csv-upload.tsx, import-preview.tsx
|
|-- dashboard/                 # Dashboard components
|   |-- stats-cards.tsx, division-summary.tsx
|
|-- auth/                      # Auth-related components
|   |-- login-form.tsx, signup-form.tsx, oauth-buttons.tsx,
|   |-- consent-dialog.tsx
|
|-- shared/                    # Shared generic components
|   |-- empty-state.tsx, error-message.tsx, loading-skeleton.tsx,
|   |-- confirm-dialog.tsx, privacy-notice.tsx, timestamp.tsx
```

### Library Directory

```
lib/
|-- supabase/
|   |-- client.ts              # Browser client (createBrowserClient)
|   |-- server.ts              # Server client (createServerClient)
|   |-- proxy.ts               # Proxy helper (updateSession)
|   |-- admin.ts               # Service role client (scraping/imports)
|
|-- scraper/
|   |-- cheerio-scraper.ts     # Cheerio-based HTML parser
|   |-- diff-engine.ts         # Compare scraped vs. existing data
|   |-- selectors.ts           # Default selector presets
|
|-- utils.ts                   # cn() helper (clsx + tailwind-merge)
|-- constants.ts               # App-wide constants (statuses, roles)
|-- csv-parser.ts              # CSV parsing and validation logic
|-- validators.ts              # Zod schemas for form/API validation
```

### Other Frontend Directories

```
hooks/
|-- use-association.ts         # Current association context hook
|-- use-debounce.ts            # Debounced value hook (for search)
|-- use-players.ts             # Client-side player data hook

types/
|-- database.ts                # Auto-generated Supabase types
|-- index.ts                   # App-level type definitions

public/
|-- images/                    # All images in subfolders by category
|   |-- branding/
|   |   |-- logo.svg, og-image.png
```

---

## Backend Directory (`backend/`)

```
backend/
|-- supabase/
|   |-- config.toml                    # Supabase local dev config
|   |-- seed.sql                       # Development seed data
|   |
|   |-- migrations/                    # Sequential SQL migrations
|   |   |-- 00001_create_enums.sql
|   |   |-- 00002_create_associations.sql
|   |   |-- 00003_create_user_associations.sql
|   |   |-- 00004_create_teams.sql
|   |   |-- 00005_create_tryout_players.sql
|   |   |-- 00006_create_corrections.sql
|   |   |-- 00007_create_scraper_configs.sql
|   |   |-- 00008_create_audit_log.sql
|   |   |-- 00009_create_rls_policies.sql
|   |   |-- 00010_create_helper_functions.sql
|   |   |-- 00011_create_triggers.sql
|   |   |-- 00012_create_indexes.sql
|   |
|   |-- functions/                     # Supabase Edge Functions
|   |   |-- purge-expired-data/index.ts
|   |   |-- purge-warning/index.ts
|
|-- .env.local.example                 # Template for Supabase env vars
```

---

## Infrastructure Directory (`infrastructure/`)

```
infrastructure/
|-- .github/
|   |-- workflows/
|   |   |-- ci.yml                     # Lint + type-check on PR
|   |   |-- deploy-preview.yml         # Vercel preview deployment
|
|-- vercel.json                        # Vercel project config
```

---

## Key Config Files

| File | Location | Purpose |
|------|----------|---------|
| `components.json` | `frontend/` | shadcn/ui configuration (New York style, aliases) |
| `eslint.config.mjs` | `frontend/` | ESLint flat config with Next.js rules |
| `next.config.ts` | `frontend/` | Next.js configuration |
| `package.json` | `frontend/` | Dependencies and npm scripts |
| `postcss.config.mjs` | `frontend/` | PostCSS with `@tailwindcss/postcss` plugin |
| `tsconfig.json` | `frontend/` | TypeScript configuration (strict mode) |
| `proxy.ts` | `frontend/` | Root proxy for session refresh |
| `vercel.json` | `infrastructure/` or root | Vercel deployment configuration |
| `CLAUDE.md` | root | Claude Code instructions for the full project |

---

## Path Alias

`@/*` maps to the `frontend/` project root, configured
in&nbsp;`tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

Use this alias for all imports within the frontend codebase. For
example: `import { cn } from "@/lib/utils"`.
