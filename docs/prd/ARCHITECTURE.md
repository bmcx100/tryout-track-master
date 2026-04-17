# Track Master -- System Architecture Document

**Version:** 1.1
**Date:** 2026-04-17
**Status:** Approved
**Author:** Architecture Design Agent
**Modification:** Updated to three-tier role system (admin, group_admin, member)

---

## Table of Contents

1. [Stack Summary Table](#1-stack-summary-table)
2. [System Architecture Diagram](#2-system-architecture-diagram)
3. [Monorepo Directory Structure](#3-monorepo-directory-structure)
4. [Component Architecture](#4-component-architecture)
5. [Data Architecture](#5-data-architecture)
6. [Authentication Architecture](#6-authentication-architecture)
7. [Scraping Architecture](#7-scraping-architecture)
8. [Deployment Architecture](#8-deployment-architecture)
9. [Architectural Decision Records](#9-architectural-decision-records-adrs)
10. [Performance Strategy](#10-performance-strategy)

---

## 1. Stack Summary Table

| Layer | Technology | Version | Justification |
|-------|-----------|---------|---------------|
| **Framework** | Next.js (App Router) | 16.1.6 | Already initialized in the project. RSC support, `proxy.ts` for auth, Vercel-native deployment. |
| **UI Library** | React | 19.2.3 | Ships with Next.js 16. Async Server Components, `use()` hook, View Transitions. |
| **Language** | TypeScript | 5.x | Strict mode enabled in existing `tsconfig.json`. Type safety across the full stack. |
| **Styling** | Tailwind CSS | 4.x | Already configured with `@tailwindcss/postcss`. OKLCH color space, `@apply` extraction per coding standards. |
| **Components** | shadcn/ui (New York) | Latest | Pre-configured in `components.json`. Radix primitives for accessibility (WCAG 2.1 AA). RSC-compatible. |
| **Backend / DB** | Supabase (PostgreSQL) | Latest | Managed Postgres with RLS, Auth, Edge Functions, and cron. Free tier supports 500MB and 200 concurrent Realtime connections. |
| **Auth** | @supabase/ssr | 0.10.x | Official SSR package. `getAll()`/`setAll()` cookie API, `getClaims()` for JWT validation, PKCE flow. |
| **Scraping** | Cheerio | 1.x | Lightweight HTML parser. No browser overhead. Handles static HTML sites (the common case for Ontario hockey associations). |
| **Scraping Fallback** | Puppeteer-core + @sparticuz/chromium-min | Latest | Serverless-compatible headless browser for JS-rendered sites. Nice to Have feature; deferred unless needed. |
| **Hosting** | Vercel (Hobby) | N/A | Zero-config Next.js deployment. Free tier: 100GB bandwidth, 300s serverless function timeout. |
| **VCS** | Git + GitHub | N/A | Trunk-based development. Single `main` branch with short-lived feature branches. |
| **Linting** | ESLint (Flat Config) | 9.x | Already configured via `eslint-config-next`. Next.js 16 uses flat config format. |
| **Icons** | Lucide React | 0.563.x | Already installed. Tree-shakeable SVG icons. Configured as the shadcn/ui icon library. |

---

## 2. System Architecture Diagram

```
+------------------------------------------------------------------+
|                        CLIENTS                                    |
|  +-------------------+              +------------------------+    |
|  | Mobile Browser    |              | Desktop Browser        |    |
|  | (Member: iOS/     |              | (Group Admin / Admin:  |    |
|  |  Android Safari/  |              |  Chrome/Edge/Firefox)  |    |
|  |  Chrome)          |              |                        |    |
|  +--------+----------+              +-----------+------------+    |
+-----------|--------------------------------------|----------------+
            |                                      |
            v                                      v
+------------------------------------------------------------------+
|                      VERCEL EDGE NETWORK                          |
|                                                                   |
|  +-------------------------------------------------------------+ |
|  |                    proxy.ts                                  | |
|  |  - Session refresh via getClaims()                           | |
|  |  - Redirect unauthenticated users to /login                 | |
|  |  - Exclude static assets via matcher                        | |
|  +-------------------------------------------------------------+ |
|                              |                                    |
|                              v                                    |
|  +-------------------------------------------------------------+ |
|  |              NEXT.JS 16 APP ROUTER                           | |
|  |                                                               | |
|  |  +------------------+  +------------------+  +--------------+ | |
|  |  | Server           |  | Client           |  | API Routes   | | |
|  |  | Components       |  | Components       |  |              | | |
|  |  | (RSC)            |  | ('use client')   |  | /api/scrape  | | |
|  |  |                  |  |                  |  | /api/import  | | |
|  |  | - Page layouts   |  | - Search/filter  |  | /api/correct | | |
|  |  | - Data fetching  |  | - Forms          |  |              | | |
|  |  | - Auth checks    |  | - Drag-and-drop  |  |              | | |
|  |  +--------+---------+  +--------+---------+  +------+-------+ | |
|  |           |                      |                   |         | |
|  +-----------|----------------------|-------------------|--------+ |
|              |                      |                   |         |
+--------------|----- ----------------|- ------------------|--------+
               |                      |                   |
               v                      v                   v
+------------------------------------------------------------------+
|                         SUPABASE                                  |
|                                                                   |
|  +---------------------+  +------------------+  +--------------+  |
|  | PostgreSQL           |  | Auth             |  | Edge         |  |
|  |                      |  |                  |  | Functions    |  |
|  | - associations       |  | - Google OAuth   |  |              |  |
|  | - user_associations  |  | - Email/Password |  | - Data purge |  |
|  | - tryout_players     |  | - PKCE flow      |  |   (cron)     |  |
|  | - teams              |  | - JWT + refresh  |  |              |  |
|  | - corrections        |  |                  |  |              |  |
|  | - scraper_configs    |  +------------------+  +--------------+  |
|  | - audit_log          |                                         |
|  |                      |  +------------------+                   |
|  | RLS on ALL tables    |  | Database         |                   |
|  | Multi-tenant via     |  | Triggers         |                   |
|  | association_id       |  |                  |                   |
|  +---------------------+  | - Auto-apply     |                   |
|                            |   corrections    |                   |
|                            | - Audit logging  |                   |
|                            +------------------+                   |
+------------------------------------------------------------------+
               ^
               | (Scraping flow only)
               |
+------------------------------------------------------------------+
|              EXTERNAL HOCKEY ASSOCIATION WEBSITES                 |
|                                                                   |
|  +---------------------------+  +-----------------------------+   |
|  | Association A Website     |  | Association B Website       |   |
|  | (Static HTML)             |  | (Static HTML)               |   |
|  | Cheerio parses via CSS    |  | Different selectors per     |   |
|  | selectors from config     |  | scraper_configs record      |   |
|  +---------------------------+  +-----------------------------+   |
+------------------------------------------------------------------+
```

### Data Flow Summary

1. **Read path (member):** Browser --> proxy.ts (session refresh) --> RSC page --> Supabase query (RLS filtered) --> rendered HTML streamed to client.
2. **Write path (group admin):** Browser --> Client Component form --> Server Action or API Route --> Supabase mutation (RLS + role check) --> audit_log trigger --> response.
3. **Scrape path:** Group admin triggers --> API route `/api/scrape` --> fetch external URL --> Cheerio parse --> diff against DB --> preview returned --> group admin confirms --> upsert to DB.
4. **Auth path:** Browser --> Supabase OAuth/email --> redirect to `/auth/callback` --> `exchangeCodeForSession()` --> session cookie set --> proxy.ts refreshes on subsequent requests.

---

## 3. Monorepo Directory Structure

```
track-master/
|
|-- frontend/                          # Next.js application
|   |-- app/                           # App Router pages and layouts
|   |   |-- (public)/                  # Route group: unauthenticated pages
|   |   |   |-- page.tsx               # Landing page (/)
|   |   |   |-- login/
|   |   |   |   |-- page.tsx           # Login page
|   |   |   |-- signup/
|   |   |   |   |-- page.tsx           # Signup page
|   |   |   |-- layout.tsx             # Public layout (no nav)
|   |   |
|   |   |-- (app)/                     # Route group: authenticated pages
|   |   |   |-- layout.tsx             # App shell (nav, association context)
|   |   |   |-- dashboard/
|   |   |   |   |-- page.tsx           # Association dashboard
|   |   |   |-- players/
|   |   |   |   |-- page.tsx           # Player list (search, filter, sort)
|   |   |   |   |-- [playerId]/
|   |   |   |   |   |-- page.tsx       # Player detail / correction form
|   |   |   |-- teams/
|   |   |   |   |-- page.tsx           # Team projections view
|   |   |   |-- corrections/
|   |   |   |   |-- page.tsx           # My corrections (member view)
|   |   |   |-- join/
|   |   |   |   |-- page.tsx           # Join association via code
|   |   |   |-- settings/
|   |   |   |   |-- page.tsx           # User settings + privacy
|   |   |
|   |   |-- (admin)/                   # Route group: group admin + admin pages
|   |   |   |-- layout.tsx             # Admin layout (sidebar nav, role check)
|   |   |   |-- admin/
|   |   |   |   |-- page.tsx           # Admin dashboard (stats overview)
|   |   |   |   |-- players/
|   |   |   |   |   |-- page.tsx       # Player management (CRUD, bulk ops)
|   |   |   |   |   |-- import/
|   |   |   |   |   |   |-- page.tsx   # CSV import with preview
|   |   |   |   |-- teams/
|   |   |   |   |   |-- page.tsx       # Team management (create, roster limits)
|   |   |   |   |-- corrections/
|   |   |   |   |   |-- page.tsx       # Correction review queue
|   |   |   |   |-- scraper/
|   |   |   |   |   |-- page.tsx       # Scraper config + run/preview
|   |   |   |   |-- members/
|   |   |   |   |   |-- page.tsx       # Member management (roles, join code)
|   |   |   |   |-- audit/
|   |   |   |   |   |-- page.tsx       # Audit log viewer
|   |   |   |   |-- association/
|   |   |   |   |   |-- page.tsx       # Association settings
|   |   |
|   |   |-- auth/
|   |   |   |-- callback/
|   |   |   |   |-- route.ts           # OAuth/email callback handler
|   |   |   |-- auth-code-error/
|   |   |   |   |-- page.tsx           # Auth error page
|   |   |
|   |   |-- logout/
|   |   |   |-- page.tsx               # Server component: sign out + redirect
|   |   |
|   |   |-- api/
|   |   |   |-- scrape/
|   |   |   |   |-- route.ts           # POST: run scrape, return preview
|   |   |   |   |-- confirm/
|   |   |   |   |   |-- route.ts       # POST: commit scraped data
|   |   |   |-- import/
|   |   |   |   |-- route.ts           # POST: CSV upload and parse
|   |   |   |   |-- confirm/
|   |   |   |   |   |-- route.ts       # POST: commit imported data
|   |   |
|   |   |-- layout.tsx                 # Root layout (fonts, globals.css)
|   |   |-- globals.css                # Tailwind + shadcn theme variables
|   |   |-- favicon.ico
|   |   |-- not-found.tsx              # Custom 404
|   |   |-- error.tsx                  # Global error boundary
|   |   |-- loading.tsx                # Global loading state
|   |
|   |-- components/
|   |   |-- ui/                        # shadcn/ui components (auto-generated)
|   |   |   |-- button.tsx
|   |   |   |-- input.tsx
|   |   |   |-- badge.tsx
|   |   |   |-- card.tsx
|   |   |   |-- dialog.tsx
|   |   |   |-- dropdown-menu.tsx
|   |   |   |-- table.tsx
|   |   |   |-- select.tsx
|   |   |   |-- skeleton.tsx
|   |   |   |-- toast.tsx
|   |   |   |-- ...                    # Additional shadcn components as needed
|   |   |
|   |   |-- layout/                    # Layout components
|   |   |   |-- app-header.tsx         # Authenticated header (nav, user menu)
|   |   |   |-- admin-sidebar.tsx      # Admin sidebar navigation
|   |   |   |-- mobile-nav.tsx         # Mobile bottom nav or hamburger
|   |   |   |-- association-switcher.tsx # Association selector dropdown
|   |   |   |-- footer.tsx             # Footer with privacy link
|   |   |
|   |   |-- players/                   # Player-related components
|   |   |   |-- player-list.tsx        # Main player list (client component)
|   |   |   |-- player-card.tsx        # Individual player row/card
|   |   |   |-- player-filters.tsx     # Filter controls (status, division, team)
|   |   |   |-- player-search.tsx      # Search input (debounced)
|   |   |   |-- status-badge.tsx       # Colored status indicator
|   |   |   |-- player-form.tsx        # Group admin: add/edit player form
|   |   |   |-- bulk-status-bar.tsx    # Group admin: bulk selection toolbar
|   |   |
|   |   |-- teams/                     # Team-related components
|   |   |   |-- team-projection.tsx    # Projected roster view
|   |   |   |-- team-card.tsx          # Team summary card
|   |   |   |-- team-form.tsx          # Group admin: team create/edit
|   |   |   |-- roster-list.tsx        # Players assigned to a team
|   |   |
|   |   |-- corrections/              # Correction-related components
|   |   |   |-- correction-form.tsx    # Member: submit correction
|   |   |   |-- correction-queue.tsx   # Group admin: review queue list
|   |   |   |-- correction-card.tsx    # Single correction item
|   |   |
|   |   |-- scraper/                   # Scraper-related components
|   |   |   |-- scraper-config-form.tsx # Group admin: selector configuration
|   |   |   |-- scrape-preview.tsx     # Diff preview (new/changed/unchanged)
|   |   |   |-- scrape-progress.tsx    # Loading/progress indicator
|   |   |
|   |   |-- import/                    # Import-related components
|   |   |   |-- csv-upload.tsx         # File input + drag-and-drop
|   |   |   |-- import-preview.tsx     # Parsed CSV preview table
|   |   |
|   |   |-- dashboard/                # Dashboard components
|   |   |   |-- stats-cards.tsx        # Summary stat cards
|   |   |   |-- division-summary.tsx   # Per-division breakdown
|   |   |
|   |   |-- auth/                      # Auth-related components
|   |   |   |-- login-form.tsx         # Email/password login
|   |   |   |-- signup-form.tsx        # Registration form
|   |   |   |-- oauth-buttons.tsx      # Google OAuth button
|   |   |   |-- consent-dialog.tsx     # Parental consent modal
|   |   |
|   |   |-- shared/                    # Shared/generic components
|   |   |   |-- empty-state.tsx        # "No data" placeholder
|   |   |   |-- error-message.tsx      # Actionable error display
|   |   |   |-- loading-skeleton.tsx   # Page-level skeleton loader
|   |   |   |-- confirm-dialog.tsx     # Reusable confirmation dialog
|   |   |   |-- privacy-notice.tsx     # Privacy notice component
|   |   |   |-- timestamp.tsx          # Relative + absolute time display
|   |
|   |-- lib/
|   |   |-- supabase/
|   |   |   |-- client.ts             # Browser client (createBrowserClient)
|   |   |   |-- server.ts             # Server client (createServerClient)
|   |   |   |-- proxy.ts              # Proxy helper (updateSession)
|   |   |   |-- admin.ts              # Service role client (for scraping/imports)
|   |   |
|   |   |-- scraper/
|   |   |   |-- cheerio-scraper.ts     # Cheerio-based HTML parser
|   |   |   |-- diff-engine.ts         # Compare scraped vs. existing data
|   |   |   |-- selectors.ts           # Default selector presets
|   |   |
|   |   |-- utils.ts                   # cn() helper (clsx + tailwind-merge)
|   |   |-- constants.ts               # App-wide constants (statuses, roles)
|   |   |-- csv-parser.ts              # CSV parsing and validation logic
|   |   |-- validators.ts              # Zod schemas for form/API validation
|   |
|   |-- hooks/
|   |   |-- use-association.ts         # Current association context hook
|   |   |-- use-debounce.ts            # Debounced value hook (for search)
|   |   |-- use-players.ts             # Client-side player data hook
|   |
|   |-- types/
|   |   |-- database.ts               # Supabase generated types
|   |   |-- index.ts                   # App-level type definitions
|   |
|   |-- proxy.ts                       # Root proxy (calls updateSession)
|   |
|   |-- public/
|   |   |-- images/                    # All images in subfolders
|   |   |   |-- branding/
|   |   |   |   |-- logo.svg
|   |   |   |   |-- og-image.png
|   |
|   |-- components.json               # shadcn/ui configuration
|   |-- eslint.config.mjs             # ESLint flat config
|   |-- next.config.ts                 # Next.js configuration
|   |-- package.json                   # Dependencies and scripts
|   |-- postcss.config.mjs            # PostCSS (Tailwind plugin)
|   |-- tsconfig.json                  # TypeScript configuration
|
|-- backend/                           # Supabase configuration
|   |-- supabase/
|   |   |-- config.toml                # Supabase local dev config
|   |   |
|   |   |-- migrations/               # Database migrations (sequential)
|   |   |   |-- 00001_create_enums.sql
|   |   |   |-- 00002_create_associations.sql
|   |   |   |-- 00003_create_user_associations.sql
|   |   |   |-- 00004_create_teams.sql
|   |   |   |-- 00005_create_tryout_players.sql
|   |   |   |-- 00006_create_corrections.sql
|   |   |   |-- 00007_create_scraper_configs.sql
|   |   |   |-- 00008_create_audit_log.sql
|   |   |   |-- 00009_create_rls_policies.sql
|   |   |   |-- 00010_create_helper_functions.sql
|   |   |   |-- 00011_create_triggers.sql
|   |   |   |-- 00012_create_indexes.sql
|   |   |
|   |   |-- seed.sql                   # Development seed data
|   |   |
|   |   |-- functions/                 # Supabase Edge Functions
|   |   |   |-- purge-expired-data/
|   |   |   |   |-- index.ts           # Cron: delete data 90 days post-season
|   |   |   |-- purge-warning/
|   |   |   |   |-- index.ts           # Cron: warn group admins 30 days before purge
|   |
|   |-- .env.local.example             # Template for Supabase env vars
|
|-- infrastructure/                    # CI/CD and deployment config
|   |-- .github/
|   |   |-- workflows/
|   |   |   |-- ci.yml                 # Lint + type-check on PR
|   |   |   |-- deploy-preview.yml     # Vercel preview deployment
|   |
|   |-- vercel.json                    # Vercel project config (if needed)
|
|-- docs/                              # Project documentation
|   |-- requirements.md                # Product requirements document
|   |-- architecture.md                # Original architecture document
|   |-- prd/                           # Approved PRD documents
|   |   |-- PRD.md                     # Comprehensive PRD
|   |   |-- ER.md                      # Entity-Relationship diagram
|   |   |-- ARCHITECTURE.md            # This document (updated)
|
|-- CLAUDE.md                          # Claude Code instructions
|-- .gitignore
|-- README.md
```

### Notes on Structure

- **`frontend/`** contains the entire Next.js application, including API routes and scraping logic. This is the primary working directory for development. The `@/*` path alias in `tsconfig.json` maps to `frontend/`.
- **`backend/`** contains only Supabase configuration: migrations, seed data, and Edge Functions. These are deployed via the Supabase CLI (`supabase db push`, `supabase functions deploy`).
- **`infrastructure/`** contains CI/CD workflows and Vercel configuration. These are thin wrappers -- Vercel auto-deploys from the `frontend/` directory.
- The current project files (`app/`, `components/`, `lib/`, `package.json`, etc.) will be moved into `frontend/` when the monorepo structure is established.

---

## 4. Component Architecture

### 4.1 Frontend Component Hierarchy

```
RootLayout (app/layout.tsx)
|-- Geist font loading
|-- globals.css (Tailwind + shadcn theme)
|
|-- (public) Layout
|   |-- LandingPage
|   |-- LoginPage
|   |   |-- LoginForm (client)
|   |   |-- OAuthButtons (client)
|   |-- SignupPage
|   |   |-- SignupForm (client)
|   |   |-- OAuthButtons (client)
|
|-- (app) Layout
|   |-- AppHeader
|   |   |-- AssociationSwitcher (client)
|   |   |-- MobileNav (client)
|   |   |-- UserMenu (client)
|   |
|   |-- DashboardPage (server)
|   |   |-- StatsCards
|   |   |-- DivisionSummary
|   |
|   |-- PlayersPage (server: initial fetch, client: interactivity)
|   |   |-- PlayerSearch (client)
|   |   |-- PlayerFilters (client)
|   |   |-- PlayerList (client)
|   |   |   |-- PlayerCard (x N)
|   |   |       |-- StatusBadge
|   |   |       |-- Timestamp
|   |
|   |-- PlayerDetailPage (server)
|   |   |-- PlayerCard
|   |   |-- CorrectionForm (client)
|   |
|   |-- TeamsPage (server)
|   |   |-- TeamProjection (per division)
|   |       |-- TeamCard (x N)
|   |           |-- RosterList
|   |
|   |-- CorrectionsPage (server)
|   |   |-- CorrectionCard (x N)
|   |
|   |-- JoinPage (client)
|   |-- SettingsPage (server + client form)
|
|-- (admin) Layout [Group Admin + Admin access]
|   |-- AdminSidebar
|   |
|   |-- AdminDashboardPage (server)
|   |   |-- StatsCards
|   |   |-- DivisionSummary
|   |
|   |-- AdminPlayersPage (server + client interactivity)
|   |   |-- PlayerSearch (client)
|   |   |-- PlayerFilters (client)
|   |   |-- PlayerList (client, with checkboxes)
|   |   |   |-- BulkStatusBar (client, appears on selection)
|   |   |-- PlayerForm (client, dialog)
|   |
|   |-- ImportPage (client)
|   |   |-- CsvUpload (client)
|   |   |-- ImportPreview (client)
|   |
|   |-- AdminTeamsPage (server + client)
|   |   |-- TeamForm (client, dialog)
|   |   |-- TeamCard (x N, with edit/archive)
|   |
|   |-- CorrectionQueuePage (server)
|   |   |-- CorrectionQueue (client)
|   |       |-- CorrectionCard (x N, with approve/reject)
|   |
|   |-- ScraperPage (client)
|   |   |-- ScraperConfigForm (client)
|   |   |-- ScrapePreview (client)
|   |   |-- ScrapeProgress (client)
|   |
|   |-- MembersPage (server + client)
|   |-- AuditPage (server)
|   |-- AssociationSettingsPage (server + client form)
```

### 4.2 Server vs. Client Component Strategy

| Pattern | Rendering | Rationale |
|---------|-----------|-----------|
| **Page-level data fetching** | Server Component | Fetch data in RSC, pass to client children. No client-side waterfalls. |
| **Interactive lists** (search, filter, sort) | Client Component | Immediate feedback on user input. Data pre-fetched by parent RSC. |
| **Forms** (login, player edit, corrections) | Client Component | Requires state management, validation, and submission handling. |
| **Static content** (dashboard stats, audit log) | Server Component | No interactivity needed. Rendered once on the server. |
| **Layout shells** (header, sidebar) | Mixed | Structure is RSC; interactive elements (dropdowns, mobile nav) are client islands. |

### 4.3 Page Routing Structure

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Public | Landing page with value proposition and CTA |
| `/login` | Public | Email/password + Google OAuth login |
| `/signup` | Public | Registration form |
| `/auth/callback` | Public (route handler) | OAuth/email code exchange |
| `/auth/auth-code-error` | Public | Auth error fallback |
| `/logout` | Authenticated (server) | Sign out and redirect |
| `/dashboard` | Authenticated (all roles) | Association overview for members |
| `/players` | Authenticated (all roles) | Player list with search/filter |
| `/players/[playerId]` | Authenticated (all roles) | Player detail + correction form |
| `/teams` | Authenticated (all roles) | Team projections view |
| `/corrections` | Authenticated (all roles) | My submitted corrections |
| `/join` | Authenticated (all roles) | Join an association via code |
| `/settings` | Authenticated (all roles) | User preferences + privacy |
| `/admin` | Group Admin + Admin | Admin dashboard |
| `/admin/players` | Group Admin + Admin | Player CRUD + bulk operations |
| `/admin/players/import` | Group Admin + Admin | CSV import with preview |
| `/admin/teams` | Group Admin + Admin | Team management |
| `/admin/corrections` | Group Admin + Admin | Correction review queue |
| `/admin/scraper` | Group Admin + Admin | Scraper configuration + execution |
| `/admin/members` | Group Admin + Admin | Member list + role management |
| `/admin/audit` | Group Admin + Admin | Audit trail viewer |
| `/admin/association` | Group Admin + Admin | Association settings (name, join code) |

### 4.4 API Route Structure

| Route | Method | Auth | Description |
|-------|--------|------|-------------|
| `/api/scrape` | POST | Group Admin + Admin | Execute scrape against configured URL, return preview diff |
| `/api/scrape/confirm` | POST | Group Admin + Admin | Commit previewed scrape results to database |
| `/api/import` | POST | Group Admin + Admin | Parse uploaded CSV, return preview |
| `/api/import/confirm` | POST | Group Admin + Admin | Commit previewed import to database |
| `/auth/callback` | GET | Public | Exchange auth code for session (OAuth + email confirmation) |

**Note:** Most data mutations (player CRUD, corrections, team management) are handled via Server Actions rather than API routes. API routes are reserved for operations that require multipart form data (CSV upload) or long-running processes (scraping).

---

## 5. Data Architecture

### 5.1 Entity-Relationship Diagram

The full ER diagram with detailed table definitions is maintained in [ER.md](./ER.md).

```
+------------------+         +---------------------+
|   auth.users     |         |   associations      |
|  (Supabase-      |         |                     |
|   managed)       |         |  id (PK, uuid)      |
|                  |         |  name                |
|  id (PK, uuid)   |         |  abbreviation        |
|  email           |         |  logo_url            |
|  ...             |         |  join_code (unique)  |
+--------+---------+         |  join_enabled        |
         |                   |  season_end_date     |
         |                   |  data_purge_date     |
         |  1                |  created_at          |
         |                   |  updated_at          |
         |                   +----------+-----------+
         |                              | 1
         |                              |
         +----------+-------------------+
                    |
         +----------v-----------+
         |  user_associations   |
         |                      |
         |  user_id (FK)   PK   |
         |  association_id (FK) |  (composite PK)
         |  role (app_role)     |  -- admin | group_admin | member
         |  joined_at           |
         |  consent_given_at    |
         +----------------------+
```

### 5.2 Database Schema Overview

#### Enums

```sql
CREATE TYPE player_status AS ENUM (
  'registered', 'trying_out', 'cut',
  'made_team', 'moved_up', 'moved_down', 'withdrew'
)

CREATE TYPE app_role AS ENUM (
  'admin',        -- Site-level platform administrator
  'group_admin',  -- Association-level manager
  'member'        -- Regular user (parent)
)

CREATE TYPE correction_status AS ENUM ('pending', 'approved', 'rejected')
```

#### Table Definitions (Summary)

| Table | Primary Key | Key Columns | Indexes |
|-------|------------|-------------|---------|
| `associations` | `id` (uuid, gen) | `join_code` (unique), `season_end_date` | `join_code` |
| `user_associations` | (`user_id`, `association_id`) | `role` (app_role) | `association_id`, `user_id` |
| `teams` | `id` (uuid, gen) | `association_id`, `division`, `display_order` | (`association_id`, `division`) |
| `tryout_players` | `id` (uuid, gen) | `association_id`, `division`, `status`, `team_id`, `deleted_at` | (`association_id`, `division`, `status`), (`association_id`, `name`) |
| `corrections` | `id` (uuid, gen) | `player_id`, `user_id`, `association_id`, `status` | (`association_id`, `status`), (`player_id`, `field_name`, `status`) |
| `scraper_configs` | `id` (uuid, gen) | `association_id`, `url`, `selectors` (JSONB) | `association_id` |
| `audit_log` | `id` (uuid, gen) | `association_id`, `user_id`, `action`, `created_at` | (`association_id`, `created_at` DESC) |

#### Key Indexes

```sql
-- Player list queries (the most common operation)
CREATE INDEX idx_players_assoc_div_status
  ON tryout_players (association_id, division, status)
  WHERE deleted_at IS NULL

-- Player search by name
CREATE INDEX idx_players_assoc_name
  ON tryout_players (association_id, name)
  WHERE deleted_at IS NULL

-- Pending corrections count (group admin badge)
CREATE INDEX idx_corrections_pending
  ON corrections (association_id, status)
  WHERE status = 'pending'

-- Audit log chronological view
CREATE INDEX idx_audit_assoc_created
  ON audit_log (association_id, created_at DESC)

-- Join code lookup
CREATE UNIQUE INDEX idx_assoc_join_code
  ON associations (join_code)

-- Duplicate correction prevention
CREATE UNIQUE INDEX idx_corrections_unique_pending
  ON corrections (player_id, field_name)
  WHERE status = 'pending'
```

### 5.3 RLS Strategy Summary

#### Core Principles

1. **Every table has RLS enabled.** No exceptions.
2. **Multi-tenant isolation via `association_id`.** Users can only see data for associations they belong to.
3. **Role checks use SECURITY DEFINER helper functions.** This avoids embedding role-check logic in every policy.
4. **Write operations require group_admin or admin role** (except corrections, which members can create).

#### Helper Functions (SECURITY DEFINER)

```sql
-- Check if the authenticated user belongs to an association
CREATE FUNCTION user_belongs_to_association(assoc_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_associations
    WHERE user_id = auth.uid()
      AND association_id = assoc_id
  )
$$

-- Check if the authenticated user is a group admin for an association
CREATE FUNCTION user_is_group_admin(assoc_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_associations
    WHERE user_id = auth.uid()
      AND association_id = assoc_id
      AND role = 'group_admin'
  )
$$

-- Check if the authenticated user is a group admin OR site-level admin
CREATE FUNCTION user_is_group_admin_or_admin(assoc_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_associations
    WHERE user_id = auth.uid()
      AND association_id = assoc_id
      AND role IN ('group_admin', 'admin')
  )
  OR EXISTS (
    SELECT 1 FROM user_associations
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
$$

-- Check if the authenticated user is a site-level admin
CREATE FUNCTION user_is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_associations
    WHERE user_id = auth.uid()
      AND role = 'admin'
  )
$$
```

#### Policy Matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
|-------|--------|--------|--------|--------|
| `associations` | Member of association OR admin | Group admin or admin (create) | Group admin (own) or admin | Never (soft operations only) |
| `user_associations` | Own rows only (or admin sees all) | Self (join via code) or admin | Group admin (own assoc) or admin (role changes) | Group admin (own assoc) or admin (remove members) |
| `tryout_players` | Member of association OR admin | Group admin (own assoc) or admin | Group admin (own assoc) or admin | Group admin (own assoc) or admin (soft delete) |
| `teams` | Member of association OR admin | Group admin (own assoc) or admin | Group admin (own assoc) or admin | Group admin (own assoc) or admin |
| `corrections` | Own rows (member) or all in assoc (group admin) or all (admin) | Member of association | Group admin (own assoc) or admin (approve/reject) | Never |
| `scraper_configs` | Group admin (own assoc) or admin | Group admin (own assoc) or admin | Group admin (own assoc) or admin | Group admin (own assoc) or admin |
| `audit_log` | Group admin (own assoc) or admin (all) | System only (via triggers) | Never | Never |

#### Example RLS Policies

```sql
-- tryout_players: anyone in the association can read active players
CREATE POLICY "Members can view players"
  ON tryout_players FOR SELECT
  USING (
    user_belongs_to_association(association_id)
    AND deleted_at IS NULL
  )

-- tryout_players: group admins and admins can insert
CREATE POLICY "Group admins can create players"
  ON tryout_players FOR INSERT
  WITH CHECK (
    user_is_group_admin_or_admin(association_id)
  )
```

---

## 6. Authentication Architecture

### 6.1 Auth Flow Diagrams

#### Email/Password Signup

```
User                        Next.js App                 Supabase Auth
  |                             |                             |
  |  1. Fill signup form        |                             |
  |  ----- POST /signup ------> |                             |
  |                             |  2. signUp({email, pass,    |
  |                             |     emailRedirectTo:        |
  |                             |     /auth/callback})        |
  |                             |  --------------------------> |
  |                             |                             |  3. Send
  |                             |                             |  confirmation
  |                             |                             |  email
  |  4. Click email link        |                             |
  |  ---- GET /auth/callback?code=xxx ----------------------> |
  |                             |                             |
  |                             |  5. exchangeCodeForSession  |
  |                             |     (code)                  |
  |                             |  --------------------------> |
  |                             |  <-- session cookies ------  |
  |                             |                             |
  |  <-- redirect to /join --   |                             |
  |                             |                             |
```

#### Google OAuth

```
User                        Next.js App         Supabase Auth      Google
  |                             |                     |               |
  |  1. Click "Sign in          |                     |               |
  |     with Google"            |                     |               |
  |  -------------------------> |                     |               |
  |                             |  2. signInWithOAuth |               |
  |                             |     ({provider:     |               |
  |                             |      'google',      |               |
  |                             |      redirectTo:    |               |
  |                             |      /auth/callback,|               |
  |                             |      prompt:        |               |
  |                             |      'select_       |               |
  |                             |       account'})    |               |
  |                             |  -----------------> |               |
  |                             |                     |  3. Redirect  |
  |  <--- redirect to Google ---|---------------------|-------------> |
  |                             |                     |               |
  |  4. Authenticate            |                     |               |
  |  -------------------------------------------------------- POST > |
  |                             |                     |  <-- code --- |
  |                             |                     |               |
  |  <-- redirect /auth/callback?code=xxx ----------- |               |
  |                             |                     |               |
  |                             |  5. exchangeCode    |               |
  |                             |     ForSession      |               |
  |                             |  -----------------> |               |
  |                             |  <-- session -----  |               |
  |                             |                     |               |
  |  <-- redirect /dashboard -- |                     |               |
```

#### Session Refresh (Every Request)

```
Browser                    proxy.ts                  Supabase Auth
  |                            |                           |
  |  GET /players              |                           |
  |  (with session cookies)    |                           |
  |  ------------------------> |                           |
  |                            |  1. createServerClient    |
  |                            |     (read cookies)        |
  |                            |                           |
  |                            |  2. getClaims()           |
  |                            |     (local JWT validate)  |
  |                            |  -----------------------> |
  |                            |                           |
  |                            |  [If token near expiry]   |
  |                            |  <-- new tokens + cache   |
  |                            |      busting headers --   |
  |                            |                           |
  |                            |  3. If no valid session:  |
  |                            |     redirect to /login    |
  |                            |                           |
  |                            |  4. If valid:             |
  |                            |     NextResponse.next()   |
  |                            |     with updated cookies  |
  |                            |                           |
  |  <-- page + fresh cookies  |                           |
```

### 6.2 Session Management Approach

| Aspect | Implementation |
|--------|---------------|
| **Token storage** | HttpOnly, Secure, SameSite=Lax cookies managed by `@supabase/ssr` |
| **Token refresh** | Automatic in `proxy.ts` via `getClaims()`. Refreshed tokens are set in response cookies. |
| **Token validation** | `getClaims()` validates JWT locally (no network call to Supabase Auth server). Fast and reliable. |
| **Session creation** | `exchangeCodeForSession()` in `/auth/callback` route handler (for OAuth and email confirmation). `signInWithPassword()` on the client for email/password login. |
| **Session destruction** | `signOut()` called in the `/logout` server component page. Cookies are cleared. |
| **Client access** | `createBrowserClient()` from `@supabase/ssr`. Reads cookies for session state. |
| **Server access** | `createServerClient()` from `@supabase/ssr` with `getAll()`/`setAll()` cookie API. Async `cookies()` call (Next.js 16 requirement). |

### 6.3 Role-Based Access Control

#### Role Model (Three-Tier)

```
auth.users (Supabase-managed)
    |
    +-- user_associations (per association)
          |-- role: 'admin'       --> site-level: full access to ALL associations
          |-- role: 'group_admin' --> association-level: full read/write to association data
          |-- role: 'member'      --> read access + correction submission
```

A single user can have different roles in different associations (e.g., group_admin in one, member in another). The `admin` role is special and grants cross-association access.

#### Enforcement Layers

| Layer | Mechanism | Purpose |
|-------|-----------|---------|
| **Database (RLS)** | `user_is_group_admin_or_admin()` / `user_belongs_to_association()` helper functions in RLS policies | Ground truth. Cannot be bypassed regardless of how data is accessed. |
| **Proxy (proxy.ts)** | Session validation via `getClaims()`. Redirects unauthenticated users. | Gate unauthenticated requests. Does NOT check roles (that is the DB's job). |
| **Server Components** | Query `user_associations` to determine role. Conditionally render admin UI. | UX-level hiding. Not a security boundary. |
| **Route Group Layouts** | `(admin)/layout.tsx` checks role on the server and redirects members. | Navigation guard. Backed by RLS as the true security layer. |
| **API Routes** | Check session + role before executing logic. RLS provides the fallback. | Defense in depth. |

#### Admin Route Protection Pattern

```typescript
// app/(admin)/layout.tsx
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Check if user is a group_admin for current association or a site-level admin
  const { data: membership } = await supabase
    .from('user_associations')
    .select('role')
    .eq('user_id', user.id)
    .eq('association_id', /* current association from cookie/param */)
    .single()

  const isAdmin = membership?.role === 'group_admin' || membership?.role === 'admin'
  if (!isAdmin) redirect('/dashboard')

  return <>{children}</>
}
```

---

## 7. Scraping Architecture

### 7.1 Scraping Flow Diagram

```
+-----------+     +-------------+     +---------------+     +------------+
| Group     |     | /admin/     |     | POST          |     | External   |
| Admin     | --> | scraper     | --> | /api/scrape   | --> | Hockey     |
| Browser   |     | (page)      |     | (route)       |     | Website    |
+-----------+     +-------------+     +-------+-------+     +------+-----+
                                              |                     |
                                              | 1. Read scraper_    |
                                              |    config from DB   |
                                              |                     |
                                              | 2. fetch(url)       |
                                              | ------------------> |
                                              | <-- HTML ---------- |
                                              |                     |
                                              | 3. Cheerio.load(html)
                                              |    Apply CSS selectors
                                              |    Extract player rows
                                              |
                                              | 4. diff-engine.ts:
                                              |    Compare scraped data
                                              |    vs. existing DB records
                                              |
                                              | 5. Return preview:
                                              |    { new: [...],
                                              |      changed: [...],
                                              |      unchanged: [...],
                                              |      warnings: [...] }
                                              |
                                              v
+-----------+     +-------------+     +-------+-------+
| Group     | <-- | Scrape      | <-- | Preview JSON  |
| Admin     |     | Preview UI  |     |               |
| reviews   |     | (component) |     +---------------+
| diff      |     +------+------+
+-----------+            |
              Group Admin clicks "Confirm Import"
                         |
                         v
                  +------+------+     +---------------+
                  | POST        |     | Supabase DB   |
                  | /api/scrape | --> |               |
                  | /confirm    |     | - Upsert      |
                  |             |     |   tryout_      |
                  |             |     |   players      |
                  |             |     | - Insert       |
                  |             |     |   audit_log    |
                  |             |     | - Update       |
                  |             |     |   scraper_     |
                  |             |     |   configs.     |
                  |             |     |   last_scraped |
                  +-------------+     +---------------+
```

### 7.2 Scraper Configuration Approach

Each association stores one or more `scraper_configs` records. The `selectors` column is a JSONB object defining CSS selectors for each data field.

#### Selectors Schema

```typescript
interface ScraperSelectors {
  // Container selector for each player row
  row: string           // e.g., "table.results tbody tr"

  // Selectors relative to each row
  name: string          // e.g., "td:nth-child(1)"
  jersey_number: string // e.g., "td:nth-child(2)"
  status: string        // e.g., "td:nth-child(3)"
  team: string          // e.g., "td:nth-child(4)" (optional)
  division: string      // e.g., "td:nth-child(5)" (optional, can be page-level)

  // Status value mapping (site-specific text to our enum)
  status_map: Record<string, string>
  // e.g., { "RELEASED": "cut", "ACTIVE": "trying_out", "ROSTERED": "made_team" }
}
```

#### Configuration Workflow

1. Group admin enters the target URL.
2. Group admin uses a "test" mode that fetches the page and shows the raw HTML structure.
3. Group admin configures CSS selectors (with helper presets for common table layouts).
4. Group admin maps status text from the website to Track Master's `player_status` enum values.
5. Group admin saves the config and runs a test scrape to verify.

### 7.3 Error Handling Strategy

| Error | Detection | Response |
|-------|-----------|----------|
| **URL unreachable** (DNS, timeout, 4xx/5xx) | `fetch()` throws or returns error status | Show error message with HTTP status. Suggest checking URL. Retry button. |
| **HTML structure changed** (selectors return empty) | Cheerio query returns 0 rows or all-null fields | Warn group admin: "No players found. The website structure may have changed. Please update your selectors." |
| **Partial parse failures** (some rows parsed, others not) | Per-row try/catch. Count successes vs. failures. | Show preview with valid rows. List failed rows with reasons. Group admin can proceed with partial import. |
| **Status text mismatch** (scraped status not in status_map) | Lookup in `status_map` returns `undefined` | Mark row with "Unknown status" warning. Group admin can manually map or skip. |
| **Duplicate detection** (scraped player matches existing by name+jersey+division) | diff-engine comparison | Mark as "changed" (if fields differ) or "unchanged" (if identical). Preview shows diff. |
| **Timeout** (Vercel 300s limit) | AbortController with 55-second timeout | "Scrape timed out. The target website may be slow or too large." |
| **Rate limiting by target site** | HTTP 429 response | "The target website is rate-limiting requests. Please wait a few minutes and try again." |

#### Retry and Resilience

- Single retry with 5-second delay for 5xx errors.
- No retry for 4xx errors (likely permanent).
- 55-second timeout per scrape (leaving buffer within Vercel's 300s limit, though scraping is expected to complete in under 30s for static HTML).
- All scrape operations are group-admin-initiated (no scheduled scraping in MVP).

---

## 8. Deployment Architecture

### 8.1 Vercel Deployment Configuration

```
Vercel Project Settings:
  - Framework Preset: Next.js
  - Root Directory: frontend/
  - Build Command: npm run build (default)
  - Output Directory: .next (default)
  - Node.js Version: 20.x
  - Install Command: npm install (default)
```

#### vercel.json (if needed)

```json
{
  "buildCommand": "npm run build",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

#### Deployment Strategy

- **Production:** Auto-deploy from `main` branch.
- **Previews:** Auto-deploy from pull request branches. Each PR gets a unique preview URL.
- **No manual deployments.** Everything goes through Git.

### 8.2 Supabase Project Setup

#### Project Configuration

```
Supabase Project:
  - Plan: Free (initial), Pro if needed ($25/mo)
  - Region: us-east-1 (closest to Ontario, Canada)
  - Database: PostgreSQL 15+
  - Auth Providers: Email/Password, Google OAuth
  - PKCE Flow: Enabled (default for SSR)
```

#### Local Development

```bash
# Install Supabase CLI
npm install -g supabase

# Initialize (one-time)
cd backend
supabase init

# Start local Supabase (Docker required)
supabase start

# Apply migrations
supabase db push

# Generate TypeScript types
supabase gen types typescript --local > ../frontend/types/database.ts

# Deploy Edge Functions
supabase functions deploy purge-expired-data
supabase functions deploy purge-warning
```

#### Scheduled Functions (Cron)

```sql
-- In Supabase dashboard or via migration:
-- Run data purge check daily at 3:00 AM UTC
SELECT cron.schedule(
  'purge-expired-data',
  '0 3 * * *',
  $$SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/purge-expired-data',
    headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
  )$$
)

-- Run purge warning check daily at 3:30 AM UTC
SELECT cron.schedule(
  'purge-warning',
  '30 3 * * *',
  $$SELECT net.http_post(
    url := 'https://<project-ref>.supabase.co/functions/v1/purge-warning',
    headers := '{"Authorization": "Bearer <service_role_key>"}'::jsonb
  )$$
)
```

### 8.3 Environment Variables

#### Frontend (`frontend/.env.local`)

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJ...  # anon/publishable key
SUPABASE_SERVICE_ROLE_KEY=eyJ...             # server-side only, NEVER exposed

# App
NEXT_PUBLIC_APP_URL=https://trackmaster.app  # or localhost:3000 for dev
```

#### Backend (`backend/.env.local`)

```bash
# Supabase CLI (for local dev)
SUPABASE_ACCESS_TOKEN=sbp_...
SUPABASE_PROJECT_ID=<project-ref>
SUPABASE_DB_PASSWORD=<db-password>
```

#### Vercel Environment Variables

| Variable | Environment | Exposed to Client |
|----------|-------------|-------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | All | Yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | All | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | All | No (server only) |
| `NEXT_PUBLIC_APP_URL` | Per environment | Yes |

### 8.4 CI/CD Pipeline

```yaml
# infrastructure/.github/workflows/ci.yml
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

---

## 9. Architectural Decision Records (ADRs)

### ADR-001: Server Components for Data Fetching, Client Components for Interactivity

**Context:** Next.js 16 with App Router supports both React Server Components (RSC) and Client Components. The player list page is the most visited page, requiring both fast initial load and rich interactivity (search, filter, sort). We need a clear strategy for when to use each component type.

**Decision:** Use Server Components for all page-level data fetching (database queries via `createServerClient`). Pass the fetched data as props to Client Component children that handle interactivity. Forms, search inputs, filter controls, and any component requiring `useState`, `useEffect`, or browser APIs are Client Components marked with `'use client'`.

**Consequences:**
- (+) Initial page loads are fast because data is fetched on the server with zero client-side waterfalls.
- (+) Sensitive data (service role key, raw SQL) never reaches the client bundle.
- (+) Search and filter operate on pre-fetched data client-side, giving sub-300ms response times for lists under 500 players.
- (-) Data can become stale after initial load. Users must refresh or navigate to get updated data. Acceptable for MVP since Realtime is deferred.
- (-) Requires careful boundary management between server and client components. `'use client'` directives must be placed at the right level.

---

### ADR-002: proxy.ts with getClaims() for Session Management

**Context:** Next.js 16 replaces `middleware.ts` with `proxy.ts`. Supabase Auth requires session refresh on every request to prevent random logouts. The official documentation specifies using `getClaims()` (local JWT validation, no network call) rather than `getUser()` (network call to Supabase Auth server on every request).

**Decision:** Use `proxy.ts` at the project root with a matcher that excludes static assets. The proxy calls `updateSession()` from `@/lib/supabase/proxy`, which creates a fresh `ServerClient` per request and calls `getClaims()` to validate/refresh the JWT. Unauthenticated users on protected routes are redirected to `/login`. The proxy does NOT enforce role-based access -- that is handled by RLS and route-level server checks.

**Consequences:**
- (+) Sessions are refreshed transparently. Users are never randomly logged out.
- (+) `getClaims()` is fast (local JWT validation) and does not add latency to every request.
- (+) Follows the exact canonical pattern from the Supabase + Next.js 16 documentation.
- (-) Proxy runs on every matched request, adding minimal overhead (~1-2ms for JWT validation).
- (-) Proxy cannot enforce role-based access because it does not query the database. Role checks must happen in layouts, server components, or RLS.

---

### ADR-003: Multi-Tenant Data Isolation via association_id and RLS

**Context:** Track Master serves 2-3 Ontario hockey associations, each with their own players, teams, and group admins. A member might belong to multiple associations. Data from one association must never leak to users of another. The system must enforce this at the database level, not just in application code.

**Decision:** Every data table (`tryout_players`, `teams`, `corrections`, `scraper_configs`, `audit_log`) has an `association_id` foreign key. Row-Level Security (RLS) policies on every table use SECURITY DEFINER helper functions (`user_belongs_to_association()`, `user_is_group_admin_or_admin()`) to verify that the authenticated user has a `user_associations` record for the requested `association_id`. No table is accessible without RLS. Direct database access without authentication returns zero rows.

**Consequences:**
- (+) Tenant isolation is enforced at the database level. Application-level bugs cannot leak data across associations.
- (+) SECURITY DEFINER functions centralize role-check logic, reducing policy duplication.
- (+) The pattern scales to any number of associations without schema changes.
- (-) Every query incurs a slight overhead for the RLS policy check (mitigated by indexed `user_associations` lookups).
- (-) SECURITY DEFINER functions run as the function owner (typically `postgres`), so they must be carefully written to avoid privilege escalation.
- (-) Debugging RLS-related "zero rows returned" issues can be confusing for the developer. Supabase dashboard logs help.

---

### ADR-004: Cheerio for Web Scraping with Configurable CSS Selectors

**Context:** Hockey association websites publish tryout results as HTML pages. The markup structure varies across associations. We need a scraping solution that works within Vercel's serverless constraints (250MB bundle, 300s timeout), is configurable per association, and handles the common case of static HTML tables.

**Decision:** Use Cheerio (server-side HTML parser) as the primary scraping engine. Scraper configurations (URL, CSS selectors, status text mapping) are stored per association in the `scraper_configs` database table. Scraping is initiated manually by group admins via an API route. Results are previewed before committing. Puppeteer-core with `@sparticuz/chromium-min` is reserved as a Nice to Have fallback for JavaScript-rendered sites.

**Consequences:**
- (+) Cheerio is lightweight (~200KB), fast, and has zero browser overhead. Scrapes complete in seconds.
- (+) Configurable selectors allow each association to customize extraction without code changes.
- (+) Preview-before-commit workflow prevents bad parses from corrupting data.
- (+) Stays well within Vercel's bundle size and timeout limits.
- (-) Cannot scrape JavaScript-rendered pages without the Puppeteer fallback.
- (-) Selector configuration requires some technical knowledge from the group admin. Presets and a test mode mitigate this.
- (-) If a target website changes its HTML structure, the scraper breaks silently until the group admin updates selectors. The preview step catches this before data is written.

---

### ADR-005: Server Actions for Mutations, API Routes for File Uploads and Scraping

**Context:** Next.js 16 supports both Server Actions (inline `'use server'` functions called directly from components) and API Routes (traditional REST endpoints in `app/api/`). We need a consistent pattern for handling data mutations (player CRUD, corrections, team management) and more complex operations (CSV upload, scraping).

**Decision:** Use Server Actions for standard CRUD mutations (create/update/delete player, approve/reject correction, create team, etc.). Server Actions are co-located with the components that use them or in dedicated `actions/` files. Use API Routes (`app/api/`) for operations that require multipart form data (CSV upload), long-running processes (scraping), or need to return complex preview data before committing.

**Consequences:**
- (+) Server Actions provide a simpler mental model for CRUD: call a function, get a result. No fetch boilerplate.
- (+) Server Actions are type-safe end-to-end with TypeScript.
- (+) API Routes handle the edge cases (file uploads, streaming progress) that Server Actions are not designed for.
- (-) Two mutation patterns (Server Actions + API Routes) add some inconsistency. Clear conventions (documented here) mitigate confusion.
- (-) Server Actions cannot return streaming responses, so scraping progress must use a polling or API Route approach.

---

### ADR-006: Client-Side Filtering with Server-Fetched Data for Player Lists

**Context:** The player list is the most-used page. It supports search by name/jersey number, filter by status/division/team, and must handle up to 500 players with sub-300ms interactions. The system must work well on mobile 4G connections.

**Decision:** Fetch the full player list for an association on the server (RSC) and pass it to a Client Component. All search, filter, and sort operations happen client-side on the pre-fetched data using JavaScript array methods. For associations with more than 500 players (unlikely in MVP but future-proofed), fall back to server-side filtering via Supabase queries with pagination.

**Consequences:**
- (+) Client-side filtering is instantaneous. No network roundtrips for search or filter changes.
- (+) Server-fetched data means fast initial load (no client-side waterfall).
- (+) Single data fetch per page load reduces Supabase API calls (good for free tier limits).
- (-) Full dataset is transferred on page load (~500 players x ~200 bytes each = ~100KB uncompressed, ~15KB gzipped). Acceptable.
- (-) Data goes stale after page load. Users must refresh to see updates. Acceptable for MVP.
- (-) If player counts exceed 500 significantly, client-side performance may degrade. Virtualized scrolling (e.g., `react-window`) would be added at that point.

---

### ADR-007: Monorepo with Logical Separation (frontend/backend/infrastructure)

**Context:** The project is built by a solo developer in under 4 weeks. It consists of a Next.js frontend, Supabase backend configuration (migrations, edge functions), and CI/CD infrastructure. These need to live in a single repository for simplicity but remain logically organized.

**Decision:** Structure the repository as a monorepo with three top-level directories: `frontend/` (Next.js app with all application code, API routes, and scraping logic), `backend/` (Supabase migrations, seed data, and Edge Functions), and `infrastructure/` (GitHub Actions workflows, Vercel configuration). The `frontend/` directory is the Vercel deployment root. No workspace tooling (Turborepo, Nx) is used -- the separation is purely directory-based.

**Consequences:**
- (+) Single repository means one `git clone`, one PR for cross-cutting changes, one place to search.
- (+) Clear separation of concerns: application code, database schema, and deployment config each have a home.
- (+) No workspace tooling overhead. Simple `cd frontend && npm install` workflow.
- (-) No shared dependency deduplication across directories (only `frontend/` has a `package.json`). Edge Functions in `backend/` manage their own Deno dependencies.
- (-) CI/CD must be aware of directory structure (e.g., only run lint on `frontend/` changes).
- (-) Moving existing project files into `frontend/` requires updating `@/*` path aliases in `tsconfig.json` and `components.json`.

---

### ADR-008: Three-Tier Role System (Admin, Group Admin, Member)

**Context:** The original architecture specified a two-tier role system (`admin` and `parent`). During review, it was determined that a site-level administrative role was needed separately from association-level management. The platform needs someone who can manage all associations, resolve cross-cutting issues, and perform platform-wide operations, while association managers should be scoped to their own association's data.

**Decision:** Expand the `app_role` enum from two values (`admin`, `parent`) to three values (`admin`, `group_admin`, `member`). The `admin` role is a site-level platform administrator with access to all associations. The `group_admin` role replaces the original `admin` for association-level operations. The `member` role replaces `parent` for regular users who view data and submit corrections.

**Consequences:**
- (+) Clear separation between platform administration and association management.
- (+) Site-level admin can resolve issues across all associations without needing individual membership.
- (+) Terminology is more inclusive -- "member" is more accurate than "parent" since not all users may be parents.
- (+) Group admins can operate independently without platform admin intervention for day-to-day tasks.
- (-) Adds complexity to RLS policies, which must now check for both `group_admin` and `admin` roles for write operations.
- (-) Helper functions need to handle the three-tier hierarchy (e.g., `user_is_group_admin_or_admin()`).
- (-) Minor migration effort to update all references from the two-tier to three-tier system.

---

## 10. Performance Strategy

### 10.1 Caching Approach

| Cache Layer | Mechanism | TTL | Invalidation |
|-------------|-----------|-----|-------------|
| **Vercel Edge Cache** | Static assets (`_next/static/`, images, fonts) | Long-lived (immutable content hashing) | Automatic on deploy |
| **Next.js Data Cache** | `fetch()` calls with `cacheLife()` / `cacheTag()` in RSC | Varies by data type (see below) | `revalidateTag()` on mutations |
| **Browser Cache** | HTTP Cache-Control headers on API responses | 0 (no-store for dynamic data) | N/A |
| **Client State** | React state in Client Components (player list, filters) | Session duration (until page refresh) | User-initiated refresh |

#### Cache Tags Strategy

| Data | Cache Tag Pattern | Revalidation Trigger |
|------|-------------------|---------------------|
| Player list | `players-{associationId}` | Player CRUD, import, scrape confirm, correction approve |
| Team list | `teams-{associationId}` | Team CRUD, player team assignment |
| Dashboard stats | `stats-{associationId}` | Any player status change |
| Corrections count | `corrections-{associationId}` | Correction create, approve, reject |

### 10.2 Data Fetching Patterns

| Page | Pattern | Rationale |
|------|---------|-----------|
| **Landing page** (`/`) | Static Generation (no data) | Purely static marketing page. Fastest possible load. |
| **Player list** (`/players`) | Server Component fetch + Client Component interactivity | Fetch full player list on server. Client handles search/filter. Avoids waterfall. |
| **Player detail** (`/players/[id]`) | Server Component fetch | Single player data. No interactivity needed beyond the correction form. |
| **Dashboard** (`/dashboard`) | Server Component fetch | Aggregate queries (counts by status, division). No interactivity. |
| **Admin player management** (`/admin/players`) | Server Component fetch + Client Component for bulk operations | Same pattern as member player list, with additional group admin controls. |
| **Correction queue** (`/admin/corrections`) | Server Component fetch | List of pending corrections. Approve/reject via Server Actions. |
| **Scraper** (`/admin/scraper`) | Client Component (fully interactive) | Configuration form, scrape trigger, preview -- all require client state. |
| **CSV import** (`/admin/players/import`) | Client Component (file upload) | File input, parse preview, confirm -- all client-side until commit. |

### 10.3 Mobile Optimization

| Optimization | Implementation | Target |
|-------------|---------------|--------|
| **LCP < 2.5s** | Server-side rendering for initial data. No client-side data fetching waterfalls. Optimize largest element (player list first items). | NFR-001 |
| **Touch targets >= 44x44px** | shadcn/ui button and input components meet this by default. Custom components use `min-h-11 min-w-11` (44px). | FR-036 |
| **Minimal JS bundle** | RSC reduces client bundle. Only interactive components ship JS. Tree-shake Lucide icons. | General |
| **Responsive images** | `next/image` with `sizes` attribute for responsive loading. All images in `public/images/`. | General |
| **Debounced search** | 300ms debounce on search input to avoid excessive re-renders. `useDebounce` custom hook. | NFR-003 |
| **Skeleton loaders** | `Skeleton` component from shadcn/ui shown during page transitions and async operations. | NFR-024 |
| **Error boundaries** | `error.tsx` at the root and per route group. Actionable error messages ("Tap to retry"). | NFR-024 |
| **Viewport meta** | Already set by Next.js. `width=device-width, initial-scale=1`. | General |
| **Font optimization** | Geist font loaded via `next/font/google` (already configured). Subset to `latin`. No FOUT. | General |
| **Gzip/Brotli compression** | Handled automatically by Vercel's edge network. | General |

### 10.4 Database Query Optimization

| Query Pattern | Optimization |
|--------------|-------------|
| Player list by association + division + status | Composite index `(association_id, division, status)` with partial index `WHERE deleted_at IS NULL` |
| Player search by name | Index on `(association_id, name)` with partial index `WHERE deleted_at IS NULL`. `ILIKE` search with `%term%` pattern. For 500 players, this is fast enough without full-text search. |
| Pending corrections count | Partial index on `(association_id, status) WHERE status = 'pending'`. Single `COUNT(*)` query. |
| Dashboard aggregates | `GROUP BY division, status` on the indexed player table. Single query returns all counts. |
| Audit log (group admin) | Index on `(association_id, created_at DESC)`. Paginated with cursor-based pagination (offset by `created_at`). |

### 10.5 Performance Budget

| Metric | Target | Measurement |
|--------|--------|-------------|
| LCP | < 2.5s (4G mobile) | Lighthouse, Vercel Analytics |
| FID / INP | < 200ms | Web Vitals |
| CLS | < 0.1 | Lighthouse |
| Total JS bundle (client) | < 150KB gzipped | Next.js build output |
| Player list render (500 items) | < 200ms | Chrome DevTools Performance |
| Search result update | < 300ms | Perceived responsiveness |
| API response (P95) | < 500ms | Supabase dashboard |

---

## Appendix: Technology Dependency Map

```
Next.js 16.1.6
  |-- React 19.2.3
  |-- TypeScript 5.x
  |-- Tailwind CSS 4.x
  |     |-- @tailwindcss/postcss
  |     |-- tw-animate-css
  |-- shadcn/ui
  |     |-- radix-ui (primitives)
  |     |-- class-variance-authority (variants)
  |     |-- clsx + tailwind-merge (via cn())
  |     |-- lucide-react (icons)
  |-- @supabase/ssr (auth + SSR)
  |     |-- @supabase/supabase-js (client)
  |-- cheerio (scraping)
  |-- zod (validation, to be added)
  |
  Deployed on: Vercel (Hobby)
  Database:    Supabase (Free/Pro)
  VCS:         GitHub (trunk-based)
```

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-17 | Architecture Design Agent | Initial architecture document with two-tier role system (admin, parent). |
| 1.1 | 2026-04-17 | PRD Writer Agent | Updated to three-tier role system (admin, group_admin, member). Added ADR-008. Updated all role references, RLS policies, helper functions, and code examples. |
